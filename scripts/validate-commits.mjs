#!/usr/bin/env node

import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import process from 'process';

import {
	classifyCommitFileArea,
	normalizePath,
	summarizeDiffEntries,
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

function getCommitFiles(commitHash) {
	return getCommitDiffEntries(commitHash).map((entry) => entry.path);
}

function trailerValue(message, key) {
	const match = String(message || '').match(new RegExp(`^${key}:\\s*(.+)$`, 'mi'));
	return match ? match[1].trim() : '';
}

function suggestFileGroups(files) {
	const groups = new Map();
	for (const file of files.map(normalizePath)) {
		const key = file.includes('/') ? `${file.split('/').slice(0, -1).join('/')}/` : file;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(file);
	}
	return Array.from(groups.entries()).map(([key, groupedFiles]) => ({
		key,
		files: groupedFiles.sort((left, right) => left.localeCompare(right)),
		kind: `${classifyCommitFileArea(groupedFiles[0])}-group`,
	}));
}

function buildCommitlintContext(files, diffEntries, unitContext = null) {
	const normalizedFiles = files.map(normalizePath);
	const summary = summarizeDiffEntries(diffEntries);
	const env = {
		COMMITLINT_STAGED_FILES: normalizedFiles.join('\n'),
		COMMITLINT_DIFF_JSON: JSON.stringify(diffEntries),
		COMMITLINT_FILE_GROUPS_JSON: JSON.stringify(suggestFileGroups(normalizedFiles)),
		COMMITLINT_DOMINANT_CHANGE_KIND: summary.dominantKind,
		COMMITLINT_DOMINANT_AREA: summary.dominantArea,
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
		const result = run('npx', ['commitlint', '--edit', tmpFile], {
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
	const planId = trailerValue(message, 'Plan-Id');
	const unitId = trailerValue(message, 'Commit-Unit');
	if (!planId || !unitId) {
		return {
			ok: false,
			reason: 'missing_trailers',
			error: 'Planned commits must include Plan-Id and Commit-Unit trailers.',
		};
	}
	const loadedPlan = loadValidatedCommitPlan(planId, process.cwd());
	if (!loadedPlan.ok) {
		return {
			ok: false,
			reason: loadedPlan.reason || 'invalid_plan_contract',
			error: (loadedPlan.errors || []).join('\n') || `Unable to load plan "${planId}".`,
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
	const files = getCommitFiles(commitHash);
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
	for (const hash of hashes) {
		if (!validateCommit(hash)) allValid = false;
	}
	if (!allValid) {
		console.error('\n❌ Planned commit validation failed');
		process.exit(1);
	}
	console.log('\n✅ All commits passed planned validation');
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
	suggestFileGroups,
	summarizeDiffEntries,
	validateCommit,
};
