import {
	checkRateLimit,
	hashIp,
	installRateLimitBindings,
	peekRateLimit,
	rateLimitBindingName,
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

	describe('Workers rate-limit bindings', () => {
		const bindingFor = (results: boolean[]) => {
			const limit = jest.fn(async () => ({ success: results.shift() ?? false }));
			return { limit };
		};

		it('names one binding per namespace, limit and window', () => {
			expect(rateLimitBindingName('rsvp-public', 10, 60)).toBe(
				'RATE_LIMIT_RSVP_PUBLIC_10_60',
			);
			expect(rateLimitBindingName('auth', 8, 60)).toBe('RATE_LIMIT_AUTH_8_60');
		});

		it('routes a call to the binding of its combination with the full key', async () => {
			const binding = bindingFor([true, false]);
			const env = { RATE_LIMIT_AUTH_8_60: binding, OTHER: 'value' };
			expect(installRateLimitBindings(env)).toBe(1);
			expect(installRateLimitBindings(env)).toBe(1);

			const input = {
				namespace: 'auth' as const,
				entityId: 'login:user@test.invalid',
				ip: '203.0.113.10',
				maxHits: 8,
				windowSec: 60,
			};
			expect(await checkRateLimit(input)).toBe(true);
			expect(await checkRateLimit(input)).toBe(false);
			expect(binding.limit).toHaveBeenCalledTimes(2);
			expect(binding.limit).toHaveBeenCalledWith({
				key: `auth:login:user@test.invalid:${hashIp('203.0.113.10')}`,
			});
		});

		it('falls back to per-instance limits for an undeclared combination and warns once', async () => {
			const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
			try {
				installRateLimitBindings({ RATE_LIMIT_AUTH_8_60: bindingFor([true]) });
				const input = {
					namespace: 'ctx' as const,
					entityId: 'invite-9',
					maxHits: 1,
					windowSec: 60,
				};
				expect(await checkRateLimit(input)).toBe(true);
				expect(await checkRateLimit(input)).toBe(false);
				expect(warn).toHaveBeenCalledTimes(1);
				expect(warn.mock.calls[0][0]).toContain('RATE_LIMIT_CTX_1_60');
			} finally {
				warn.mockRestore();
			}
		});

		it('keeps the in-memory backend when the environment has no bindings', async () => {
			expect(installRateLimitBindings({ SUPABASE_URL: 'x' })).toBe(0);
			expect(installRateLimitBindings(undefined)).toBe(0);
			const input = {
				namespace: 'ctx' as const,
				entityId: 'invite-1',
				maxHits: 1,
				windowSec: 60,
			};
			expect(await checkRateLimit(input)).toBe(true);
			expect(await checkRateLimit(input)).toBe(false);
		});
	});
});

describe('peekRateLimit', () => {
	afterEach(() => {
		resetRateLimitProviderForTests();
	});

	const input = {
		namespace: 'guest-link' as const,
		entityId: 'failed-code',
		ip: '10.0.0.9',
		maxHits: 2,
		windowSec: 3600,
	};

	it('reads the bucket without consuming a hit', async () => {
		expect(await peekRateLimit(input)).toBe(true);
		expect(await peekRateLimit(input)).toBe(true);
		expect(await checkRateLimit(input)).toBe(true);
		expect(await peekRateLimit(input)).toBe(true);
		expect(await checkRateLimit(input)).toBe(true);
		expect(await peekRateLimit(input)).toBe(false);
		expect(await checkRateLimit(input)).toBe(false);
	});

	it('uses the buckets when no binding exists for the window', async () => {
		const limit = jest.fn(async () => ({ success: true }));
		installRateLimitBindings({ RATE_LIMIT_CTX_20_60: { limit } });
		await checkRateLimit(input);
		await checkRateLimit(input);
		expect(await peekRateLimit(input)).toBe(false);
		expect(limit).not.toHaveBeenCalled();
	});
});
