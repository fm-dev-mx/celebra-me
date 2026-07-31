import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function runGit(args, { allowFailure = false } = {}) {
	const result = spawnSync('git', args, {
		cwd: process.cwd(),
		encoding: 'utf8',
	});
	if (result.error) throw result.error;
	if (!allowFailure && (result.status ?? 1) !== 0) {
		throw new Error(
			`git ${args.join(' ')} failed:\n${result.stdout || ''}${result.stderr || ''}`,
		);
	}
	return {
		status: result.status ?? 1,
		stdout: String(result.stdout || ''),
		stderr: String(result.stderr || ''),
	};
}

function parseFileList(output) {
	return output
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((file) => file.replaceAll('\\', '/'));
}

function unique(files) {
	return [...new Set(files)];
}

function hasHeadCommit() {
	return runGit(['rev-parse', '--verify', 'HEAD'], { allowFailure: true }).status === 0;
}

function getFilesFromExplicitRange(baseSha, headSha) {
	return parseFileList(
		runGit(['diff', '--name-only', '--diff-filter=ACMR', baseSha, headSha]).stdout,
	);
}

/**
 * Files explicitly staged in the index. This is the only scope that
 * `validate:staged` should ever read — the user has committed these to be
 * reviewed, and unrelated working-tree changes must not influence the
 * validation result.
 */
function getStagedFiles() {
	return unique(
		parseFileList(runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).stdout),
	);
}

/**
 * Working-tree changes (tracked + staged) plus untracked. This is the scope
 * for `validate:changed` and `test:changed` when the user wants broader
 * local feedback beyond what they have already staged.
 */
function getChangedFilesInWorkingTree() {
	const trackedArgs = hasHeadCommit()
		? ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']
		: ['diff', '--cached', '--name-only', '--diff-filter=ACMR'];
	const tracked = parseFileList(runGit(trackedArgs).stdout);
	const staged = parseFileList(
		runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).stdout,
	);
	const untracked = parseFileList(runGit(['ls-files', '--others', '--exclude-standard']).stdout);
	return unique([...tracked, ...staged, ...untracked]).filter((file) => existsSync(file));
}

/**
 * Backwards-compatible default. In CI it honors VALIDATION_BASE_SHA/HEAD_SHA
 * (explicit PR range). In local environments it falls back to
 * getChangedFilesInWorkingTree — callers that need strict staged-only
 * behavior must call getStagedFiles() directly.
 */
export function getChangedFiles() {
	const baseSha = process.env.VALIDATION_BASE_SHA?.trim();
	const headSha = process.env.VALIDATION_HEAD_SHA?.trim();
	if ((baseSha && !headSha) || (!baseSha && headSha)) {
		throw new Error('VALIDATION_BASE_SHA and VALIDATION_HEAD_SHA must be set together.');
	}
	if (baseSha && headSha) {
		return getFilesFromExplicitRange(baseSha, headSha);
	}
	return getChangedFilesInWorkingTree();
}

export { getStagedFiles, getChangedFilesInWorkingTree };
