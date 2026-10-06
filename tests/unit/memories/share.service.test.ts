jest.mock('@/lib/server/env', () => ({ getEnv: jest.fn() }));

jest.mock('@/lib/memories/server/settings.repository', () => ({
	updateMemorySpaceShare: jest.fn(),
	findMemorySpaceByPublicSlug: jest.fn(),
	findMemorySpaceByEventId: jest.fn(),
	listMemorySpacesByEventIds: jest.fn(),
}));

jest.mock('@/lib/memories/server/catalog.repository', () => ({
	listGalleryMedia: jest.fn(),
}));

jest.mock('@/lib/memories/server/audit', () => ({
	appendMemoriesAudit: jest.fn().mockResolvedValue(undefined),
}));

import { getEnv } from '@/lib/server/env';
import { appendMemoriesAudit } from '@/lib/memories/server/audit';
import { listGalleryMedia } from '@/lib/memories/server/catalog.repository';
import {
	findMemorySpaceByPublicSlug,
	updateMemorySpaceShare,
} from '@/lib/memories/server/settings.repository';
import {
	buildMemoriesShareToken,
	listSharedGalleryItems,
	requireSharedGallerySpace,
	resolveMemoriesShareUrl,
	updateMemoriesShare,
	verifyMemoriesShareToken,
} from '@/lib/memories/server/share.service';
import { OWNER_USER_ID, buildMediaRow, buildSpace } from './fixtures';

const mockEnv = getEnv as jest.MockedFunction<typeof getEnv>;
const mockUpdate = updateMemorySpaceShare as jest.MockedFunction<typeof updateMemorySpaceShare>;
const mockFindBySlug = findMemorySpaceByPublicSlug as jest.MockedFunction<
	typeof findMemorySpaceByPublicSlug
>;
const mockGallery = listGalleryMedia as jest.MockedFunction<typeof listGalleryMedia>;
const mockAudit = appendMemoriesAudit as jest.MockedFunction<typeof appendMemoriesAudit>;

const SECRET = 'a'.repeat(48);
const NOW = new Date('2026-10-20T12:00:00.000Z');
const sharedSpace = buildSpace({ shareEnabledAt: '2026-10-18T00:00:00.000Z', shareVersion: 2 });

describe('share tokens', () => {
	it('are deterministic per event and version, and change when the version is bumped', () => {
		const token = buildMemoriesShareToken(sharedSpace, SECRET);
		expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(buildMemoriesShareToken(sharedSpace, SECRET)).toBe(token);
		expect(buildMemoriesShareToken({ ...sharedSpace, shareVersion: 3 }, SECRET)).not.toBe(
			token,
		);
		expect(verifyMemoriesShareToken(sharedSpace, token, SECRET)).toBe(true);
		expect(verifyMemoriesShareToken({ ...sharedSpace, shareVersion: 3 }, token, SECRET)).toBe(
			false,
		);
		expect(verifyMemoriesShareToken(sharedSpace, 'short', SECRET)).toBe(false);
	});
});

describe('resolveMemoriesShareUrl', () => {
	beforeEach(() => mockEnv.mockReturnValue(SECRET));

	it('returns the gallery link only while sharing is on and a secret exists', () => {
		const url = resolveMemoriesShareUrl(sharedSpace, NOW);
		expect(url).toBe(
			`https://celebra-me.com/r/${sharedSpace.publicSlug}/galeria/${buildMemoriesShareToken(sharedSpace, SECRET)}`,
		);
		expect(resolveMemoriesShareUrl({ ...sharedSpace, shareEnabledAt: null }, NOW)).toBeNull();
		mockEnv.mockReturnValue('');
		expect(resolveMemoriesShareUrl(sharedSpace, NOW)).toBeNull();
	});

	it('stops once retention ends', () => {
		expect(
			resolveMemoriesShareUrl(sharedSpace, new Date('2027-06-01T00:00:00.000Z')),
		).toBeNull();
	});
});

