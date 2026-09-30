jest.mock('@/lib/memories/server/catalog.repository', () => ({
	claimValidation: jest.fn(),
	findMediaById: jest.fn(),
	finalizeMedia: jest.fn(),
	listSessionMedia: jest.fn(),
	patchMedia: jest.fn(),
	releaseReservation: jest.fn(),
	reserveMedia: jest.fn(),
}));

jest.mock('@/lib/memories/server/worker-gateway', () => ({
	inspectMemoriesObject: jest.fn(),
	requestMemoriesUploadCapability: jest.fn(),
}));

jest.mock('@/lib/memories/server/audit', () => ({
	appendMemoriesAudit: jest.fn().mockResolvedValue(undefined),
}));

import { MEMORIES_SESSION_MAX_IN_FLIGHT } from '@/lib/memories/contract/limits';
import { parseMemoriesObjectKey } from '@/lib/memories/contract/object-key';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import { appendMemoriesAudit } from '@/lib/memories/server/audit';
import {
	claimValidation,
	findMediaById,
	finalizeMedia,
	listSessionMedia,
	patchMedia,
	releaseReservation,
	reserveMedia,
} from '@/lib/memories/server/catalog.repository';
import {
	completeGuestMemoryItem,
	deleteGuestMemoryItem,
	getMediaObjectForRetrieval,
	listGuestMemoryItems,
	reserveGuestMemoryItem,
	updateGuestMemoryCaption,
} from '@/lib/memories/server/guest-media.service';
import {
	inspectMemoriesObject,
	requestMemoriesUploadCapability,
} from '@/lib/memories/server/worker-gateway';
import {
	CHECKSUM_SHA256,
	CLIENT_REQUEST_ID,
	EVENT_ID,
	ITEM_ID,
	OBJECT_KEY,
	OTHER_SESSION_ID,
	SESSION_ID,
	buildMediaRow,
	buildSessionRow,
	buildSpace,
	buildUploadCapability,
} from './fixtures';

const mockReserve = reserveMedia as jest.MockedFunction<typeof reserveMedia>;
const mockRelease = releaseReservation as jest.MockedFunction<typeof releaseReservation>;
const mockFind = findMediaById as jest.MockedFunction<typeof findMediaById>;
const mockClaim = claimValidation as jest.MockedFunction<typeof claimValidation>;
const mockFinalize = finalizeMedia as jest.MockedFunction<typeof finalizeMedia>;
const mockList = listSessionMedia as jest.MockedFunction<typeof listSessionMedia>;
const mockPatch = patchMedia as jest.MockedFunction<typeof patchMedia>;
const mockInspect = inspectMemoriesObject as jest.MockedFunction<typeof inspectMemoriesObject>;
const mockCapability = requestMemoriesUploadCapability as jest.MockedFunction<
	typeof requestMemoriesUploadCapability
>;
const mockAudit = appendMemoriesAudit as jest.MockedFunction<typeof appendMemoriesAudit>;

const space = buildSpace();
const session = buildSessionRow();

function reservationInput(overrides: Record<string, unknown> = {}) {
	return {
		space,
		session,
		mimeType: 'image/jpeg',
		sizeBytes: 1_048_576,
		checksumSha256: CHECKSUM_SHA256,
		clientRequestId: CLIENT_REQUEST_ID,
		...overrides,
	};
}

function reservationFailure(token: string): SupabaseHttpError {
	return new SupabaseHttpError(400, `{"code":"P0001","message":"${token}"}`, 'P0001');
}

