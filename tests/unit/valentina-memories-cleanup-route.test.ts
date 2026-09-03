const mockCleanupValentinaMemoryObjects = jest.fn();
const mockGetEnv = jest.fn(() => 'cron-test-secret');

jest.mock('@/lib/memories/valentina-memories-cleanup.service', () => ({
	cleanupValentinaMemoryObjects: mockCleanupValentinaMemoryObjects,
}));
jest.mock('@/lib/server/env', () => ({ getEnv: mockGetEnv }));

import { GET } from '@/pages/api/cron/valentina-memories-cleanup';

function context(secret = 'cron-test-secret') {
	return {
		request: new Request('https://www.celebra-me.com/api/cron/valentina-memories-cleanup', {
			headers: {
				authorization: `Bearer ${secret}`,
				'x-vercel-id': 'sfo1::invocation-123',
			},
		}),
	} as Parameters<typeof GET>[0];
}

describe('Valentina cleanup cron evidence', () => {
	let infoSpy: jest.SpiedFunction<typeof console.info>;
	let warnSpy: jest.SpiedFunction<typeof console.warn>;
	let errorSpy: jest.SpiedFunction<typeof console.error>;

	beforeEach(() => {
		jest.clearAllMocks();
		infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
		warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		infoSpy.mockRestore();
		warnSpy.mockRestore();
		errorSpy.mockRestore();
	});

	it('rejects unauthorized requests without starting an operation', async () => {
		const response = await GET(context('wrong-secret'));

		expect(response.status).toBe(401);
		expect(mockCleanupValentinaMemoryObjects).not.toHaveBeenCalled();
		expect(infoSpy).not.toHaveBeenCalled();
	});

	it('emits one start and one warning summary for partial deletion', async () => {
		mockCleanupValentinaMemoryObjects.mockResolvedValue({
			validationReconciled: 1,
			validationPending: 2,
			expiredReservations: 0,
			claimed: 3,
			deleted: 2,
			failed: 1,
			auditPurged: 0,
		});

		const response = await GET(context());

		expect(response.status).toBe(200);
		expect(infoSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(String(warnSpy.mock.calls[0]?.[0])).toContain('cleanup_partial_failure');
	});

	it('fails closed when aggregate deletion counts violate the invariant', async () => {
		mockCleanupValentinaMemoryObjects.mockResolvedValue({
			validationReconciled: 0,
			validationPending: 0,
			expiredReservations: 0,
			claimed: 3,
			deleted: 2,
			failed: 0,
			auditPurged: 0,
		});

		const response = await GET(context());

		expect(response.status).toBe(503);
		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(String(errorSpy.mock.calls[0]?.[0])).toContain('cleanup_count_invariant_failed');
	});

	it('emits a sanitized failed completion when cleanup throws', async () => {
		mockCleanupValentinaMemoryObjects.mockRejectedValue(
			new Error('https://storage.example.com/object?token=secret'),
		);

		const response = await GET(context());

		expect(response.status).toBe(503);
		expect(errorSpy).toHaveBeenCalledTimes(1);
		const serialized = String(errorSpy.mock.calls[0]?.[0]);
		expect(serialized).toContain('cleanup_exception');
		expect(serialized).not.toContain('storage.example.com');
	});
});
