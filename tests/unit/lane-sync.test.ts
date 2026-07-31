/**
 * lane-sync.test.ts — Hermetic contracts for deterministic lane-sync observability.
 */

import { describe, expect, it } from '@jest/globals';
import { runLaneSync } from '../../scripts/agent/lane-sync.ts';

describe('lane:sync observability', () => {
	it('shows managed status after already-aligned synchronization', () => {
		const result = runLaneSync({
			cwd: '/tmp/fake',
			runGit: (args) => {
				if (args[0] === 'fetch') return { status: 0, stdout: '', stderr: '' };
				if (args[0] === 'rev-list') return { status: 0, stdout: '0\n', stderr: '' };
				return { status: 1, stdout: '', stderr: `unexpected git ${args.join(' ')}` };
			},
			runStatus: () => ({
				status: 0,
				stdout: 'CONTENT\nLocal       UNVERIFIED\n\nSCHEMA\nLocal       CURRENT\n',
				stderr: '',
			}),
		});
		expect(result.gitOk).toBe(true);
		expect(result.gitMode).toBe('already-aligned');
		expect(result.statusRan).toBe(true);
		expect(result.stdout).toContain('already aligned');
		expect(result.stdout).toContain('CONTENT');
	});

	it('still succeeds when remote managed status is unavailable', () => {
		const result = runLaneSync({
			runGit: (args) => {
				if (args[0] === 'fetch') return { status: 0, stdout: '', stderr: '' };
				if (args[0] === 'rev-list') return { status: 0, stdout: '0\n', stderr: '' };
				return { status: 1, stdout: '', stderr: 'unexpected' };
			},
			runStatus: () => ({
				status: 1,
				stdout: '',
				stderr: 'Managed status timed out waiting for remote environments (read-only; ignored).',
			}),
		});
		expect(result.gitOk).toBe(true);
		expect(result.statusRan).toBe(true);
		expect(result.stdout).toContain('Managed status timed out');
	});

	it('honors CELEBRA_SKIP_MANAGED_STATUS after successful sync', () => {
		const previous = process.env.CELEBRA_SKIP_MANAGED_STATUS;
		process.env.CELEBRA_SKIP_MANAGED_STATUS = '1';
		try {
			const result = runLaneSync({
				runGit: (args) => {
					if (args[0] === 'fetch') return { status: 0, stdout: '', stderr: '' };
					if (args[0] === 'rev-list') return { status: 0, stdout: '2\n', stderr: '' };
					if (args[0] === 'rebase') return { status: 0, stdout: 'Successfully rebased.\n', stderr: '' };
					return { status: 1, stdout: '', stderr: 'unexpected' };
				},
				runStatus: () => {
					throw new Error('status should not run');
				},
			});
			expect(result.gitOk).toBe(true);
			expect(result.gitMode).toBe('rebase');
			expect(result.statusRan).toBe(false);
			expect(result.statusSkippedReason).toContain('CELEBRA_SKIP_MANAGED_STATUS');
		} finally {
			if (previous === undefined) delete process.env.CELEBRA_SKIP_MANAGED_STATUS;
			else process.env.CELEBRA_SKIP_MANAGED_STATUS = previous;
		}
	});

	it('fails closed when git rebase fails and does not run status', () => {
		const result = runLaneSync({
			runGit: (args) => {
				if (args[0] === 'fetch') return { status: 0, stdout: '', stderr: '' };
				if (args[0] === 'rev-list') return { status: 0, stdout: '1\n', stderr: '' };
				if (args[0] === 'rebase')
					return { status: 1, stdout: '', stderr: 'CONFLICT (content): merge conflict' };
				return { status: 1, stdout: '', stderr: 'unexpected' };
			},
			runStatus: () => {
				throw new Error('status should not run');
			},
		});
		expect(result.gitOk).toBe(false);
		expect(result.statusRan).toBe(false);
		expect(result.statusSkippedReason).toBe('git-rebase-failed');
	});
});
