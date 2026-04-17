import { spawnSync } from 'node:child_process';

function runGit(args, { allowFailure = false } = {}) {
	const result = spawnSync('git', args, {
		cwd: process.cwd(),
		encoding: 'utf8',
	});

	if (result.error) throw result.error;

	if (!allowFailure && (result.status ?? 1) !== 0) {
		throw new Error(
			`git ${args.join(' ')} failed:\n${result.stdout || ''}\n${result.stderr || ''}`,
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

function getFilesFromWorkingTree() {
	const trackedArgs = hasHeadCommit()
		? ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']
		: ['diff', '--cached', '--name-only', '--diff-filter=ACMR'];

	const tracked = parseFileList(runGit(trackedArgs).stdout);
	const staged = parseFileList(
		runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).stdout,
	);
	const untracked = parseFileList(runGit(['ls-files', '--others', '--exclude-standard']).stdout);

	return unique([...tracked, ...staged, ...untracked]);
}

export function getChangedFiles() {
	const baseSha = process.env.VALIDATION_BASE_SHA?.trim();
	const headSha = process.env.VALIDATION_HEAD_SHA?.trim();

	if ((baseSha && !headSha) || (!baseSha && headSha)) {
		throw new Error('VALIDATION_BASE_SHA and VALIDATION_HEAD_SHA must be set together.');
	}

	if (baseSha && headSha) {
		return getFilesFromExplicitRange(baseSha, headSha);
	}

	return getFilesFromWorkingTree();
}
