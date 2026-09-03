import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { inspectLane } from '../../scripts/agent/worktree-status.ts';

const lane = {
	name: 'Test lane',
	path: process.cwd(),
	runtimeDefault: 'local' as const,
	defaultBranch: 'ephemeral',
};

describe('worktree status contract', () => {
	it('never reports clean when Git status is unavailable', () => {
		const result = inspectLane(lane, (args) => {
			if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref')
				return { status: 0, stdout: 'feature/test', stderr: '' };
			if (args[0] === 'rev-parse') return { status: 0, stdout: 'abc123', stderr: '' };
			return { status: 1, stdout: '', stderr: 'git status unavailable' };
		});

		expect(result.inspection).toBe('unavailable');
		expect(result.state).toBe('unknown');
		expect(result.state).not.toBe('clean');
		expect(result.diagnostics).toContain('working-tree inspection failed');
	});

	it('reports dirty state without treating it as an inspection failure', () => {
		const result = inspectLane(lane, (args) => {
			if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref')
				return { status: 0, stdout: 'feature/test', stderr: '' };
			if (args[0] === 'rev-parse') return { status: 0, stdout: 'abc123', stderr: '' };
			if (args[0] === 'status') return { status: 0, stdout: ' M file.ts', stderr: '' };
			if (args[0] === 'rev-list') return { status: 0, stdout: '0 0', stderr: '' };
			return { status: 0, stdout: 'abc123', stderr: '' };
		});

		expect(result.inspection).toBe('ok');
		expect(result.state).toBe('dirty');
		expect(result.modifiedCount).toBe(1);
		expect(result.relation).toBe('up to date with develop');
	});

	it('keeps inspection available when only the develop relation is unverified', () => {
		const result = inspectLane(lane, (args) => {
			if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref')
				return { status: 0, stdout: 'feature/test', stderr: '' };
			if (args[0] === 'rev-parse' && args[1] === '--short' && args[2] === 'HEAD')
				return { status: 0, stdout: 'abc123', stderr: '' };
			if (args[0] === 'rev-parse') return { status: 1, stdout: '', stderr: 'ref unavailable' };
			if (args[0] === 'status') return { status: 0, stdout: '', stderr: '' };
			return { status: 1, stdout: '', stderr: 'relation unavailable' };
		});

		expect(result.inspection).toBe('ok');
		expect(result.state).toBe('clean');
		expect(result.relation).toBe('UNVERIFIED');
		expect(result.diagnostics).toContain('develop ref unavailable; relation is UNVERIFIED');
	});

	it('returns unavailable for a missing expected lane', () => {
		const result = inspectLane({ ...lane, path: path.join(process.cwd(), '.missing-worktree-for-test') });

		expect(result.exists).toBe(false);
		expect(result.inspection).toBe('unavailable');
		expect(result.state).toBe('unknown');
		expect(result.relation).toBe('UNVERIFIED');
	});
});