describe('reserveGuestMemoryItem', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRelease.mockResolvedValue(true);
	});

	it('reserves an event-scoped key, signs the upload and returns the public item', async () => {
		mockReserve.mockResolvedValue(buildMediaRow());
		mockCapability.mockResolvedValue(buildUploadCapability());

		const result = await reserveGuestMemoryItem(reservationInput());

		expect(mockReserve).toHaveBeenCalledTimes(1);
		const reservation = mockReserve.mock.calls[0][0];
		expect(parseMemoriesObjectKey(reservation.objectKey)).toMatchObject({
			eventId: EVENT_ID,
			extension: 'jpg',
		});
		expect(reservation).toMatchObject({
			eventId: EVENT_ID,
			sessionId: SESSION_ID,
			mimeType: 'image/jpeg',
			sizeBytes: 1_048_576,
			checksumSha256: CHECKSUM_SHA256,
			durationSeconds: null,
			idempotencyKey: CLIENT_REQUEST_ID,
			maxSessionInFlight: MEMORIES_SESSION_MAX_IN_FLIGHT,
		});
		expect(mockCapability).toHaveBeenCalledWith({
			objectKey: OBJECT_KEY,
			sessionId: SESSION_ID,
			mimeType: 'image/jpeg',
			sizeBytes: 1_048_576,
			checksumSha256: CHECKSUM_SHA256,
		});
		expect(result.upload).toEqual(buildUploadCapability());
		expect(result.item).toMatchObject({
			id: ITEM_ID,
			status: 'uploading',
			mimeType: 'image/jpeg',
		});
		expect(result.item).not.toHaveProperty('objectKey');
		expect(result.item).not.toHaveProperty('sessionId');
		expect(result.item).not.toHaveProperty('checksumSha256');
		expect(mockAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: EVENT_ID,
				mediaItemId: ITEM_ID,
				action: 'reserved',
			}),
		);
	});

	it('uses the video extension and forwards the duration for videos', async () => {
		mockReserve.mockResolvedValue(
			buildMediaRow({
				mime_type: 'video/mp4',
				duration_seconds: 42,
				object_key: OBJECT_KEY.replace('.jpg', '.mp4'),
			}),
		);
		mockCapability.mockResolvedValue(buildUploadCapability());

		await reserveGuestMemoryItem(
			reservationInput({ mimeType: 'video/mp4', sizeBytes: 5_000_000, durationSeconds: 42 }),
		);

		const reservation = mockReserve.mock.calls[0][0];
		expect(parseMemoriesObjectKey(reservation.objectKey)?.extension).toBe('mp4');
		expect(reservation.durationSeconds).toBe(42);
	});

	it.each([
		['memories_upload_window_closed', 403, 'forbidden'],
		['memories_event_byte_quota', 409, 'limit_reached'],
		['memories_session_file_quota', 409, 'limit_reached'],
		['memories_session_concurrency_quota', 429, 'rate_limited'],
		['memories_space_unavailable', 404, 'not_found'],
		['memories_session_unavailable', 401, 'unauthorized'],
		['memories_idempotency_conflict', 409, 'conflict'],
	])('maps the %s reservation failure to %i %s', async (token, status, code) => {
		mockReserve.mockRejectedValue(reservationFailure(token));
		await expect(reserveGuestMemoryItem(reservationInput())).rejects.toMatchObject({
			status,
			code,
		});
		expect(mockCapability).not.toHaveBeenCalled();
	});

	it('rethrows unknown persistence errors untouched', async () => {
		const error = new SupabaseHttpError(500, 'connection reset', null);
		mockReserve.mockRejectedValue(error);
		await expect(reserveGuestMemoryItem(reservationInput())).rejects.toBe(error);
	});

	it('releases the reservation and answers 503 when the signer fails', async () => {
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		mockReserve.mockResolvedValue(buildMediaRow());
		mockCapability.mockRejectedValue(new Error('signer unavailable'));

		await expect(reserveGuestMemoryItem(reservationInput())).rejects.toMatchObject({
			status: 503,
			code: 'service_unavailable',
		});
		expect(mockRelease).toHaveBeenCalledWith(ITEM_ID, SESSION_ID);
		expect(mockAudit).not.toHaveBeenCalled();
	});

	it.each([
		['a malformed checksum', { checksumSha256: 'not-hex' }],
		['a video without duration', { mimeType: 'video/mp4', durationSeconds: undefined }],
		['a video longer than 60 seconds', { mimeType: 'video/mp4', durationSeconds: 61 }],
		['a non-uuid client request id', { clientRequestId: 'request-1' }],
		['an unsupported MIME type', { mimeType: 'image/gif' }],
		['a zero-byte file', { sizeBytes: 0 }],
		['an image above the image limit', { sizeBytes: 20 * 1024 * 1024 + 1 }],
	])('rejects %s with a 400 before reserving', async (_label, overrides) => {
		await expect(reserveGuestMemoryItem(reservationInput(overrides))).rejects.toMatchObject({
			status: 400,
			code: 'bad_request',
		});
		expect(mockReserve).not.toHaveBeenCalled();
		expect(mockCapability).not.toHaveBeenCalled();
	});
});

