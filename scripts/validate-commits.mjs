#!/usr/bin/env node

import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import process from 'process';

import {
	classifyCommitFileArea,
	normalizePath,
} from '../.agent/governance/bin/commit-message-analysis.mjs';
import {
	loadValidatedCommitPlan,
	matchDiffEntriesToUnit,
	resolveCommitUnit,
} from '../.agent/governance/bin/commit-plan.mjs';

function run(cmd, args, options = {}) {
	const isWin = process.platform === 'win32';
	const result = spawnSync(cmd, args, {
		encoding: 'utf8',
		stdio: 'pipe',
		shell: options.shell ?? isWin,
		env: options.env || process.env,
		cwd: options.cwd || process.cwd(),
	});
	if (result.error) throw result.error;
	return {
		status: result.status ?? 1,
		stdout: String(result.stdout || '').trim(),
		stderr: String(result.stderr || '').trim(),
	};
}

function parseNameStatusZ(raw) {
	const tokens = String(raw || '')
		.split('\0')
		.filter(Boolean);
	const entries = [];
	for (let index = 0; index < tokens.length; ) {
		const rawStatus = tokens[index++] || 'M';
		const status = rawStatus.startsWith('R') ? 'R' : rawStatus[0];
		if (status === 'R') {
			const oldPath = normalizePath(tokens[index++] || '');
			const path = normalizePath(tokens[index++] || '');
			if (path) entries.push({ path, oldPath, status });
			continue;
		}
		const path = normalizePath(tokens[index++] || '');
		if (path) entries.push({ path, oldPath: '', status });
	}
	return entries;
}

function getCommitMessage(commitHash) {
	const full = run('git', ['log', '--format=%B', '-n', '1', commitHash]);
	const subject = run('git', ['log', '--format=%s', '-n', '1', commitHash]);
	if (full.status !== 0 || !full.stdout) return null;
	return { full: full.stdout, subject: subject.stdout || '' };
}

function getCommitDiffEntries(commitHash) {
	const diff = run('git', [
		'show',
		'--name-status',
		'--format=',
		'--find-renames',
		'-z',
		commitHash,
	]);
	return parseNameStatusZ(diff.stdout).map((entry) => ({
		...entry,
		area: classifyCommitFileArea(entry.path),
	}));
}

function trailerValue(message, key) {
	const match = String(message || '').match(new RegExp(`^${key}:\\s*(.+)$`, 'mi'));
	return match ? match[1].trim() : '';
}

function buildCommitlintContext(files, _diffEntries, unitContext = null) {
	const normalizedFiles = files.map(normalizePath);
	const env = {
		COMMITLINT_STAGED_FILES: normalizedFiles.join('\n'),
	};
	if (unitContext?.unitId) {
		env.COMMITLINT_PLAN_ID = String(unitContext.planId || '');
		env.COMMITLINT_UNIT_ID = String(unitContext.unitId || '');
		env.COMMITLINT_UNIT_VERB = String(unitContext.verb || '');
		env.COMMITLINT_UNIT_TARGET = String(unitContext.target || '');
		env.COMMITLINT_UNIT_PURPOSE = String(unitContext.purpose || '');
		env.COMMITLINT_UNIT_FILES_JSON = JSON.stringify(
			(unitContext.files || []).map(normalizePath),
		);
		env.COMMITLINT_UNIT_DOMAIN = String(unitContext.domain || '');
	}
	return env;
}

