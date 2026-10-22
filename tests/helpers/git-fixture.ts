import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runCommand, sanitizeEnv } from './run-command';

export function initGitRepo(repoRoot: string, userName: string, userEmail: string) {
	runCommand('git', ['init'], { cwd: repoRoot, env: sanitizeEnv() });
	runCommand('git', ['config', 'user.name', userName], { cwd: repoRoot, env: sanitizeEnv() });
	runCommand('git', ['config', 'user.email', userEmail], { cwd: repoRoot, env: sanitizeEnv() });
	runCommand('git', ['config', 'commit.gpgsign', 'false'], { cwd: repoRoot, env: sanitizeEnv() });
	runCommand('git', ['config', 'core.autocrlf', 'false'], { cwd: repoRoot, env: sanitizeEnv() });
}

export function cleanupFixture(repoRoot: string) {
	if (!repoRoot || !repoRoot.startsWith(tmpdir())) {
		throw new Error(`Refusing to remove path outside temp directory: ${repoRoot}`);
	}
	try {
		rmSync(repoRoot, { recursive: true, force: true });
	} catch {
		// Ignore teardown races
	}
}

/**
 * Builds `<parent>/celebra-me` (Integration, one commit on `develop`) and, when `segment`
 * is given, a linked worktree at `<parent>/celebra-me-worktrees/<segment>` on `lane/<segment>`,
 * so lane detection sees the same layout as a real machine. Remove `parent` when done.
 */
export function createLaneFixture(parent: string, segment: string | null, userName: string) {
	const integration = join(parent, 'celebra-me');
	mkdirSync(integration, { recursive: true });
	initGitRepo(integration, userName, 'lane-fixture@example.com');
	const git = (cwd: string, args: string[]) =>
		runCommand('git', args, { cwd, env: sanitizeEnv() });
	git(integration, ['symbolic-ref', 'HEAD', 'refs/heads/develop']);
	writeFileSync(join(integration, 'README.md'), '# fixture\n', 'utf8');
	git(integration, ['add', 'README.md']);
	git(integration, ['commit', '-m', 'initial']);
	if (!segment) return integration;
	const lane = join(parent, 'celebra-me-worktrees', segment);
	git(integration, ['worktree', 'add', '-b', `lane/${segment}`, lane]);
	return lane;
}
