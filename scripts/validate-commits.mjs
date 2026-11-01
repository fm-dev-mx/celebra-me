#!/usr/bin/env node

import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { resolve } from 'path';
import process from 'process';

// A commit with more than one reviewable file must explain what changes and why.
const MULTI_FILE_BODY_THRESHOLD = 2;
// Size limits count reviewable files and lines only (see isMechanicalChange). Measured on the
// v0.23.1-beta.1..v0.24.0-beta.1 range: median 6 files / 123 lines, p75 14 / ~570, p90 42 / ~2000.
const SIZE_WARN_FILES = 15;
const SIZE_WARN_LINES = 600;
const SIZE_HARD_FILES = 40;
const LARGE_CHANGE_TRAILER = /^Large-Change:\s*(rename|format|sweep|retire|generated)\b/im;
// A body made only of trailers explains nothing.
const TRAILER_LINE_PATTERN = /^(?:Co-Authored-By|Signed-off-by|Refs|Large-Change):\s/i;
const MECHANICAL_PATH_PATTERN =
	/(?:^|\/)pnpm-lock\.yaml$|-snapshots\/|\.(?:png|jpe?g|webp|avif|gif|mp3|mp4|woff2?)$/i;
const SUPPORTING_AREAS = new Set(['tests', 'docs']);
const TOP_LEVEL_AREAS = new Set(['src', 'docs', 'tests', 'supabase', 'public', '.github']);
const ROOT_CONFIG_PATTERN =
	/^(?:package\.json|pnpm-lock\.yaml|tsconfig(?:\..+)?\.json|eslint\.config\.js|commitlint\.config\.cjs|astro\.config\.mjs|jest\.config\.cjs|playwright\.config\.ts|README\.md|CONTRIBUTING\.md)$/;

