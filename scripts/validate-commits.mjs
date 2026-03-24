#!/usr/bin/env node

import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import process from 'process';

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
