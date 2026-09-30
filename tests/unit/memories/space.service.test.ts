jest.mock('@/lib/memories/server/settings.repository', () => ({
	findMemorySpaceByEventId: jest.fn(),
	findMemorySpaceByPublicSlug: jest.fn(),
}));

import { ApiError } from '@/lib/rsvp/core/errors';
import {
	findMemorySpaceByEventId,
	findMemorySpaceByPublicSlug,
} from '@/lib/memories/server/settings.repository';
import {
	assertMemorySpaceAcceptsGuests,
	findPublicMemorySpace,
	isMemorySpaceInteractive,
	requireMemorySpaceByEventId,
	requirePublicMemorySpace,
	resolvePublicMemorySpace,
	toMemorySpaceSummary,
} from '@/lib/memories/server/space.service';
import { EVENT_ID, NOW, PUBLIC_SLUG, buildSpace } from './fixtures';

const mockFindBySlug = findMemorySpaceByPublicSlug as jest.MockedFunction<
	typeof findMemorySpaceByPublicSlug
>;
const mockFindByEventId = findMemorySpaceByEventId as jest.MockedFunction<
	typeof findMemorySpaceByEventId
>;

describe('findPublicMemorySpace', () => {
	beforeEach(() => jest.clearAllMocks());

	it('keeps expired spaces resolvable for the printed landing page', async () => {
		const expired = buildSpace({ retentionEndsAt: '2026-01-01T00:00:00.000Z' });
		mockFindBySlug.mockResolvedValueOnce(expired);
		await expect(findPublicMemorySpace(PUBLIC_SLUG)).resolves.toBe(expired);
	});

	it('rejects malformed slugs without touching the repository', async () => {
		await expect(findPublicMemorySpace('Not A Slug')).resolves.toBeNull();
		expect(mockFindBySlug).not.toHaveBeenCalled();
	});
});

describe('isMemorySpaceInteractive', () => {
	it('offers guest interaction only while the space is live', () => {
		expect(isMemorySpaceInteractive('before')).toBe(true);
		expect(isMemorySpaceInteractive('open')).toBe(true);
		expect(isMemorySpaceInteractive('closed')).toBe(true);
		expect(isMemorySpaceInteractive('disabled')).toBe(false);
		expect(isMemorySpaceInteractive('expired')).toBe(false);
	});
});

describe('resolvePublicMemorySpace', () => {
	beforeEach(() => jest.clearAllMocks());

	it('returns null for a malformed slug without touching the repository', async () => {
		await expect(resolvePublicMemorySpace('Victoria Y Roberto', NOW)).resolves.toBeNull();
		await expect(resolvePublicMemorySpace('-victoria', NOW)).resolves.toBeNull();
		await expect(resolvePublicMemorySpace(undefined, NOW)).resolves.toBeNull();
		expect(mockFindBySlug).not.toHaveBeenCalled();
	});

	it('returns null when the slug is unknown', async () => {
		mockFindBySlug.mockResolvedValue(null);
		await expect(resolvePublicMemorySpace(PUBLIC_SLUG, NOW)).resolves.toBeNull();
		expect(mockFindBySlug).toHaveBeenCalledWith(PUBLIC_SLUG);
	});

	it('returns null once retention has ended', async () => {
		mockFindBySlug.mockResolvedValue(buildSpace());
		await expect(
			resolvePublicMemorySpace(PUBLIC_SLUG, new Date('2027-01-05T00:00:00.000Z')),
		).resolves.toBeNull();
	});

	it('returns the record while retention is active, even when disabled or closed', async () => {
		const space = buildSpace({ enabled: false });
		mockFindBySlug.mockResolvedValue(space);
		await expect(resolvePublicMemorySpace(PUBLIC_SLUG, NOW)).resolves.toBe(space);
		await expect(
			resolvePublicMemorySpace(PUBLIC_SLUG, new Date('2026-12-01T00:00:00.000Z')),
		).resolves.toBe(space);
	});
});

describe('requirePublicMemorySpace', () => {
	beforeEach(() => jest.clearAllMocks());

	it('throws a 404 ApiError when the slug does not resolve', async () => {
		mockFindBySlug.mockResolvedValue(null);
		const error = await requirePublicMemorySpace('unknown-event').catch((cause) => cause);
		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 404, code: 'not_found' });
	});

	it('throws a 404 ApiError for malformed slugs without a lookup', async () => {
		await expect(requirePublicMemorySpace('Bad Slug')).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});
		expect(mockFindBySlug).not.toHaveBeenCalled();
	});

	it('returns the space while retention is active', async () => {
		jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
		try {
			const space = buildSpace();
			mockFindBySlug.mockResolvedValue(space);
			await expect(requirePublicMemorySpace(PUBLIC_SLUG)).resolves.toBe(space);
		} finally {
			jest.useRealTimers();
		}
	});
});

describe('assertMemorySpaceAcceptsGuests', () => {
	it('rejects disabled and expired spaces with a 404', () => {
		expect(() => assertMemorySpaceAcceptsGuests(buildSpace({ enabled: false }), NOW)).toThrow(
			expect.objectContaining({ status: 404, code: 'not_found' }),
		);
		expect(() =>
			assertMemorySpaceAcceptsGuests(buildSpace(), new Date('2027-02-01T00:00:00.000Z')),
		).toThrow(expect.objectContaining({ status: 404, code: 'not_found' }));
	});

	it('accepts guests before, during and after the upload window', () => {
		const space = buildSpace();
		expect(() =>
			assertMemorySpaceAcceptsGuests(space, new Date('2026-10-01T00:00:00.000Z')),
		).not.toThrow();
		expect(() => assertMemorySpaceAcceptsGuests(space, NOW)).not.toThrow();
		expect(() =>
			assertMemorySpaceAcceptsGuests(space, new Date('2026-12-01T00:00:00.000Z')),
		).not.toThrow();
	});
});

describe('requireMemorySpaceByEventId', () => {
	beforeEach(() => jest.clearAllMocks());

	it('returns the space for a known event and 404s otherwise', async () => {
		const space = buildSpace();
		mockFindByEventId.mockResolvedValueOnce(space).mockResolvedValueOnce(null);
		await expect(requireMemorySpaceByEventId(EVENT_ID)).resolves.toBe(space);
		await expect(requireMemorySpaceByEventId(EVENT_ID)).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});
	});
});

describe('toMemorySpaceSummary', () => {
	it('exposes only the public projection with the resolved window state', () => {
		const space = buildSpace();
		const summary = toMemorySpaceSummary(space, NOW);
		expect(summary).toStrictEqual({
			publicSlug: PUBLIC_SLUG,
			eventTitle: 'Victoria y Roberto',
			timeZone: 'America/Mazatlan',
			uploadStartsAt: '2026-10-16T07:00:00.000Z',
			uploadEndsAt: '2026-10-31T07:00:00.000Z',
			retentionEndsAt: '2026-12-30T07:00:00.000Z',
			windowState: 'open',
		});
		for (const key of [
			'eventId',
			'eventSlug',
			'enabled',
			'entitlement',
			'maxEventObjects',
			'maxEventBytes',
			'maxSessionFiles',
			'maxSessionVideos',
			'maxSessionBytes',
			'createdAt',
			'updatedAt',
		]) {
			expect(summary).not.toHaveProperty(key);
		}
	});

	it('reflects the disabled state in the summary', () => {
		expect(toMemorySpaceSummary(buildSpace({ enabled: false }), NOW).windowState).toBe(
			'disabled',
		);
	});
});