describe('getMediaObjectForRetrieval', () => {
	beforeEach(() => jest.clearAllMocks());

	it('returns the object and a download name for an accepted item', async () => {
		mockFind.mockResolvedValue(
			buildMediaRow({ status: 'accepted', accepted_at: '2026-10-24T11:05:00.000Z' }),
		);
		await expect(getMediaObjectForRetrieval(space, ITEM_ID, SESSION_ID)).resolves.toEqual({
			objectKey: OBJECT_KEY,
			mimeType: 'image/jpeg',
			downloadName: 'recuerdo-2026-10-24-b0000000.jpg',
		});
		expect(mockFind).toHaveBeenCalledWith(EVENT_ID, ITEM_ID);
	});

	it('hides items that belong to another guest session', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'accepted' }));
		await expect(
			getMediaObjectForRetrieval(space, ITEM_ID, OTHER_SESSION_ID),
		).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});
	});

	it('lets the organizer resolve any session item when no owner is given', async () => {
		mockFind.mockResolvedValue(
			buildMediaRow({ status: 'accepted', session_id: OTHER_SESSION_ID }),
		);
		await expect(getMediaObjectForRetrieval(space, ITEM_ID)).resolves.toMatchObject({
			objectKey: OBJECT_KEY,
		});
	});

	it.each(['uploading', 'validating', 'rejected', 'duplicate', 'deleted'] as const)(
		'hides items in the %s state',
		async (status) => {
			mockFind.mockResolvedValue(buildMediaRow({ status }));
			await expect(
				getMediaObjectForRetrieval(space, ITEM_ID, SESSION_ID),
			).rejects.toMatchObject({
				status: 404,
			});
		},
	);

	it('hides unknown items', async () => {
		mockFind.mockResolvedValue(null);
		await expect(getMediaObjectForRetrieval(space, ITEM_ID, SESSION_ID)).rejects.toMatchObject({
			status: 404,
		});
	});
});

describe('completeGuestMemoryItem', () => {
	beforeEach(() => jest.clearAllMocks());

	it.each(['accepted', 'rejected', 'duplicate', 'deleted'] as const)(
		'returns a %s item unchanged without inspecting storage',
		async (status) => {
			mockFind.mockResolvedValue(buildMediaRow({ status }));
			const item = await completeGuestMemoryItem({ space, session, mediaItemId: ITEM_ID });
			expect(item).toMatchObject({ id: ITEM_ID, status });
			expect(item).not.toHaveProperty('objectKey');
			expect(mockClaim).not.toHaveBeenCalled();
			expect(mockInspect).not.toHaveBeenCalled();
			expect(mockFinalize).not.toHaveBeenCalled();
		},
	);

	it('fails with 503 when the inspection cannot be performed', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'validating' }));
		mockInspect.mockResolvedValue(null);
		await expect(
			completeGuestMemoryItem({ space, session, mediaItemId: ITEM_ID }),
		).rejects.toMatchObject({ status: 503, code: 'service_unavailable' });
		expect(mockFinalize).not.toHaveBeenCalled();
	});

	it('claims validation, inspects and accepts a matching upload', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'uploading' }));
		mockClaim.mockResolvedValue(buildMediaRow({ status: 'validating' }));
		mockInspect.mockResolvedValue({
			exists: true,
			sizeBytes: 1_048_576,
			checksumSha256: CHECKSUM_SHA256.toUpperCase(),
			signatureValid: true,
			durationSeconds: null,
		});
		mockFinalize.mockResolvedValue(
			buildMediaRow({ status: 'accepted', accepted_at: '2026-10-24T11:05:00.000Z' }),
		);

		const item = await completeGuestMemoryItem({ space, session, mediaItemId: ITEM_ID });

		expect(mockClaim).toHaveBeenCalledWith(ITEM_ID, SESSION_ID);
		expect(mockInspect).toHaveBeenCalledWith({ objectKey: OBJECT_KEY, mimeType: 'image/jpeg' });
		expect(mockFinalize).toHaveBeenCalledWith(
			expect.objectContaining({
				itemId: ITEM_ID,
				sessionId: SESSION_ID,
				outcome: 'accepted',
			}),
		);
		expect(item.status).toBe('accepted');
		expect(mockAudit).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'submitted_for_validation' }),
		);
		expect(mockAudit).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'validated_and_accepted', actorType: 'system' }),
		);
	});

	it('rejects an upload whose checksum or size differ from the reservation', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'validating' }));
		mockInspect.mockResolvedValue({
			exists: true,
			sizeBytes: 1_048_575,
			checksumSha256: CHECKSUM_SHA256,
			signatureValid: true,
			durationSeconds: null,
		});
		mockFinalize.mockResolvedValue(buildMediaRow({ status: 'rejected' }));

		const item = await completeGuestMemoryItem({ space, session, mediaItemId: ITEM_ID });

		expect(mockFinalize).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'rejected' }));
		expect(item.status).toBe('rejected');
	});

	it('refuses to complete another session item', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ session_id: OTHER_SESSION_ID }));
		await expect(
			completeGuestMemoryItem({ space, session, mediaItemId: ITEM_ID }),
		).rejects.toMatchObject({ status: 404 });
		expect(mockClaim).not.toHaveBeenCalled();
	});
});

