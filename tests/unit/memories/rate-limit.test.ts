import { MEMORIES_APP_RATE_LIMITS, MEMORIES_SIGN_RATE_LIMIT } from '@/lib/memories/contract/limits';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { resetRateLimitProviderForTests } from '@/lib/rsvp/security/rate-limit-provider';
import { OTHER_SESSION_ID, SESSION_ID } from './fixtures';

function requestFrom(ip: string): Request {
	return { headers: new Headers({ 'x-forwarded-for': ip }) } as unknown as Request;
}

async function attempts(count: number, run: () => Promise<void>): Promise<Array<'ok' | number>> {
	const outcomes: Array<'ok' | number> = [];
	for (let attempt = 0; attempt < count; attempt += 1) {
		outcomes.push(
			await run()
				.then(() => 'ok' as const)
				.catch((error: { status: number }) => error.status),
		);
	}
	return outcomes;
}

describe('requireMemoriesRateLimit', () => {
	beforeEach(() => {
		jest.useFakeTimers({ now: new Date('2026-10-31T04:00:00.000Z') });
		resetRateLimitProviderForTests();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('lets a guest reserve as often as the Sign Worker allows, then answers 429', async () => {
		const limit = MEMORIES_SIGN_RATE_LIMIT.limit;
		const outcomes = await attempts(limit + 1, () =>
			requireMemoriesRateLimit(requestFrom('203.0.113.7'), 'register', SESSION_ID),
		);

		expect(outcomes).toEqual([...Array.from({ length: limit }, () => 'ok'), 429]);
		await expect(
			requireMemoriesRateLimit(requestFrom('203.0.113.7'), 'register', SESSION_ID),
		).rejects.toMatchObject({ status: 429, code: 'rate_limited' });
	});

	it('opens the window again once the minute has passed', async () => {
		const limit = MEMORIES_APP_RATE_LIMITS.register.maxHits;
		await attempts(limit + 1, () =>
			requireMemoriesRateLimit(requestFrom('203.0.113.7'), 'register', SESSION_ID),
		);

		jest.advanceTimersByTime(MEMORIES_APP_RATE_LIMITS.register.windowSec * 1000);

		await expect(
			requireMemoriesRateLimit(requestFrom('203.0.113.7'), 'register', SESSION_ID),
		).resolves.toBeUndefined();
	});

	it('counts each guest separately even behind the same venue Wi-Fi address', async () => {
		const limit = MEMORIES_APP_RATE_LIMITS.register.maxHits;
		const venue = requestFrom('198.51.100.20');
		await attempts(limit + 1, () => requireMemoriesRateLimit(venue, 'register', SESSION_ID));

		await expect(
			requireMemoriesRateLimit(venue, 'register', OTHER_SESSION_ID),
		).resolves.toBeUndefined();
	});

	it('keeps each operation in its own budget', async () => {
		const limit = MEMORIES_APP_RATE_LIMITS.register.maxHits;
		const venue = requestFrom('198.51.100.20');
		await attempts(limit + 1, () => requireMemoriesRateLimit(venue, 'register', SESSION_ID));

		// A throttled reservation must not stop the guest from confirming or viewing uploads.
		await expect(
			requireMemoriesRateLimit(venue, 'mutate', SESSION_ID),
		).resolves.toBeUndefined();
		await expect(requireMemoriesRateLimit(venue, 'read', SESSION_ID)).resolves.toBeUndefined();
	});

	it('throttles anonymous session requests by address, not globally', async () => {
		const limit = MEMORIES_APP_RATE_LIMITS.recover.maxHits;
		const outcomes = await attempts(limit + 1, () =>
			requireMemoriesRateLimit(requestFrom('203.0.113.7'), 'recover'),
		);

		expect(outcomes.at(-1)).toBe(429);
		await expect(
			requireMemoriesRateLimit(requestFrom('203.0.113.8'), 'recover'),
		).resolves.toBeUndefined();
	});

	it('sizes a guest session for a whole upload: confirmations and previews outnumber reservations', () => {
		// One upload is one reservation, up to three confirmations and one caption.
		expect(MEMORIES_APP_RATE_LIMITS.mutate.maxHits).toBeGreaterThanOrEqual(
			MEMORIES_APP_RATE_LIMITS.register.maxHits * 4,
		);
		expect(MEMORIES_APP_RATE_LIMITS.register).toEqual({
			maxHits: MEMORIES_SIGN_RATE_LIMIT.limit,
			windowSec: MEMORIES_SIGN_RATE_LIMIT.periodSeconds,
		});
	});
});
