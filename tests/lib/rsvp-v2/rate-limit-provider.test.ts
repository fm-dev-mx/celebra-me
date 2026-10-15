import {
	checkRateLimit,
	hashIp,
	resetRateLimitProviderForTests,
} from '@/lib/rsvp/security/rate-limit-provider';

describe('rsvp rateLimitProvider', () => {
	afterEach(() => {
		resetRateLimitProviderForTests();
	});

	it('hashes IP consistently and avoids plain text output', () => {
		const hashA = hashIp('1.2.3.4');
		const hashB = hashIp('1.2.3.4');
		expect(hashA).toHaveLength(16);
		expect(hashA).toBe(hashB);
		expect(hashA).not.toContain('1.2.3.4');
	});

	it('limits repeated hits for one key within the window', async () => {
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

	it('allows 20 concurrent users sharing one IP without cross-limiting', async () => {
		const results = await Promise.all(
			Array.from({ length: 20 }, (_, index) =>
				checkRateLimit({
					namespace: 'auth',
					entityId: `login:user-${index}@test.invalid`,
					ip: '203.0.113.10',
					maxHits: 8,
					windowSec: 60,
				}),
			),
		);

		expect(results).toEqual(Array(20).fill(true));
	});

	it('allows exactly 8 of 12 concurrent attempts for one identity', async () => {
		const results = await Promise.all(
			Array.from({ length: 12 }, () =>
				checkRateLimit({
					namespace: 'auth',
					entityId: 'login:shared@test.invalid',
					ip: '203.0.113.10',
					maxHits: 8,
					windowSec: 60,
				}),
			),
		);

		expect(results.filter(Boolean)).toHaveLength(8);
		expect(results.filter((allowed) => !allowed)).toHaveLength(4);
	});
});
