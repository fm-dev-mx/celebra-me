#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import process from 'process';

function run(cmd, args, options = {}) {
	const isWin = process.platform === 'win32';
	const result = spawnSync(cmd, args, {
		encoding: 'utf8',
		stdio: 'pipe',
		shell: isWin,
		...options,
	});
	if (result.error) throw result.error;
	return {
		status: result.status ?? 1,
		stdout: (result.stdout || '').trim(),
		stderr: (result.stderr || '').trim(),
	};
}

function getCommitMessage(commitHash) {
	const full = run('git', ['log', '--format=%B', '-n', '1', commitHash]);
	const subject = run('git', ['log', '--format=%s', '-n', '1', commitHash]);
	if (full.status !== 0 || !full.stdout) return null;
	return { full: full.stdout, subject: subject.stdout || '' };
}

function getCommitFiles(commitHash) {
	const files = run('git', ['show', '--name-only', '--format=', commitHash]);
	return files.stdout
		? files.stdout
				.split('\n')
				.map((f) => f.trim())
				.filter(Boolean)
		: [];
}

function validateCommitMessage(message, commitHash, files) {
	const tmpDir = mkdtempSync(join(tmpdir(), 'commitlint-'));
	const tmpFile = join(tmpDir, `${commitHash}.txt`);
	try {
		writeFileSync(tmpFile, `${message.trim()}\n`, 'utf8');
		const result = run('npx', ['commitlint', '--edit', tmpFile], {
			env: {
				...process.env,
				COMMITLINT_STAGED_FILES: files.join('\n'),
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

function validateAtomicity(files) {
	if (files.length > 12) {
		return {
			ok: false,
			message: `Commit touches ${files.length} files (max 12 for ADU policy).`,
		};
	}
	return { ok: true };
}

function validateCommit(commitHash) {
	console.log(`\nChecking commit: ${commitHash}`);
	const commit = getCommitMessage(commitHash);
	if (!commit) {
		console.error(`❌ Unable to read commit message for ${commitHash}`);
		return false;
	}

	const files = getCommitFiles(commitHash);
	console.log(`  Subject: ${commit.subject}`);
	const conventional = validateCommitMessage(commit.full, commitHash, files);
	if (!conventional.ok) {
		console.error('  ❌ Conventional Commit validation failed');
		if (conventional.output) console.error(`  ${conventional.output}`);
		return false;
	}

	if (/^Merge\s/i.test(commit.subject)) {
		console.error('  ❌ Merge commit detected in PR range');
		return false;
	}
	if (/\b(wip|draft|work in progress)\b/i.test(commit.subject)) {
		console.error('  ❌ WIP/draft markers are not allowed');
		return false;
	}

	const atomicity = validateAtomicity(files);
	if (!atomicity.ok) {
		console.error(`  ❌ ${atomicity.message}`);
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

	console.log('Running ADU commit validation');
	console.log(`Range: ${baseSha}..${headSha}`);

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
		console.error('\n❌ ADU validation failed');
		process.exit(1);
	}
	console.log('\n✅ All commits passed ADU validation');
}

const isMain = import.meta.url === `file://${process.platform === 'win32' ? '/' : ''}${process.argv[1]?.replace(/\\/g, '/')}`;
if (isMain) {
	main();
}

export { validateCommit };
