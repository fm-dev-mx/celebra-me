/**
 * lane-sync.test.ts — Hermetic contracts for deterministic lane-sync observability.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { runLaneSync } from '../../scripts/agent/lane-sync.ts';

describe('lane:sync observability', () => {
	it('defaults to a read-only synchronization preview without fetch', () => {
		const calls: string[][] = [];
		const result = runLaneSync({
			cwd: '/tmp/fake',
			runGit: (args) => {
				calls.push(args);
				if (args[0] === 'rev-list') return { status: 0, stdout: '0\n', stderr: '' };
				return { status: 1, stdout: '', stderr: `unexpected git ${args.join(' ')}` };
			},
			runStatus: () => ({
				status: 0,
				stdout: 'CONTENT\nLocal       UNVERIFIED\n',
				stderr: '',
			}),
		});
		expect(result.gitOk).toBe(true);
		expect(result.gitMode).toBe('dry-run');
		expect(result.statusRan).toBe(true);
		expect(result.stdout).toContain('dry-run');
		expect(result.stdout).toContain('CONTENT');
		expect(calls.some((args) => args[0] === 'fetch')).toBe(false);
	});

	it('fails closed when mutation is requested without apply authorization', () => {
		const result = runLaneSync({ dryRun: false });
		expect(result.gitOk).toBe(false);
		expect(result.statusSkippedReason).toBe('apply-required');
		expect(result.stdout).toContain('requires explicit --apply');
	});

	it('reports an unavailable local develop ref as UNVERIFIED', () => {
		const result = runLaneSync({
			runGit: () => ({ status: 1, stdout: '', stderr: 'origin/develop unavailable' }),
			runStatus: () => ({ status: 0, stdout: '', stderr: '' }),
		});
		expect(result.gitOk).toBe(false);
		expect(result.statusSkippedReason).toBe('develop-ref-unavailable');
		expect(result.stdout).toContain('UNVERIFIED');
		expect(result.statusRan).toBe(false);
	});

	it('honors managed-status opt-out after a read-only preview', () => {
		const previous = process.env.CELEBRA_SKIP_MANAGED_STATUS;
		process.env.CELEBRA_SKIP_MANAGED_STATUS = '1';
		try {
			const result = runLaneSync({
				runGit: (args) =>
					args[0] === 'rev-list'
						? { status: 0, stdout: '2\n', stderr: '' }
						: { status: 1, stdout: '', stderr: 'unexpected' },
				runStatus: () => {
					throw new Error('status should not run');
				},
			});
			expect(result.gitOk).toBe(true);
			expect(result.gitMode).toBe('dry-run');
			expect(result.statusRan).toBe(false);
			expect(result.statusSkippedReason).toContain('CELEBRA_SKIP_MANAGED_STATUS');
		} finally {
			if (previous === undefined) delete process.env.CELEBRA_SKIP_MANAGED_STATUS;
			else process.env.CELEBRA_SKIP_MANAGED_STATUS = previous;
		}
	});

	it('fails closed when the local develop ref is unavailable', () => {
		const result = runLaneSync({
			runGit: (args) =>
				args[0] === 'rev-list'
					? { status: 1, stdout: '', stderr: 'missing ref' }
					: { status: 1, stdout: '', stderr: 'unexpected' },
			runStatus: () => {
				throw new Error('status should not run');
			},
		});
		expect(result.gitOk).toBe(false);
		expect(result.statusRan).toBe(false);
		expect(result.statusSkippedReason).toBe('develop-ref-unavailable');
	});

	it('requires a clean lane and Git Safety baseline for --apply', () => {
		const result = runLaneSync({
			apply: true,
			cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'lane-sync-missing-baseline-')),
			runGit: (args) =>
				args[0] === 'status'
					? { status: 0, stdout: '', stderr: '' }
					: args[0] === 'rev-parse'
						? { status: 0, stdout: 'feature/test\n', stderr: '' }
						: { status: 1, stdout: '', stderr: 'unexpected' },
		});
		expect(result.gitOk).toBe(false);
		expect(result.statusSkippedReason).toBe('missing-git-safety-baseline');
		expect(result.stdout).toContain('BLOCKED');
	});

	function applyFixture(baselineName = 'git-safety-baseline.json') {
		const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-sync-apply-'));
		fs.mkdirSync(path.join(cwd, '.agent', 'tmp'), { recursive: true });
		fs.writeFileSync(
			path.join(cwd, '.agent', 'tmp', baselineName),
			JSON.stringify({ branch: 'feature/test', head: 'abc123' }),
		);
		return cwd;
	}

	function gitRunner(options: { published?: boolean; calls?: string[][] } = {}) {
		return (args: string[]) => {
			options.calls?.push(args);
			if (args[0] === 'status') return { status: 0, stdout: '', stderr: '' };
			if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref')
				return { status: 0, stdout: 'feature/test', stderr: '' };
			if (args[0] === 'rev-parse' && args[1] === '--verify')
				return { status: options.published ? 0 : 1, stdout: '', stderr: '' };
			if (args[0] === 'rev-parse') return { status: 0, stdout: 'abc123', stderr: '' };
			if (args[0] === 'fetch') return { status: 0, stdout: '', stderr: '' };
			if (args[0] === 'rev-list') return { status: 0, stdout: '1', stderr: '' };
			if (args[0] === 'merge') return { status: 0, stdout: 'merged', stderr: '' };
			if (args[0] === 'rebase') return { status: 0, stdout: 'rebased', stderr: '' };
			return { status: 1, stdout: '', stderr: `unexpected git ${args.join(' ')}` };
		};
	}

	it('merges origin/develop by default after matching preflight', () => {
		const calls: string[][] = [];
		const result = runLaneSync({
			apply: true,
			cwd: applyFixture(),
			runGit: gitRunner({ calls }),
			runStatus: () => ({ status: 0, stdout: 'status', stderr: '' }),
		});
		expect(result.gitOk).toBe(true);
		expect(result.gitMode).toBe('merge');
		expect(result.statusRan).toBe(true);
		expect(calls).toContainEqual(['merge', '--no-edit', 'origin/develop']);
		expect(calls.some((args) => args[0] === 'rebase')).toBe(false);
	});

	it('accepts a per-session Git Safety baseline', () => {
		const result = runLaneSync({
			apply: true,
			cwd: applyFixture('git-safety-baseline.feature-test.json'),
			runGit: gitRunner(),
			skipStatus: true,
		});
		expect(result.gitOk).toBe(true);
		expect(result.gitMode).toBe('merge');
	});

	it('refuses an opt-in rebase of a branch that exists on origin', () => {
		const calls: string[][] = [];
		const result = runLaneSync({
			apply: true,
			rebase: true,
			cwd: applyFixture(),
			runGit: gitRunner({ published: true, calls }),
			skipStatus: true,
		});
		expect(result.gitOk).toBe(false);
		expect(result.statusSkippedReason).toBe('rebase-published');
		expect(calls.some((args) => args[0] === 'rebase')).toBe(false);
	});

	it('rebases an unpublished branch only on request', () => {
		const result = runLaneSync({
			apply: true,
			rebase: true,
			cwd: applyFixture(),
			runGit: gitRunner(),
			skipStatus: true,
		});
		expect(result.gitOk).toBe(true);
		expect(result.gitMode).toBe('rebase');
		expect(result.stdout).toContain('rebased');
	});

	it('rejects conflicting sync modes', () => {
		const result = runLaneSync({
			apply: true,
			rebase: true,
			ffOnly: true,
			cwd: applyFixture(),
		});
		expect(result.gitOk).toBe(false);
		expect(result.statusSkippedReason).toBe('conflicting-sync-modes');
	});
});
