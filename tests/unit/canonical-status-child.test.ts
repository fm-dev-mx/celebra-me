import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));

import { spawn } from 'node:child_process';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	CANONICAL_STATUS_MAX_STDOUT_BYTES,
	refreshCanonicalStatusView,
	resetCanonicalStatusRuntimeForTests,
	runCanonicalStatusChild,
	setCanonicalStatusChildRunnerForTests,
} from '@/lib/status/server/canonical-status';
import { buildCanonicalStatusViewFixture } from '@tests/helpers/canonical-status-fixture';

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

function childFixture() {
	const child = new EventEmitter() as EventEmitter & {
		stdout: EventEmitter & { setEncoding: jest.Mock };
		stderr: EventEmitter & { setEncoding: jest.Mock };
		kill: jest.Mock;
	};
	child.stdout = Object.assign(new EventEmitter(), { setEncoding: jest.fn() });
	child.stderr = Object.assign(new EventEmitter(), { setEncoding: jest.fn() });
	child.kill = jest.fn();
	return child;
}

function childDiagnostic(error: unknown): Record<string, unknown> {
	expect(error).toBeInstanceOf(ApiError);
	return (error as ApiError).details?.statusProbe as Record<string, unknown>;
}

async function expectChildFailure(
	promise: Promise<unknown>,
	assert: (error: unknown) => void,
): Promise<void> {
	try {
		await promise;
		throw new Error('Expected status child to reject.');
	} catch (error) {
		assert(error);
	}
}

afterEach(() => {
	jest.useRealTimers();
	jest.clearAllMocks();
	resetCanonicalStatusRuntimeForTests();
});

describe('canonical status child process failures', () => {
	it('returns a redacted, bounded diagnostic for a non-zero child exit', async () => {
		const child = childFixture();
		mockSpawn.mockReturnValue(child as never);
		const promise = runCanonicalStatusChild([], 1000);
		child.stderr.emit(
			'data',
			'password=super-secret postgresql://postgres:secret@db.example.supabase.co/postgres',
		);
		child.emit('close', 1);

		await expectChildFailure(promise, (error) => {
			const diagnostic = childDiagnostic(error);
			expect(diagnostic.code).toBe('STATUS_PROBE_EXIT_NONZERO');
			expect(diagnostic.evidence).toBe('UNVERIFIED');
			expect(JSON.stringify(diagnostic)).not.toContain('super-secret');
			expect(JSON.stringify(diagnostic)).not.toContain('postgresql://');
		});
	});

	it('classifies invalid JSON and excessive output without reflecting raw output', async () => {
		const invalidChild = childFixture();
		mockSpawn.mockReturnValueOnce(invalidChild as never);
		const invalid = runCanonicalStatusChild([], 1000);
		invalidChild.stdout.emit('data', '{ not-json }');
		invalidChild.emit('close', 0);
		await expectChildFailure(invalid, (error) => {
			expect(childDiagnostic(error).code).toBe('STATUS_PROBE_INVALID_JSON');
		});

		const excessiveChild = childFixture();
		mockSpawn.mockReturnValueOnce(excessiveChild as never);
		const excessive = runCanonicalStatusChild([], 1000);
		excessiveChild.stdout.emit('data', 'x'.repeat(CANONICAL_STATUS_MAX_STDOUT_BYTES + 1));
		excessiveChild.emit('close', 0);
		await expectChildFailure(excessive, (error) => {
			const diagnostic = childDiagnostic(error);
			expect(diagnostic.code).toBe('STATUS_PROBE_OUTPUT_EXCESSIVE');
			expect(String(diagnostic.detail).length).toBeLessThanOrEqual(512);
		});
	});

	it('times out with a bounded diagnostic and terminates the child', async () => {
		jest.useFakeTimers();
		const child = childFixture();
		mockSpawn.mockReturnValue(child as never);
		const promise = runCanonicalStatusChild([], 10);
		jest.advanceTimersByTime(10);

		await expectChildFailure(promise, (error) => {
			expect(childDiagnostic(error).code).toBe('STATUS_PROBE_TIMEOUT');
		});
		expect(child.kill).toHaveBeenCalledWith('SIGTERM');
	});
});

describe('canonical status refresh coalescing', () => {
	it('coalesces concurrent identical remote refreshes into one child probe', async () => {
		let resolveProbe: ((value: unknown) => void) | undefined;
		const runner = jest.fn(
			() =>
				new Promise<unknown>((resolve) => {
					resolveProbe = resolve;
				}),
		);
		setCanonicalStatusChildRunnerForTests(runner);

		const first = refreshCanonicalStatusView({ env: 'preview', domain: 'content' });
		const second = refreshCanonicalStatusView({ env: 'preview', domain: 'content' });
		await Promise.resolve();
		expect(runner).toHaveBeenCalledTimes(1);
		resolveProbe?.(buildCanonicalStatusViewFixture());

		const [one, two] = await Promise.all([first, second]);
		expect(one).toEqual(two);
		expect(runner).toHaveBeenCalledTimes(1);
	});
});
