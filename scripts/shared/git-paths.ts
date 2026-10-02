import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

/**
 * Absolute path inside the repository's common Git directory, shared by every worktree.
 * Unlike `git rev-parse --git-path`, unknown paths never resolve to a per-worktree directory.
 */
export function gitCommonPath(relativePath: string, cwd: string = process.cwd()): string {
	const commonDir = execFileSync(
		'git',
		['rev-parse', '--path-format=absolute', '--git-common-dir'],
		{ cwd, encoding: 'utf8' },
	).trim();
	return resolve(join(commonDir, relativePath));
}
