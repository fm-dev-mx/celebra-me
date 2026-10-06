jest.mock('@/lib/memories/server/catalog.repository', () => ({
	findMediaById: jest.fn(),
	patchMedia: jest.fn(),
}));

jest.mock('@/lib/memories/server/worker-gateway', () => ({
	requestMemoriesUploadCapability: jest.fn(),
	inspectMemoriesObject: jest.fn(),
	isMemoriesSignerRateLimit: jest.fn(() => false),
}));

jest.mock('@/lib/memories/server/audit', () => ({
	appendMemoriesAudit: jest.fn().mockResolvedValue(undefined),
}));

import { MEMORIES_THUMBNAIL_MAX_BYTES } from '@/lib/memories/contract/object-key';
import { findMediaById, patchMedia } from '@/lib/memories/server/catalog.repository';
import {
	inspectMemoriesObject,
	requestMemoriesUploadCapability,
} from '@/lib/memories/server/worker-gateway';
import {
	confirmGuestThumbnail,
	reserveGuestThumbnail,
} from '@/lib/memories/server/thumbnail.service';
import {
	CHECKSUM_SHA256,
	EVENT_ID,
	ITEM_ID,
	OBJECT_KEY,
	buildMediaRow,
	buildSessionRow,
	buildSpace,
} from './fixtures';

const mockFind = findMediaById as jest.MockedFunction<typeof findMediaById>;
const mockPatch = patchMedia as jest.MockedFunction<typeof patchMedia>;
const mockCapability = requestMemoriesUploadCapability as jest.MockedFunction<
	typeof requestMemoriesUploadCapability
>;
const mockInspect = inspectMemoriesObject as jest.MockedFunction<typeof inspectMemoriesObject>;

const space = buildSpace();
const session = buildSessionRow();
const upload = {
	uploadUrl: 'https://upload.invalid/upload',
	requiredHeaders: { Authorization: 'Bearer token' },
	expiresAt: '2026-10-24T11:05:00.000Z',
};
const thumbnailKey = OBJECT_KEY.replace(/\/([^/]+)\.[a-z0-9]+$/, '/thumbs/$1.webp');

describe('reserveGuestThumbnail', () => {
	beforeEach(() => jest.clearAllMocks());

	it('asks for a WebP capability next to the accepted original', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'accepted' }));
		mockCapability.mockResolvedValue(upload);

		await expect(
			reserveGuestThumbnail({
				space,
				session,
				mediaItemId: ITEM_ID,
				sizeBytes: 40_000,
				checksumSha256: CHECKSUM_SHA256,
			}),
		).resolves.toEqual({ upload });
		expect(mockCapability).toHaveBeenCalledWith({
			objectKey: thumbnailKey,
			sessionId: session.id,
			mimeType: 'image/webp',
			sizeBytes: 40_000,
			checksumSha256: CHECKSUM_SHA256,
		});
	});

	it.each([
		['too large', { sizeBytes: MEMORIES_THUMBNAIL_MAX_BYTES + 1 }],
		['without a checksum', { checksumSha256: 'nope' }],
	])('rejects a preview that is %s', async (_label, override) => {
		await expect(
			reserveGuestThumbnail({
				space,
				session,
				mediaItemId: ITEM_ID,
				sizeBytes: 40_000,
				checksumSha256: CHECKSUM_SHA256,
				...override,
			}),
		).rejects.toMatchObject({ status: 400 });
		expect(mockCapability).not.toHaveBeenCalled();
	});

	it('refuses another guest file and files that are not available', async () => {
		mockFind.mockResolvedValueOnce(buildMediaRow({ status: 'accepted', session_id: 'other' }));
		await expect(
			reserveGuestThumbnail({
				space,
				session,
				mediaItemId: ITEM_ID,
				sizeBytes: 1000,
				checksumSha256: CHECKSUM_SHA256,
			}),
		).rejects.toMatchObject({ status: 404 });

		mockFind.mockResolvedValueOnce(buildMediaRow({ status: 'validating' }));
		await expect(
			reserveGuestThumbnail({
				space,
				session,
				mediaItemId: ITEM_ID,
				sizeBytes: 1000,
				checksumSha256: CHECKSUM_SHA256,
			}),
		).rejects.toMatchObject({ status: 409 });
	});

	it('never reopens a thumbnail that is already recorded', async () => {
		mockFind.mockResolvedValue(
			buildMediaRow({
				status: 'accepted',
				thumbnail_object_key: thumbnailKey,
				thumbnail_bytes: 1000,
			}),
		);

		await expect(
			reserveGuestThumbnail({
				space,
				session,
				mediaItemId: ITEM_ID,
				sizeBytes: 1000,
				checksumSha256: CHECKSUM_SHA256,
			}),
		).resolves.toEqual({ upload: null });
		expect(mockCapability).not.toHaveBeenCalled();
	});
});

describe('confirmGuestThumbnail', () => {
	beforeEach(() => jest.clearAllMocks());

	it('records the verified size once the WebP is in storage', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'accepted' }));
		mockInspect.mockResolvedValue({
			kind: 'found',
			inspection: {
				exists: true,
				sizeBytes: 38_000,
				checksumSha256: null,
				signatureValid: true,
				durationSeconds: null,
			},
		});
		mockPatch.mockResolvedValue(buildMediaRow({ status: 'accepted' }));

		await expect(
			confirmGuestThumbnail({ space, session, mediaItemId: ITEM_ID }),
		).resolves.toEqual({ hasThumbnail: true });
		expect(mockPatch).toHaveBeenCalledWith(
			ITEM_ID,
			{ thumbnail_object_key: thumbnailKey, thumbnail_bytes: 38_000 },
			'&thumbnail_object_key=is.null',
		);
		expect(mockInspect).toHaveBeenCalledWith({
			objectKey: thumbnailKey,
			mimeType: 'image/webp',
		});
		expect(EVENT_ID).toBe(space.eventId);
	});

	it('rejects a missing or invalid preview without recording it', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'accepted' }));
		mockInspect.mockResolvedValue({ kind: 'missing' });

		await expect(
			confirmGuestThumbnail({ space, session, mediaItemId: ITEM_ID }),
		).rejects.toMatchObject({ status: 409 });
		expect(mockPatch).not.toHaveBeenCalled();
	});
});