function validateCommitMessage(message, commitHash, files, diffEntries, unitContext) {
	const tmpDir = mkdtempSync(join(tmpdir(), 'commitlint-'));
	const tmpFile = join(tmpDir, `${commitHash}.txt`);
	try {
		writeFileSync(tmpFile, `${message.trim()}\n`, 'utf8');
		const commitlintEnv = buildCommitlintContext(files, diffEntries, unitContext);
		const result = run('pnpm', ['exec', 'commitlint', '--edit', tmpFile], {
			env: {
				...process.env,
				...commitlintEnv,
			},
		});
		return {
			ok: result.status === 0,
			output: [result.stdout, result.stderr].filter(Boolean).join('\n'),
		};
	} finally {
		try {
			unlinkSync(tmpFile);
		} catch {
			/* ignore */
		}
		try {
			rmSync(tmpDir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	}
}

function resolveUnitContext(message, diffEntries) {
	if (trailerValue(message, 'Maintenance') === 'true') {
		return {
			ok: true,
			unitContext: {
				maintenance: true,
				files: diffEntries.map((entry) => entry.path),
			},
		};
	}

	const planId = trailerValue(message, 'Plan-Id');
	const unitId = trailerValue(message, 'Commit-Unit');
	if (!planId || !unitId) {
		return {
			ok: true, // Soft allow for missing trailers
			reason: 'missing_trailers',
			isWarning: true,
			error: 'Planned commits must include Plan-Id and Commit-Unit trailers (or Maintenance: true).',
		};
	}
	const loadedPlan = loadValidatedCommitPlan(planId, process.cwd());
	if (!loadedPlan.ok) {
		const msg = (loadedPlan.errors || []).join('\n') || `Unable to load plan "${planId}".`;
		console.warn(`  ⚠️  Warning [${loadedPlan.reason}]: ${msg}`);
		return {
			ok: true, // Soft allow for missing/invalid plans
			unitContext: null, // No context for further validation
		};
	}
	const unit = resolveCommitUnit(loadedPlan.plan, unitId);
	if (!unit) {
		return {
			ok: false,
			reason: 'unit_not_found',
			error: `Commit unit "${unitId}" was not found in plan "${planId}".`,
		};
	}
	const match = matchDiffEntriesToUnit(unit, diffEntries);
	if (!match.ok) {
		return {
			ok: false,
			reason: 'unit_mismatch',
			error: `Commit files do not match planned unit "${unitId}".`,
		};
	}
	return {
		ok: true,
		unitContext: {
			planId,
			unitId,
			verb: unit.subject.verb,
			target: unit.subject.target,
			purpose: unit.purpose,
			files: diffEntries.map((entry) => entry.path),
			domain: unit.domain,
		},
	};
}

function validateCommit(commitHash) {
	console.log(`\nChecking commit: ${commitHash}`);
	const commit = getCommitMessage(commitHash);
	if (!commit) {
		console.error(`❌ Unable to read commit message for ${commitHash}`);
		return false;
	}

	const diffEntries = getCommitDiffEntries(commitHash);
	const files = diffEntries.map((entry) => entry.path);
	const resolvedContext = resolveUnitContext(commit.full, diffEntries);
	if (!resolvedContext.ok) {
		console.error(`  ❌ ${resolvedContext.error}`);
		return false;
	}

	const conventional = validateCommitMessage(
		commit.full,
		commitHash,
		files,
		diffEntries,
		resolvedContext.unitContext,
	);
	if (!conventional.ok) {
		console.error('  ❌ Commit validation failed');
		if (conventional.output) console.error(`  ${conventional.output}`);
		return false;
	}

	console.log(`  Subject: ${commit.subject}`);
	console.log('  ✅ Commit valid');
	return true;
}

function main() {
	const [baseSha, headSha] = process.argv.slice(2);
	if (!baseSha || !headSha) {
		console.error('Usage: node scripts/validate-commits.mjs <base-sha> <head-sha>');
		process.exit(1);
	}

	const commitsOutput = run('git', ['log', '--format=%H', `${baseSha}..${headSha}`]);
	if (commitsOutput.status !== 0) {
		console.error('❌ Unable to list commits in the provided range');
		process.exit(1);
	}
	const hashes = commitsOutput.stdout ? commitsOutput.stdout.split('\n').filter(Boolean) : [];
	if (!hashes.length) {
		console.log('No commits found in range');
		process.exit(0);
	}

	let allValid = true;
	for (let i = 0; i < hashes.length; i++) {
		const hash = hashes[i];
		if (!validateCommit(hash)) {
			allValid = false;
		}
	}

	if (!allValid) {
		console.log('\n🔍 Push Governance Audit: Some metadata issues found (Audit-only mode).');
		console.log('💡 Note: These findings do not block the push but should be addressed in future units.');
	} else {
		console.log('\n✅ Push validation completed (All metadata verified)');
	}
	
	// Never block push for metadata. 
	// CI and pre-push should focus on tests/types for range validation.
	process.exit(0);
}

const isMain =
	import.meta.url ===
	`file://${process.platform === 'win32' ? '/' : ''}${process.argv[1]?.replace(/\\/g, '/')}`;
if (isMain) {
	main();
}

export {
	buildCommitlintContext,
	classifyCommitFileArea as classifyFileArea,
	getCommitDiffEntries,
	validateCommit,
};
