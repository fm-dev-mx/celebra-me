#!/usr/bin/env node

const { spawnSync } = require('child_process');
const { mkdtempSync, writeFileSync, unlinkSync, rmSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const { exit } = require('process');

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

function validateConventionalSubject(subject, commitHash) {
	const tmpDir = mkdtempSync(join(tmpdir(), 'commitlint-'));
	const tmpFile = join(tmpDir, `${commitHash}.txt`);
	try {
		writeFileSync(tmpFile, `${subject}\n`, 'utf8');
		const result = run('npx', ['commitlint', '--edit', tmpFile]);
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

function validateAtomicity(commitHash) {
	const files = run('git', ['show', '--name-only', '--format=', commitHash]);
	const changedFiles = files.stdout ? files.stdout.split('\n').filter((f) => f.trim()) : [];
	if (changedFiles.length > 12) {
		return {
			ok: false,
			message: `Commit touches ${changedFiles.length} files (max 12 for ADU policy).`,
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

	console.log(`  Subject: ${commit.subject}`);
	const conventional = validateConventionalSubject(commit.subject, commitHash);
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

	const atomicity = validateAtomicity(commitHash);
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
		console.error('Usage: node scripts/validate-commits.cjs <base-sha> <head-sha>');
		exit(1);
	}

	console.log('Running ADU commit validation');
	console.log(`Range: ${baseSha}..${headSha}`);

	const commitsOutput = run('git', ['log', '--format=%H', `${baseSha}..${headSha}`]);
	if (commitsOutput.status !== 0) {
		console.error('❌ Unable to list commits in the provided range');
		exit(1);
	}

	const hashes = commitsOutput.stdout ? commitsOutput.stdout.split('\n').filter(Boolean) : [];
	if (!hashes.length) {
		console.log('No commits found in range');
		exit(0);
	}

	let allValid = true;
	for (const hash of hashes) {
		if (!validateCommit(hash)) allValid = false;
	}

	if (!allValid) {
		console.error('\n❌ ADU validation failed');
		exit(1);
	}
	console.log('\n✅ All commits passed ADU validation');
}

if (require.main === module) main();

module.exports = { validateCommit };
