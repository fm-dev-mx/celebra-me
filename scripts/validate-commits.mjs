#!/usr/bin/env node

import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import process from 'process';

const MULTI_FILE_BODY_THRESHOLD = 3;
const BROAD_COMMIT_THRESHOLD = 10;
const TOP_LEVEL_AREAS = new Set(['src', 'docs', 'tests', 'supabase', 'public', '.github']);
const ROOT_CONFIG_PATTERN =
	/^(?:package\.json|pnpm-lock\.yaml|tsconfig(?:\..+)?\.json|eslint\.config\.js|commitlint\.config\.cjs|astro\.config\.mjs|jest\.config\.cjs|playwright\.config\.ts|vercel\.json|README\.md|CONTRIBUTING\.md)$/;

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

function getCommitMessage(commitHash) {
	const full = run('git', ['log', '--format=%B', '-n', '1', commitHash]);
	const subject = run('git', ['log', '--format=%s', '-n', '1', commitHash]);
	if (full.status !== 0 || !full.stdout) return null;
	return { full: full.stdout, subject: subject.stdout || '' };
}

function validateCommitMessage(message, commitHash) {
	const tmpDir = mkdtempSync(join(tmpdir(), 'commitlint-'));
	const tmpFile = join(tmpDir, `${commitHash}.txt`);
	try {
		writeFileSync(tmpFile, `${String(message || '').trim()}\n`, 'utf8');
		const result = run('pnpm', ['exec', 'commitlint', '--edit', tmpFile]);
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

function getCommitBody(fullMessage) {
	const lines = String(fullMessage || '').split(/\r?\n/);
	const bodyLines = lines.slice(1);

	while (bodyLines.length > 0 && !bodyLines[0].trim()) {
		bodyLines.shift();
	}

	while (bodyLines.length > 0 && !bodyLines.at(-1)?.trim()) {
		bodyLines.pop();
	}

	return bodyLines.join('\n').trim();
}

function hasBulletStructuredBody(body) {
	return body.split(/\r?\n/).some((line) => /^\s*[-*]\s+\S+/.test(line));
}

function getChangedFiles(commitHash) {
	const result = run('git', [
		'diff-tree',
		'--no-commit-id',
		'--name-only',
		'--root',
		'-r',
		commitHash,
	]);
	if (result.status !== 0) return [];
	return result.stdout
		? result.stdout
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean)
		: [];
}

function classifyPathArea(filePath) {
	const normalizedPath = String(filePath || '').replace(/\\/g, '/');
	const [topLevel] = normalizedPath.split('/');
	if (!topLevel) return 'unknown';
	if (TOP_LEVEL_AREAS.has(topLevel)) return topLevel;
	if (!normalizedPath.includes('/') && ROOT_CONFIG_PATTERN.test(normalizedPath))
		return 'root-config';
	if (!normalizedPath.includes('/')) return 'repo-root';
	return 'other';
}

function collectAuditWarnings(commit) {
	const changedFiles = getChangedFiles(commit.hash);
	const body = getCommitBody(commit.full);
	const changedAreas = [...new Set(changedFiles.map(classifyPathArea))];
	const warnings = [];

	if (changedFiles.length >= MULTI_FILE_BODY_THRESHOLD && !body) {
		warnings.push(
			`commit touches ${changedFiles.length} files but has no body; describe the relevant file or module changes`,
		);
	}

	if (
		changedFiles.length >= MULTI_FILE_BODY_THRESHOLD &&
		body &&
		!hasBulletStructuredBody(body)
	) {
		warnings.push(
			`commit touches ${changedFiles.length} files but the body is not bullet-structured; use bullets per file or coherent module`,
		);
	}

	if (changedAreas.length >= 3) {
		warnings.push(
			`commit spans multiple repository areas (${changedAreas.join(', ')}); check that it is still atomic`,
		);
	}

	if (changedFiles.length >= BROAD_COMMIT_THRESHOLD) {
		warnings.push(
			`commit changes ${changedFiles.length} files; this is likely too broad for an atomic commit`,
		);
	}

	return { changedFiles, warnings };
}

function validateCommit(commitHash) {
	console.log(`\nChecking commit: ${commitHash}`);
	const commit = getCommitMessage(commitHash);
	if (!commit) {
		console.error(`❌ Unable to read commit message for ${commitHash}`);
		return false;
	}

	const conventional = validateCommitMessage(commit.full, commitHash);
	if (!conventional.ok) {
		console.error('  ❌ Commit validation failed');
		if (conventional.output) console.error(`  ${conventional.output}`);
		return false;
	}

	const audit = collectAuditWarnings({ ...commit, hash: commitHash });

	console.log(`  Subject: ${commit.subject}`);
	if (audit.warnings.length > 0) {
		for (const warning of audit.warnings) {
			console.warn(`  ⚠️  ${warning}`);
		}
		console.log('  ⚠️  Commit passed hard validation with audit warnings');
		return false;
	}
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
		if (!validateCommit(hash)) {
			allValid = false;
		}
	}

	if (!allValid) {
		console.log('\n🔍 Commit validation found issues (audit-only mode).');
		console.log('💡 Note: These findings do not block the push, but they should be fixed.');
	} else {
		console.log('\n✅ Commit validation completed');
	}

	process.exit(0);
}

const isMain =
	import.meta.url ===
	`file://${process.platform === 'win32' ? '/' : ''}${process.argv[1]?.replace(/\\/g, '/')}`;

if (isMain) {
	main();
}

export { validateCommit, validateCommitMessage };