describe('listGuestMemoryItems', () => {
	beforeEach(() => jest.clearAllMocks());

	it('hides deleted items and computes the quota from the space limits', async () => {
		const smallSpace = buildSpace({
			maxSessionFiles: 7,
			maxSessionVideos: 2,
			maxSessionBytes: 50_000_000,
		});
		mockList.mockResolvedValue([
			buildMediaRow({ status: 'accepted', size_bytes: 1_000_000 }),
			buildMediaRow({
				id: 'b0000000-0000-4000-8000-000000000011',
				status: 'uploading',
				mime_type: 'video/mp4',
				size_bytes: 10_000_000,
				duration_seconds: 12,
			}),
			buildMediaRow({
				id: 'b0000000-0000-4000-8000-000000000012',
				status: 'deleted',
				deleted_at: '2026-10-24T11:30:00.000Z',
				object_deleted_at: '2026-10-25T02:00:00.000Z',
				size_bytes: 3_000_000,
			}),
		]);

		const result = await listGuestMemoryItems(smallSpace, session);

		expect(mockList).toHaveBeenCalledWith(EVENT_ID, SESSION_ID);
		expect(result.items.map((item) => item.status)).toEqual(['accepted', 'uploading']);
		expect(result.items[0]).not.toHaveProperty('objectKey');
		expect(result.quota).toEqual({
			files: { used: 2, remaining: 5, limit: 7 },
			videos: { used: 1, remaining: 1, limit: 2 },
			bytes: { used: 11_000_000, remaining: 39_000_000, limit: 50_000_000 },
			inFlight: { used: 1, remaining: 1, limit: MEMORIES_SESSION_MAX_IN_FLIGHT },
		});
	});
});

describe('caption updates and deletion', () => {
	beforeEach(() => jest.clearAllMocks());

	it('trims and stores the caption for an own item', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'accepted' }));
		mockPatch.mockResolvedValue(buildMediaRow({ status: 'accepted', caption: 'Baile' }));
		const item = await updateGuestMemoryCaption({
			space,
			session,
			mediaItemId: ITEM_ID,
			caption: '  Baile  ',
		});
		expect(mockPatch).toHaveBeenCalledWith(
			ITEM_ID,
			{ caption: 'Baile' },
			'&status=neq.deleted',
		);
		expect(item.caption).toBe('Baile');
	});

	it('refuses to caption a deleted item', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'deleted' }));
		await expect(
			updateGuestMemoryCaption({ space, session, mediaItemId: ITEM_ID, caption: 'x' }),
		).rejects.toMatchObject({ status: 409, code: 'conflict' });
		expect(mockPatch).not.toHaveBeenCalled();
	});

	it('soft-deletes and schedules cleanup immediately', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'accepted' }));
		mockPatch.mockResolvedValue(buildMediaRow({ status: 'deleted' }));
		await deleteGuestMemoryItem({ space, session, mediaItemId: ITEM_ID });
		const [itemId, body, filter] = mockPatch.mock.calls[0];
		expect(itemId).toBe(ITEM_ID);
		expect(filter).toBe('&status=neq.deleted');
		expect(body.status).toBe('deleted');
		expect(body.deleted_at).toBe(body.cleanup_after);
		expect(typeof body.deleted_at).toBe('string');
		expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'deleted' }));
	});

	it('is idempotent for already deleted items', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'deleted' }));
		await expect(
			deleteGuestMemoryItem({ space, session, mediaItemId: ITEM_ID }),
		).resolves.toBeUndefined();
		expect(mockPatch).not.toHaveBeenCalled();
	});
});