function run(cmd, args, options = {}) {
	const isWin = process.platform === 'win32';
	const result = spawnSync(cmd, args, {
		encoding: 'utf8',
		stdio: 'pipe',
		// git is an executable; only the pnpm shim needs a shell on Windows.
		shell: options.shell ?? (isWin && cmd === 'pnpm'),
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

/**
 * One commitlint process lints the whole range (`base..head`); a process per commit cost about
 * 0.7 s each on every push and again in CI. The installed CLI runs through node directly because
 * the corepack pnpm shim is unreliable under hook shells; pnpm remains the fallback.
 */
function validateCommitRange(baseSha, headSha) {
	const cli = resolve(process.cwd(), 'node_modules/@commitlint/cli/cli.js');
	const rangeArgs = ['--from', baseSha, '--to', headSha];
	const result = existsSync(cli)
		? run(process.execPath, [cli, ...rangeArgs])
		: run('pnpm', ['exec', 'commitlint', ...rangeArgs]);
	return {
		ok: result.status === 0,
		output: [result.stdout, result.stderr].filter(Boolean).join('\n'),
	};
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

/**
 * Lockfiles, binaries, visual snapshots and exact renames are excluded from the size count: they
 * grow with the change without adding review work.
 */
function getReviewableSize(commitHash) {
	const result = run('git', ['show', '-M', '--numstat', '--format=', commitHash]);
	if (result.status !== 0 || !result.stdout) return { files: 0, lines: 0 };
	let files = 0;
	let lines = 0;
	for (const line of result.stdout.split('\n')) {
		const [added, deleted, ...pathParts] = line.split('\t');
		const filePath = pathParts.join('\t');
		const binary = added === '-';
		const exactRename = filePath.includes(' => ') && added === '0' && deleted === '0';
		if (binary || exactRename || MECHANICAL_PATH_PATTERN.test(filePath)) continue;
		files += 1;
		lines += Number(added) + Number(deleted);
	}
	return { files, lines };
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
	const primaryAreas = changedAreas.filter((area) => !SUPPORTING_AREAS.has(area));
	const warnings = [];
	const errors = [];

	if (primaryAreas.length >= 3) {
		warnings.push(
			`commit spans multiple repository areas (${primaryAreas.join(', ')}); check that it is still atomic`,
		);
	}

	if (changedFiles.length > 0) {
		const size = getReviewableSize(commit.hash);
		const explanation = body
			.split(/\r?\n/)
			.filter((line) => line.trim() && !TRAILER_LINE_PATTERN.test(line));
		if (size.files >= MULTI_FILE_BODY_THRESHOLD && explanation.length === 0) {
			errors.push(
				`commit changes ${size.files} reviewable files but has no body; explain what changes and why`,
			);
		}
		const exception = commit.full.match(LARGE_CHANGE_TRAILER)?.[1];
		if (size.files > SIZE_HARD_FILES && !exception) {
			errors.push(
				`commit changes ${size.files} reviewable files (limit ${SIZE_HARD_FILES}); split it or add a Large-Change trailer`,
			);
		} else if (size.files > SIZE_WARN_FILES || size.lines > SIZE_WARN_LINES) {
			warnings.push(
				`commit changes ${size.files} reviewable files and ${size.lines} lines${exception ? ` (Large-Change: ${exception})` : ''}; check that it is still atomic`,
			);
		}
	}

	return { changedFiles, warnings, errors };
}

function validateCommit(commitHash, { strict }) {
	console.log(`\nChecking commit: ${commitHash}`);
	const commit = getCommitMessage(commitHash);
	if (!commit) {
		console.error(`❌ Unable to read commit message for ${commitHash}`);
		return false;
	}

	const audit = collectAuditWarnings({ ...commit, hash: commitHash });
	// History that already reached origin cannot be rewritten, so CI reports the missing body and
	// the hard size limit as warnings; pre-push passes --strict while the commits can still change.
	const shapeErrors = strict ? audit.errors : [];
	audit.warnings.push(...(strict ? [] : audit.errors));

	console.log(`  Subject: ${commit.subject}`);
	if (shapeErrors.length > 0) {
		for (const error of shapeErrors) {
			console.error(`  ❌ ${error}`);
		}
		return false;
	}
	if (audit.warnings.length > 0) {
		for (const warning of audit.warnings) {
			console.warn(`  ⚠️  ${warning}`);
		}
		console.log('  ⚠️  Commit passed hard validation with audit warnings');
		return true;
	}
	console.log('  ✅ Commit valid');
	return true;
}

function main() {
	const args = process.argv.slice(2);
	const strict = args.includes('--strict');
	const [baseSha, headSha] = args.filter((arg) => !arg.startsWith('--'));
	if (!baseSha || !headSha) {
		console.error('Usage: node scripts/validate-commits.mjs <base-sha> <head-sha> [--strict]');
		process.exit(1);
	}

	const commitsOutput = run('git', ['log', '--format=%H', `${baseSha}..${headSha}`]);
	if (commitsOutput.status !== 0) {
		console.error('❌ Unable to list commits in the provided range');
		process.exit(1);
	}
	const hashes = commitsOutput.stdout
		? commitsOutput.stdout
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter(Boolean)
		: [];
	if (!hashes.length) {
		console.log('No commits found in range');
		process.exit(0);
	}

	const conventional = validateCommitRange(baseSha, headSha);
	if (!conventional.ok) {
		console.error('❌ Commit validation failed');
		if (conventional.output) console.error(conventional.output);
		process.exit(1);
	}

	let allValid = true;
	for (const hash of hashes) {
		if (!validateCommit(hash, { strict })) {
			allValid = false;
		}
	}

	if (!allValid) {
		console.error('\n❌ Commit validation failed; other hygiene warnings stay advisory.');
		process.exit(1);
	}

	console.log('\n✅ Commit validation completed');
}

const isMain =
	import.meta.url ===
	`file://${process.platform === 'win32' ? '/' : ''}${process.argv[1]?.replace(/\\/g, '/')}`;

if (isMain) {
	main();
}
