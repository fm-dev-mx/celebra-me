import {
	checkRateLimit,
	hashIp,
	resetRateLimitProviderForTests,
} from '@/lib/rsvp/rateLimitProvider';

describe('rsvp rateLimitProvider', () => {
	const originalEnv = { ...process.env };
	const originalFetch = global.fetch;

	afterEach(() => {
		process.env = { ...originalEnv };
		global.fetch = originalFetch;
		resetRateLimitProviderForTests();
		jest.restoreAllMocks();
	});

	it('hashes IP consistently and avoids plain text output', () => {
		const hashA = hashIp('1.2.3.4');
		const hashB = hashIp('1.2.3.4');
		expect(hashA).toHaveLength(16);
		expect(hashA).toBe(hashB);
		expect(hashA).not.toContain('1.2.3.4');
	});

	it('uses in-memory fallback when distributed mode is disabled', async () => {
		process.env.RSVP_V2_DISTRIBUTED_RATELIMIT = 'false';
		const first = await checkRateLimit({
			namespace: 'ctx',
			entityId: 'invite-1',
			ip: '10.0.0.1',
			maxHits: 1,
			windowSec: 60,
		});
		const second = await checkRateLimit({
			namespace: 'ctx',
			entityId: 'invite-1',
			ip: '10.0.0.1',
			maxHits: 1,
			windowSec: 60,
		});
		expect(first).toBe(true);
		expect(second).toBe(false);
	});

	it('uses Upstash REST backend when distributed mode and credentials are configured', async () => {
		process.env.RSVP_V2_DISTRIBUTED_RATELIMIT = 'true';
		process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example';
		process.env.UPSTASH_REDIS_REST_TOKEN = 'token';

		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ result: 1 }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ result: 'OK' }),
			}) as typeof fetch;

		const allowed = await checkRateLimit({
			namespace: 'rsvp',
			entityId: 'invite-2',
			ip: '10.0.0.2',
			maxHits: 20,
			windowSec: 60,
		});

		expect(allowed).toBe(true);
		expect(global.fetch).toHaveBeenCalled();
	});
});
