const mockRunCleanup = jest.fn();
const mockEnv: Record<string, string> = {};

jest.mock('@/lib/memories/server/cleanup.service', () => ({
	runMemoriesCleanup: mockRunCleanup,
}));

jest.mock('@/lib/server/env', () => ({
	getEnv: (key: string) => mockEnv[key] ?? '',
}));

import type { MemoriesCleanupResult } from '@/lib/memories/server/cleanup.service';
import { GET } from '@/pages/api/cron/memories-cleanup';

const CRON_SECRET = 'cron-test-secret';
const ROUTE_URL = 'https://celebra-me.com/api/cron/memories-cleanup';

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
		runId: string;
		completedAt: string | null;
		payload: Record<string, unknown>;
		commitSha?: string;
		deploymentId?: string;
	};
}

function context(authorization?: string) {
	const headers: Record<string, string> = { 'x-vercel-id': 'sfo1::abc-123' };
	if (authorization !== undefined) headers.authorization = authorization;
	return { request: new Request(ROUTE_URL, { headers }) } as Parameters<typeof GET>[0];
}

function resetEnv(overrides: Record<string, string> = {}) {
	for (const key of Object.keys(mockEnv)) delete mockEnv[key];
	Object.assign(
		mockEnv,
		{
			CRON_SECRET,
			VERCEL_ENV: 'preview',
			VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40),
			VERCEL_DEPLOYMENT_ID: 'dpl_1234567890',
		},
		overrides,
	);
}

function evidenceLines(spy: jest.SpiedFunction<typeof console.info>): EvidenceLine[] {
	return spy.mock.calls
		.map((call) => call[0])
		.filter((value): value is string => typeof value === 'string' && value.startsWith('{'))
		.map((value) => JSON.parse(value) as EvidenceLine);
}

describe('GET /api/cron/memories-cleanup', () => {
	let infoSpy: jest.SpiedFunction<typeof console.info>;
	let warnSpy: jest.SpiedFunction<typeof console.warn>;
	let errorSpy: jest.SpiedFunction<typeof console.error>;

	beforeEach(() => {
		jest.clearAllMocks();
		resetEnv();
		infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
		warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	it('rejects a wrong bearer with a JSON 401 without starting a run', async () => {
		const response = await GET(context('Bearer wrong-secret'));

		expect(response.status).toBe(401);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		await expect(response.json()).resolves.toEqual({
			success: false,
			error: { code: 'unauthorized', message: 'Unauthorized.' },
		});
		expect(mockRunCleanup).not.toHaveBeenCalled();
		expect(infoSpy).not.toHaveBeenCalled();
	});

	it('rejects a missing header and an unconfigured secret', async () => {
		expect((await GET(context())).status).toBe(401);
		resetEnv({ CRON_SECRET: '' });
		expect((await GET(context('Bearer '))).status).toBe(401);
		expect(mockRunCleanup).not.toHaveBeenCalled();
	});

	it('returns the result and logs a started plus completed evidence pair', async () => {
		mockRunCleanup.mockResolvedValue(healthyResult);

		const response = await GET(context(`Bearer ${CRON_SECRET}`));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual(healthyResult);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(mockRunCleanup).toHaveBeenCalledTimes(1);
		expect(warnSpy).not.toHaveBeenCalled();
		expect(errorSpy).not.toHaveBeenCalled();

		const lines = evidenceLines(infoSpy);
		expect(lines).toHaveLength(2);
		const [started, completed] = lines;
		expect(started).toMatchObject({
			event: 'memories_cleanup_summary',
			phase: 'started',
			evidence: {
				status: 'UNVERIFIED',
				reasonCode: 'cleanup_started',
				environment: 'preview',
				completedAt: null,
				payload: { invocation_id: 'sfo1::abc-123', claimed: null },
			},
		});
		expect(completed).toMatchObject({
			event: 'memories_cleanup_summary',
			phase: 'completed',
			evidence: {
				status: 'VERIFIED',
				reasonCode: 'cleanup_completed',
				environment: 'preview',
				commitSha: 'b'.repeat(40),
				deploymentId: 'dpl_1234567890',
				payload: {
					invocation_id: 'sfo1::abc-123',
					claimed: 3,
					deleted: 3,
					failed: 0,
					anonymized: 2,
					audit_purged: 4,
					count_invariant_valid: true,
				},
			},
		});
		expect(completed.evidence.runId).toBe(started.evidence.runId);
		expect(typeof completed.evidence.completedAt).toBe('string');
	});

	it('logs a warning summary for partial failures but still succeeds', async () => {
		mockRunCleanup.mockResolvedValue({ ...healthyResult, deleted: 2, failed: 1 });

		const response = await GET(context(`Bearer ${CRON_SECRET}`));

		expect(response.status).toBe(200);
		expect(infoSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(String(warnSpy.mock.calls[0][0])).toContain('cleanup_partial_failure');
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it('fails closed with a 503 when the counts break the invariant', async () => {
		mockRunCleanup.mockResolvedValue({ ...healthyResult, deleted: 2, failed: 0 });

		const response = await GET(context(`Bearer ${CRON_SECRET}`));

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toMatchObject({
			error: { code: 'service_unavailable' },
		});
		const serialized = errorSpy.mock.calls
			.map((call) => call[0])
			.find((value): value is string => typeof value === 'string' && value.startsWith('{'));
		expect(serialized).toContain('cleanup_count_invariant_failed');
		expect(serialized).toContain('"status":"FAILED"');
	});

	it('answers a thrown cleanup with a 503 and a sanitized failed evidence line', async () => {
		mockRunCleanup.mockRejectedValue(
			new Error('https://storage.example.invalid/object?token=secret'),
		);

		const response = await GET(context(`Bearer ${CRON_SECRET}`));

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({
			success: false,
			error: { code: 'service_unavailable', message: 'La limpieza no pudo completarse.' },
		});
		expect(infoSpy).toHaveBeenCalledTimes(1);
		const failedLine = errorSpy.mock.calls
			.map((call) => call[0])
			.find((value): value is string => typeof value === 'string' && value.startsWith('{'));
		expect(failedLine).toBeDefined();
		const parsed = JSON.parse(failedLine ?? '{}') as EvidenceLine;
		expect(parsed).toMatchObject({
			event: 'memories_cleanup_summary',
			phase: 'completed',
			evidence: { status: 'FAILED', reasonCode: 'cleanup_exception', environment: 'preview' },
		});
		expect(failedLine).not.toContain('storage.example.invalid');
		expect(failedLine).not.toContain('token=secret');
	});

	it('derives the evidence environment from VERCEL_ENV', async () => {
		mockRunCleanup.mockResolvedValue(healthyResult);

		resetEnv({ VERCEL_ENV: 'production' });
		await GET(context(`Bearer ${CRON_SECRET}`));
		expect(evidenceLines(infoSpy).map((line) => line.evidence.environment)).toEqual([
			'production',
			'production',
		]);

		infoSpy.mockClear();
		resetEnv({ VERCEL_ENV: '' });
		await GET(context(`Bearer ${CRON_SECRET}`));
		expect(evidenceLines(infoSpy).map((line) => line.evidence.environment)).toEqual([
			'local',
			'local',
		]);
	});
});
