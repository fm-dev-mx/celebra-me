import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { runCommand } from './run-command';

export function initGitRepo(repoRoot: string, userName: string, userEmail: string) {
	runCommand('git', ['init'], { cwd: repoRoot });
	runCommand('git', ['config', 'user.name', userName], { cwd: repoRoot });
	runCommand('git', ['config', 'user.email', userEmail], { cwd: repoRoot });
	runCommand('git', ['config', 'commit.gpgsign', 'false'], { cwd: repoRoot });
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
