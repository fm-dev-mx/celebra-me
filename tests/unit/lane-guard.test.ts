import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cleanupFixture, createLaneFixture } from '../helpers/git-fixture';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const GUARD_PATH = path.join(process.cwd(), 'scripts', 'agent', 'lane-guard.mjs');
const parents: string[] = [];

afterAll(() => {
	for (const parent of parents) cleanupFixture(parent);
});

function git(cwd: string, args: string[]) {
	return runCommand('git', args, { cwd, env: sanitizeEnv() });
}

function runGuard(cwd: string, commit = false) {
	return runCommand(process.execPath, [GUARD_PATH, ...(commit ? ['--commit'] : [])], {
		cwd,
		allowFailure: true,
		env: sanitizeEnv(),
	});
}

function newParent() {
	const parent = mkdtempSync(path.join(tmpdir(), 'lane-guard-'));
	parents.push(parent);
	return parent;
}

/** Integration checkout (segment null) or a linked lane worktree, as on a real machine. */
function createCheckout(segment: string | null) {
	return createLaneFixture(newParent(), segment, 'Lane Guard Tester');
}

/** Linked worktree at `<integration>/<relative>`, outside `<repo>-worktrees/`. */
function createLooseWorktree(...relative: string[]) {
	const integration = createCheckout(null);
	const loose = path.join(integration, ...relative);
	git(integration, ['worktree', 'add', '--detach', loose]);
	return loose;
}

describe('lane guard', () => {
	it('refuses an unknown checkout and names the canonical lanes', () => {
		const checkout = createLooseWorktree('..', 'scratch-checkout');
		const result = runGuard(checkout);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('lane: unknown');
		expect(result.stderr).toContain('f12-release (Win + F12)');
	});

	it('refuses a tool-managed .claude/worktrees checkout', () => {
		const checkout = createLooseWorktree('.claude', 'worktrees', 'task-1a2b3c');
		const result = runGuard(checkout);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('lane: unknown');
	});

	it('accepts a canonical lane on a task branch', () => {
		const checkout = createCheckout('f06-landing');
		expect(runGuard(checkout).status).toBe(0);
	});

	it('refuses commits on develop from an external lane', () => {
		const checkout = createCheckout('f12-release');
		git(checkout, ['switch', '--ignore-other-worktrees', 'develop']);
		expect(runGuard(checkout).status).toBe(0);
		const result = runGuard(checkout, true);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('Direct task commits on develop are forbidden');
	});

	it('inspects the checkout even when a hook passes inherited Git location variables', () => {
		const integration = createCheckout(null);
		const lane = createCheckout('f06-landing');
		// Without the scrub, GIT_DIR would report Integration's develop and refuse the commit.
		const result = runCommand(process.execPath, [GUARD_PATH, '--commit'], {
			cwd: lane,
			allowFailure: true,
			env: { ...sanitizeEnv(), GIT_DIR: path.join(integration, '.git') },
		});
		expect(result.status).toBe(0);
	});

	it('accepts Integration on develop and refuses it on a task branch', () => {
		const checkout = createCheckout(null);
		expect(runGuard(checkout).status).toBe(0);
		expect(runGuard(checkout, true).stderr).toContain('direct task commits are forbidden');

		git(checkout, ['switch', '-c', 'feat/task']);
		const result = runGuard(checkout);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('Integration (Win + F5) only takes commits on develop');
	});

	it('accepts concluding a merge in Integration', () => {
		const checkout = createCheckout(null);
		git(checkout, ['switch', '-c', 'release/candidate']);
		writeFileSync(path.join(checkout, 'README.md'), '# candidate\n', 'utf8');
		git(checkout, ['commit', '-am', 'candidate']);
		git(checkout, ['switch', 'develop']);
		writeFileSync(path.join(checkout, 'README.md'), '# develop\n', 'utf8');
		git(checkout, ['commit', '-am', 'develop']);
		runCommand('git', ['merge', 'release/candidate'], {
			cwd: checkout,
			env: sanitizeEnv(),
			allowFailure: true,
		});
		// The conflicting README leaves the merge open, as a hand-resolved integration would.
		git(checkout, ['rev-parse', '-q', '--verify', 'MERGE_HEAD']);

		expect(runGuard(checkout, true).status).toBe(0);
	});
});
