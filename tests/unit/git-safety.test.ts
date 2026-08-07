import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cleanupFixture, initGitRepo } from '../helpers/git-fixture';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'agent', 'git-safety.mjs');

function runGitSafety(repoRoot: string, args: string[]) {
	return runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({ CELEBRA_GIT_SAFETY_ROOT: repoRoot }),
	});
}

function createRepo() {
	const repoRoot = mkdtempSync(path.join(tmpdir(), 'git-safety-'));
	initGitRepo(repoRoot, 'Git Safety Tester', 'git-safety@example.com');
	writeFileSync(path.join(repoRoot, 'README.md'), '# fixture\n', 'utf8');
	runCommand('git', ['add', 'README.md'], { cwd: repoRoot, env: sanitizeEnv() });
	runCommand('git', ['commit', '-m', 'initial'], { cwd: repoRoot, env: sanitizeEnv() });
	return repoRoot;
}

function baselinePath(repoRoot: string) {
	return path.join(repoRoot, '.agent', 'tmp', 'git-safety-baseline.json');
}

describe('git-safety start/finish lifecycle', () => {
	it('starts a clean session and finishes unchanged protected state', () => {
		const repoRoot = createRepo();
		try {
			const start = runGitSafety(repoRoot, ['start']);
			expect(start.status).toBe(0);
			expect(existsSync(baselinePath(repoRoot))).toBe(true);
			const baseline = JSON.parse(readFileSync(baselinePath(repoRoot), 'utf8'));
			expect(baseline.version).toBe(2);
			expect(baseline.head).toMatch(/^[0-9a-f]{40}$/);
			expect(baseline.branch).toBeTruthy();
			expect(typeof baseline.indexFingerprint).toBe('string');
			expect(Array.isArray(baseline.indexEntries)).toBe(true);

			writeFileSync(path.join(repoRoot, 'work.txt'), 'edit\n', 'utf8');
			const finish = runGitSafety(repoRoot, ['finish']);
			expect(finish.status).toBe(0);
			expect(existsSync(baselinePath(repoRoot))).toBe(false);
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('fails start when a baseline already exists without overwriting', () => {
		const repoRoot = createRepo();
		try {
			expect(runGitSafety(repoRoot, ['start']).status).toBe(0);
			const before = readFileSync(baselinePath(repoRoot), 'utf8');
			const second = runGitSafety(repoRoot, ['start']);
			expect(second.status).toBe(1);
			expect(readFileSync(baselinePath(repoRoot), 'utf8')).toBe(before);
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('fails finish without a baseline', () => {
		const repoRoot = createRepo();
		try {
			const finish = runGitSafety(repoRoot, ['finish']);
			expect(finish.status).toBe(1);
			expect(`${finish.stdout}\n${finish.stderr}`).toContain('no active session baseline');
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('fails on unauthorized index drift and preserves baseline', () => {
		const repoRoot = createRepo();
		try {
			expect(runGitSafety(repoRoot, ['start']).status).toBe(0);
			writeFileSync(path.join(repoRoot, 'staged.txt'), 'staged\n', 'utf8');
			runCommand('git', ['add', 'staged.txt'], { cwd: repoRoot, env: sanitizeEnv() });
			const finish = runGitSafety(repoRoot, ['finish']);
			expect(finish.status).toBe(1);
			expect(existsSync(baselinePath(repoRoot))).toBe(true);
			expect(`${finish.stdout}\n${finish.stderr}`).toContain('index (staged) state changed');
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('fails on unauthorized HEAD drift and preserves baseline', () => {
		const repoRoot = createRepo();
		try {
			expect(runGitSafety(repoRoot, ['start']).status).toBe(0);
			writeFileSync(path.join(repoRoot, 'commit.txt'), 'c\n', 'utf8');
			runCommand('git', ['add', 'commit.txt'], { cwd: repoRoot, env: sanitizeEnv() });
			runCommand('git', ['commit', '-m', 'drift'], { cwd: repoRoot, env: sanitizeEnv() });
			const finish = runGitSafety(repoRoot, ['finish']);
			expect(finish.status).toBe(1);
			expect(existsSync(baselinePath(repoRoot))).toBe(true);
			expect(`${finish.stdout}\n${finish.stderr}`).toContain('HEAD changed');
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('fails on unauthorized branch switch', () => {
		const repoRoot = createRepo();
		try {
			expect(runGitSafety(repoRoot, ['start']).status).toBe(0);
			runCommand('git', ['checkout', '-b', 'other'], { cwd: repoRoot, env: sanitizeEnv() });
			const finish = runGitSafety(repoRoot, ['finish']);
			expect(finish.status).toBe(1);
			expect(existsSync(baselinePath(repoRoot))).toBe(true);
			expect(`${finish.stdout}\n${finish.stderr}`).toContain('branch/detached state changed');
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('accepts exact authorized stage and rejects adjacent path drift', () => {
		const repoRoot = createRepo();
		try {
			expect(runGitSafety(repoRoot, ['start']).status).toBe(0);
			writeFileSync(path.join(repoRoot, 'a.txt'), 'a\n', 'utf8');
			writeFileSync(path.join(repoRoot, 'b.txt'), 'b\n', 'utf8');
			runCommand('git', ['add', 'a.txt', 'b.txt'], { cwd: repoRoot, env: sanitizeEnv() });

			const tooNarrow = runGitSafety(repoRoot, [
				'finish',
				'--authorized-operation=stage',
				'--paths=a.txt',
			]);
			expect(tooNarrow.status).toBe(1);
			expect(existsSync(baselinePath(repoRoot))).toBe(true);
			expect(`${tooNarrow.stdout}\n${tooNarrow.stderr}`).toContain(
				'outside authorized scope',
			);

			const ok = runGitSafety(repoRoot, [
				'finish',
				'--authorized-operation=stage',
				'--paths=a.txt,b.txt',
			]);
			expect(ok.status).toBe(0);
			expect(existsSync(baselinePath(repoRoot))).toBe(false);
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('accepts authorized commit but rejects adjacent branch change', () => {
		const repoRoot = createRepo();
		try {
			expect(runGitSafety(repoRoot, ['start']).status).toBe(0);
			writeFileSync(path.join(repoRoot, 'c.txt'), 'c\n', 'utf8');
			runCommand('git', ['add', 'c.txt'], { cwd: repoRoot, env: sanitizeEnv() });
			runCommand('git', ['commit', '-m', 'authorized'], {
				cwd: repoRoot,
				env: sanitizeEnv(),
			});
			runCommand('git', ['checkout', '-b', 'side'], { cwd: repoRoot, env: sanitizeEnv() });
			const finish = runGitSafety(repoRoot, ['finish', '--authorized-operation=commit']);
			expect(finish.status).toBe(1);
			expect(`${finish.stdout}\n${finish.stderr}`).toContain(
				'must not change branch/detached state',
			);
			expect(existsSync(baselinePath(repoRoot))).toBe(true);
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('rejects commit authorization when only the index changed', () => {
		const repoRoot = createRepo();
		try {
			expect(runGitSafety(repoRoot, ['start']).status).toBe(0);
			writeFileSync(path.join(repoRoot, 'only-stage.txt'), 's\n', 'utf8');
			runCommand('git', ['add', 'only-stage.txt'], { cwd: repoRoot, env: sanitizeEnv() });
			const finish = runGitSafety(repoRoot, ['finish', '--authorized-operation=commit']);
			expect(finish.status).toBe(1);
			expect(`${finish.stdout}\n${finish.stderr}`).toContain(
				'authorized commit requires HEAD to change',
			);
			expect(existsSync(baselinePath(repoRoot))).toBe(true);
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('accepts authorized commit when HEAD moves and branch is unchanged', () => {
		const repoRoot = createRepo();
		try {
			expect(runGitSafety(repoRoot, ['start']).status).toBe(0);
			writeFileSync(path.join(repoRoot, 'ok.txt'), 'ok\n', 'utf8');
			runCommand('git', ['add', 'ok.txt'], { cwd: repoRoot, env: sanitizeEnv() });
			runCommand('git', ['commit', '-m', 'ok'], { cwd: repoRoot, env: sanitizeEnv() });
			const finish = runGitSafety(repoRoot, ['finish', '--authorized-operation=commit']);
			expect(finish.status).toBe(0);
			expect(existsSync(baselinePath(repoRoot))).toBe(false);
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('accepts authorized branch-switch when index is unchanged', () => {
		const repoRoot = createRepo();
		try {
			runCommand('git', ['branch', 'feature'], { cwd: repoRoot, env: sanitizeEnv() });
			expect(runGitSafety(repoRoot, ['start']).status).toBe(0);
			runCommand('git', ['checkout', 'feature'], { cwd: repoRoot, env: sanitizeEnv() });
			const finish = runGitSafety(repoRoot, [
				'finish',
				'--authorized-operation=branch-switch',
				'--branch=feature',
			]);
			expect(finish.status).toBe(0);
			expect(existsSync(baselinePath(repoRoot))).toBe(false);
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('ignores legacy allow-git-write as authorization and retires it', () => {
		const repoRoot = createRepo();
		try {
			expect(runGitSafety(repoRoot, ['start']).status).toBe(0);
			const allow = path.join(repoRoot, '.agent', 'tmp', 'allow-git-write');
			mkdirSync(path.dirname(allow), { recursive: true });
			writeFileSync(allow, 'legacy\n', 'utf8');
			writeFileSync(path.join(repoRoot, 'x.txt'), 'x\n', 'utf8');
			runCommand('git', ['add', 'x.txt'], { cwd: repoRoot, env: sanitizeEnv() });
			const finish = runGitSafety(repoRoot, ['finish']);
			expect(finish.status).toBe(1);
			expect(existsSync(allow)).toBe(false);
			expect(existsSync(baselinePath(repoRoot))).toBe(true);
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('rejects unknown authorized operations', () => {
		const repoRoot = createRepo();
		try {
			expect(runGitSafety(repoRoot, ['start']).status).toBe(0);
			const finish = runGitSafety(repoRoot, [
				'finish',
				'--authorized-operation=push',
			]);
			expect(finish.status).toBe(1);
			expect(`${finish.stdout}\n${finish.stderr}`).toContain('Unknown authorized operation');
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('fingerprints large staged binaries without buffer failure', () => {
		const repoRoot = createRepo();
		try {
			expect(runGitSafety(repoRoot, ['start']).status).toBe(0);
			const big = Buffer.alloc(2 * 1024 * 1024, 7);
			writeFileSync(path.join(repoRoot, 'big.bin'), big);
			runCommand('git', ['add', 'big.bin'], { cwd: repoRoot, env: sanitizeEnv() });
			const finish = runGitSafety(repoRoot, [
				'finish',
				'--authorized-operation=stage',
				'--paths=big.bin',
			]);
			expect(finish.status).toBe(0);
			expect(existsSync(baselinePath(repoRoot))).toBe(false);
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('supports unborn HEAD and authorized first commit', () => {
		const repoRoot = mkdtempSync(path.join(tmpdir(), 'git-safety-unborn-'));
		try {
			initGitRepo(repoRoot, 'Git Safety Tester', 'git-safety@example.com');
			const start = runGitSafety(repoRoot, ['start']);
			expect(start.status).toBe(0);
			const baseline = JSON.parse(readFileSync(baselinePath(repoRoot), 'utf8'));
			expect(baseline.head).toBeNull();

			writeFileSync(path.join(repoRoot, 'first.txt'), '1\n', 'utf8');
			runCommand('git', ['add', 'first.txt'], { cwd: repoRoot, env: sanitizeEnv() });

			const finishUnborn = runGitSafety(repoRoot, ['finish']);
			expect(finishUnborn.status).toBe(1);
			expect(existsSync(baselinePath(repoRoot))).toBe(true);

			const finishStageOnly = runGitSafety(repoRoot, [
				'finish',
				'--authorized-operation=commit',
			]);
			expect(finishStageOnly.status).toBe(1);
			expect(`${finishStageOnly.stdout}\n${finishStageOnly.stderr}`).toContain(
				'authorized commit requires HEAD to change',
			);

			runCommand('git', ['commit', '-m', 'first'], { cwd: repoRoot, env: sanitizeEnv() });
			const finishCommit = runGitSafety(repoRoot, [
				'finish',
				'--authorized-operation=commit',
			]);
			expect(finishCommit.status).toBe(0);
			expect(existsSync(baselinePath(repoRoot))).toBe(false);
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('does not hard-fail when an unrelated local branch ref is created', () => {
		const repoRoot = createRepo();
		try {
			expect(runGitSafety(repoRoot, ['start']).status).toBe(0);
			runCommand('git', ['branch', 'unrelated-parallel'], {
				cwd: repoRoot,
				env: sanitizeEnv(),
			});
			const finish = runGitSafety(repoRoot, ['finish']);
			expect(finish.status).toBe(0);
			expect(`${finish.stdout}\n${finish.stderr}`).toContain('diagnostic global refs');
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('rejects legacy baseline schemas without deleting them', () => {
		const repoRoot = createRepo();
		try {
			mkdirSync(path.join(repoRoot, '.agent', 'tmp'), { recursive: true });
			writeFileSync(
				baselinePath(repoRoot),
				`${JSON.stringify({ head: 'abc', stagedDiffHash: 'def' }, null, 2)}\n`,
				'utf8',
			);
			const finish = runGitSafety(repoRoot, ['finish']);
			expect(finish.status).toBe(1);
			expect(existsSync(baselinePath(repoRoot))).toBe(true);
			expect(`${finish.stdout}\n${finish.stderr}`).toContain('legacy/incompatible baseline');
			expect(`${finish.stdout}\n${finish.stderr}`).toContain('One-time operator migration');

			const start = runGitSafety(repoRoot, ['start']);
			expect(start.status).toBe(1);
			expect(existsSync(baselinePath(repoRoot))).toBe(true);
			expect(`${start.stdout}\n${start.stderr}`).toContain('legacy/incompatible baseline');
			expect(`${start.stdout}\n${start.stderr}`).toContain('One-time operator migration');
			expect(JSON.parse(readFileSync(baselinePath(repoRoot), 'utf8')).stagedDiffHash).toBe(
				'def',
			);
		} finally {
			cleanupFixture(repoRoot);
		}
	});
});
