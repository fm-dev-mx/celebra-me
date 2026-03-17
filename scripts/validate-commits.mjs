#!/usr/bin/env node

import { dirname } from 'path';
import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import process from 'process';
import {
	classifyCommitFileArea,
	normalizePath,
	summarizeDiffEntries,
} from '../.agent/governance/bin/commit-message-analysis.mjs';

const POLICY_PATH = '.agent/governance/config/policy.json';

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

function atomicityLimit() {
	if (!existsSync(POLICY_PATH)) return 12;
	try {
		const policy = JSON.parse(readFileSync(POLICY_PATH, 'utf8'));
		const value = Number(policy?.atomicity?.defaultLimit || 12);
		return Number.isFinite(value) && value > 0 ? Math.floor(value) : 12;
	} catch {
		return 12;
	}
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

function classifyGroupKind(files) {
	const areas = new Set(files.map((file) => classifyCommitFileArea(file)));
	if (areas.size === 1) return `${Array.from(areas)[0]}-group`;
	return 'mixed-group';
}

function suggestFileGroups(files) {
	const groups = new Map();
	for (const file of files.map(normalizePath)) {
		const dir = normalizePath(dirname(file));
		const key = dir === '.' ? file : `${dir}/`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(file);
	}
	return Array.from(groups.entries())
		.map(([key, groupFiles]) => ({
			key,
			files: groupFiles.sort((a, b) => a.localeCompare(b)),
			kind: classifyGroupKind(groupFiles),
		}))
		.sort((a, b) => a.key.localeCompare(b.key));
}

function getCommitDiffEntries(commitHash) {
	const diff = run('git', ['show', '--name-status', '--format=', '--find-renames', commitHash]);
	if (!diff.stdout) return [];
	return diff.stdout
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const parts = line.split('\t').filter(Boolean);
			const rawStatus = parts[0] || 'M';
			const status = rawStatus.startsWith('R') ? 'R' : rawStatus[0];
			const oldPath = status === 'R' ? normalizePath(parts[1] || '') : '';
			const path = normalizePath(parts[status === 'R' ? 2 : parts.length - 1]);
			return { path, oldPath, status, area: classifyCommitFileArea(path) };
		});
}

function buildCommitlintContext(files, diffEntries) {
	const normalizedFiles = files.map(normalizePath);
	return {
		COMMITLINT_STAGED_FILES: normalizedFiles.join('\n'),
		COMMITLINT_DIFF_JSON: JSON.stringify(diffEntries),
	};
}

function validateCommitMessage(message, commitHash, files, diffEntries) {
	const tmpDir = mkdtempSync(join(tmpdir(), 'commitlint-'));
	const tmpFile = join(tmpDir, `${commitHash}.txt`);
	try {
		writeFileSync(tmpFile, `${message.trim()}\n`, 'utf8');
		const commitlintEnv = buildCommitlintContext(files, diffEntries);
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

function validateAtomicity(files) {
	const limit = atomicityLimit();
	if (files.length > limit) {
		const groups = suggestFileGroups(files);
		const areaCount = new Set(files.map((file) => classifyCommitFileArea(file))).size;
		if (groups.length <= limit && areaCount <= 2) {
			return {
				ok: true,
				message: `Grouped ${files.length} files into ${groups.length} coherent paths for atomicity.`,
			};
		}
		return {
			ok: false,
			message: `Commit touches ${files.length} files (max ${limit} for ADU policy).`,
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
	const diffEntries = getCommitDiffEntries(commitHash);
	console.log(`  Subject: ${commit.subject}`);
	const conventional = validateCommitMessage(commit.full, commitHash, files, diffEntries);
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