describe('updateMemoriesShare', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockEnv.mockReturnValue(SECRET);
	});

	it('enables sharing and audits it', async () => {
		const space = buildSpace();
		mockUpdate.mockResolvedValue({ ...space, shareEnabledAt: NOW.toISOString() });

		const result = await updateMemoriesShare({
			space,
			action: 'enable',
			actorId: OWNER_USER_ID,
			now: NOW,
		});

		expect(mockUpdate).toHaveBeenCalledWith(space.eventId, {
			expectedVersion: 0,
			shareVersion: 0,
			shareEnabledAt: NOW.toISOString(),
		});
		expect(result.shareUrl).toContain('/galeria/');
		expect(mockAudit).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'gallery_share_enabled', actorType: 'organizer' }),
		);
	});

	it('rotates with a compare-and-swap on the current version', async () => {
		mockUpdate.mockResolvedValue({ ...sharedSpace, shareVersion: 3 });

		await updateMemoriesShare({
			space: sharedSpace,
			action: 'rotate',
			actorId: OWNER_USER_ID,
			now: NOW,
		});

		expect(mockUpdate).toHaveBeenCalledWith(sharedSpace.eventId, {
			expectedVersion: 2,
			shareVersion: 3,
			shareEnabledAt: sharedSpace.shareEnabledAt,
		});
	});

	it('reports a concurrent change instead of overwriting it', async () => {
		mockUpdate.mockResolvedValue(null);

		await expect(
			updateMemoriesShare({ space: sharedSpace, action: 'rotate', actorId: OWNER_USER_ID }),
		).rejects.toMatchObject({ status: 409 });
	});

	it('refuses to share without a configured secret but can always turn sharing off', async () => {
		mockEnv.mockReturnValue('');
		await expect(
			updateMemoriesShare({ space: buildSpace(), action: 'enable', actorId: OWNER_USER_ID }),
		).rejects.toMatchObject({ status: 503 });

		mockUpdate.mockResolvedValue({ ...sharedSpace, shareEnabledAt: null });
		await expect(
			updateMemoriesShare({
				space: sharedSpace,
				action: 'disable',
				actorId: OWNER_USER_ID,
				now: NOW,
			}),
		).resolves.toEqual({ shareUrl: null });
	});
});

describe('requireSharedGallerySpace', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockEnv.mockReturnValue(SECRET);
	});

	it('resolves a valid link and answers 404 for every kind of failure', async () => {
		const token = buildMemoriesShareToken(sharedSpace, SECRET);
		mockFindBySlug.mockResolvedValue(sharedSpace);
		await expect(requireSharedGallerySpace(sharedSpace.publicSlug, token, NOW)).resolves.toBe(
			sharedSpace,
		);

		await expect(
			requireSharedGallerySpace(sharedSpace.publicSlug, 'x'.repeat(43), NOW),
		).rejects.toMatchObject({ status: 404 });

		mockFindBySlug.mockResolvedValue({ ...sharedSpace, shareEnabledAt: null });
		await expect(
			requireSharedGallerySpace(sharedSpace.publicSlug, token, NOW),
		).rejects.toMatchObject({ status: 404 });
	});
});

describe('listSharedGalleryItems', () => {
	it('exposes the uploader name but never the alias, key or status', async () => {
		mockGallery.mockResolvedValue([
			{
				...buildMediaRow({ status: 'accepted', caption: 'Brindis' }),
				uploader: { display_name: 'Tía Ana', guest_alias: 'invitado-a1b2c3d4' },
			},
		]);

		const result = await listSharedGalleryItems(sharedSpace, 0);

		expect(result.nextPage).toBeNull();
		expect(result.items[0]).toMatchObject({ caption: 'Brindis', uploaderName: 'Tía Ana' });
		expect(JSON.stringify(result)).not.toMatch(/invitado-|events\/|status/);
	});
});
