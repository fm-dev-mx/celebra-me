import type { MemoriesCleanupResult } from '@/lib/memories/server/cleanup.service';
import { runMemoriesCleanupJob } from '@/lib/memories/server/cleanup-job';

jest.mock('@/lib/memories/server/cleanup.service', () => ({
	runMemoriesCleanup: jest.fn(),
}));
jest.mock('@/lib/environment', () => ({
	isDevEnvironment: () => false,
	readBuildIdentity: () => ({ commitSha: null, gitRef: null }),
}));

const healthyResult: MemoriesCleanupResult = {
	validationSettled: 1,
	validationRejected: 0,
	uploadsRescued: 0,
	uploadsReleased: 2,
	inFlightPending: 0,
	settleComplete: true,
	expiredContent: 1,
	claimed: 3,
	deleted: 3,
	failed: 0,
	anonymized: 2,
	auditPurged: 4,
};

interface EvidenceLine {
	event: string;
	phase: 'started' | 'completed';
	evidence: {
		status: string;
		reasonCode: string;
		environment: string;
		source: string;
		runId: string;
		startedAt: string;
		completedAt: string | null;
		commitSha?: string;
	};
}

function createLog() {
	return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function parse(mock: jest.Mock): EvidenceLine[] {
	return mock.mock.calls.map((call) => JSON.parse(String(call[0])) as EvidenceLine);
}

describe('runMemoriesCleanupJob', () => {
	it('refuses to run without a declared deploy identity', async () => {
		const cleanup = jest.fn();
		const log = createLog();
		const outcome = await runMemoriesCleanupJob({
			cleanup,
			log,
			readDeployEnvironment: () => null,
		});
		expect(outcome).toEqual({ kind: 'identity_missing' });
		expect(cleanup).not.toHaveBeenCalled();
		expect(log.info).not.toHaveBeenCalled();
	});

	it('logs a started and a completed line with the given source and run identity', async () => {
		const log = createLog();
		const clock = [new Date('2026-10-14T10:00:00.000Z'), new Date('2026-10-14T10:00:05.000Z')];
		const outcome = await runMemoriesCleanupJob({
			source: 'worker_scheduled',
			cleanup: async () => healthyResult,
			log,
			readDeployEnvironment: () => 'preview',
			readCommitSha: () => 'a'.repeat(40),
			now: () => clock.shift() ?? new Date('2026-10-14T10:00:05.000Z'),
			createRunId: () => 'run-1',
		});

		expect(outcome).toMatchObject({ kind: 'completed', result: healthyResult });
		expect(log.warn).not.toHaveBeenCalled();
		expect(log.error).not.toHaveBeenCalled();
		const [started, completed] = parse(log.info);
		expect(started).toMatchObject({
			event: 'memories_cleanup_summary',
			phase: 'started',
			evidence: {
				status: 'UNVERIFIED',
				reasonCode: 'cleanup_started',
				environment: 'preview',
				source: 'worker_scheduled',
				runId: 'run-1',
				startedAt: '2026-10-14T10:00:00.000Z',
				completedAt: null,
			},
		});
		expect(completed).toMatchObject({
			phase: 'completed',
			evidence: {
				status: 'VERIFIED',
				reasonCode: 'cleanup_completed',
				source: 'worker_scheduled',
				runId: 'run-1',
				completedAt: '2026-10-14T10:00:05.000Z',
				commitSha: 'a'.repeat(40),
			},
		});
	});

	it('defaults the source to the scheduled cron', async () => {
		const log = createLog();
		await runMemoriesCleanupJob({
			cleanup: async () => healthyResult,
			log,
			readDeployEnvironment: () => 'production',
		});
		expect(parse(log.info).map((line) => line.evidence.source)).toEqual([
			'scheduled_cron',
			'scheduled_cron',
		]);
	});

	it('warns on partial failures but still completes', async () => {
		const log = createLog();
		const outcome = await runMemoriesCleanupJob({
			cleanup: async () => ({ ...healthyResult, deleted: 2, failed: 1 }),
			log,
			readDeployEnvironment: () => 'preview',
		});
		expect(outcome.kind).toBe('completed');
		expect(log.info).toHaveBeenCalledTimes(1);
		expect(parse(log.warn)[0]?.evidence.reasonCode).toBe('cleanup_partial_failure');
	});

	it('reports inconsistent counts as a FAILED evidence line', async () => {
		const log = createLog();
		const outcome = await runMemoriesCleanupJob({
			cleanup: async () => ({ ...healthyResult, deleted: 2, failed: 0 }),
			log,
			readDeployEnvironment: () => 'preview',
		});
		expect(outcome.kind).toBe('inconsistent');
		expect(parse(log.error)[0]?.evidence).toMatchObject({
			status: 'FAILED',
			reasonCode: 'cleanup_count_invariant_failed',
		});
	});

	it('turns a thrown cleanup into a sanitized failed line', async () => {
		const log = createLog();
		const outcome = await runMemoriesCleanupJob({
			cleanup: async () => {
				throw new Error('https://storage.example.invalid/object?token=secret');
			},
			log,
			readDeployEnvironment: () => 'preview',
		});
		expect(outcome.kind).toBe('exception');
		const line = String(log.error.mock.calls[0]?.[0]);
		expect(JSON.parse(line)).toMatchObject({
			phase: 'completed',
			evidence: { status: 'FAILED', reasonCode: 'cleanup_exception' },
		});
		expect(line).not.toContain('storage.example.invalid');
		expect(line).not.toContain('token=secret');
	});
});
