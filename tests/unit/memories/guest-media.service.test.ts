jest.mock('@/lib/memories/server/catalog.repository', () => ({
	claimValidation: jest.fn(),
	findMediaById: jest.fn(),
	finalizeMedia: jest.fn(),
	listSessionInFlightMedia: jest.fn(),
	listSessionMedia: jest.fn(),
	patchMedia: jest.fn(),
	releaseReservation: jest.fn(),
	reserveMedia: jest.fn(),
}));

jest.mock('@/lib/memories/server/worker-gateway', () => ({
	...jest.requireActual<typeof import('@/lib/memories/server/worker-gateway')>(
		'@/lib/memories/server/worker-gateway',
	),
	inspectMemoriesObject: jest.fn(),
	requestMemoriesUploadCapability: jest.fn(),
}));

jest.mock('@/lib/memories/server/audit', () => ({
	appendMemoriesAudit: jest.fn().mockResolvedValue(undefined),
}));

import {
	MEMORIES_LATE_UPLOAD_GRACE_SECONDS,
	MEMORIES_SESSION_MAX_IN_FLIGHT,
} from '@/lib/memories/contract/limits';
import { parseMemoriesObjectKey } from '@/lib/memories/contract/object-key';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import { appendMemoriesAudit } from '@/lib/memories/server/audit';
import {
	claimValidation,
	findMediaById,
	finalizeMedia,
	listSessionInFlightMedia,
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
	settleStaleMemoryItem,
	updateGuestMemoryCaption,
} from '@/lib/memories/server/guest-media.service';
import {
	MemoriesSignerError,
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
const mockInFlight = listSessionInFlightMedia as jest.MockedFunction<
	typeof listSessionInFlightMedia
>;
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

function foundInspection(overrides: Record<string, unknown> = {}) {
	return {
		kind: 'found' as const,
		inspection: {
			exists: true,
			sizeBytes: 1_048_576,
			checksumSha256: CHECKSUM_SHA256,
			signatureValid: true,
			durationSeconds: null,
			...overrides,
		},
	};
}

describe('reserveGuestMemoryItem', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRelease.mockResolvedValue(true);
		mockInFlight.mockResolvedValue([]);
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

	it('reserves a browser-reported duration at the stored scale so a retry replays the same row', async () => {
		mockReserve.mockResolvedValue(
			buildMediaRow({
				mime_type: 'video/quicktime',
				duration_seconds: 12.346,
				object_key: OBJECT_KEY.replace('.jpg', '.mov'),
			}),
		);
		mockCapability.mockResolvedValue(buildUploadCapability());
		const video = {
			mimeType: 'video/quicktime',
			sizeBytes: 5_000_000,
			durationSeconds: 12.345678,
		};

		await reserveGuestMemoryItem(reservationInput(video));
		await reserveGuestMemoryItem(reservationInput(video));

		// The catalog column is numeric(10, 3): an unrounded replay reads as another file.
		expect(mockReserve.mock.calls[0][0].durationSeconds).toBe(12.346);
		expect(mockReserve.mock.calls[1][0].durationSeconds).toBe(12.346);
	});

	it('judges the duration limit before rounding it', async () => {
		await expect(
			reserveGuestMemoryItem(
				reservationInput({ mimeType: 'video/mp4', durationSeconds: 60.0004 }),
			),
		).rejects.toMatchObject({ status: 400, code: 'bad_request' });
		expect(mockReserve).not.toHaveBeenCalled();
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

	it.each([
		['memories_session_file_quota', 'session_files'],
		['memories_session_video_quota', 'session_videos'],
		['memories_session_byte_quota', 'session_bytes'],
		['memories_event_object_quota', 'event_capacity'],
		['memories_event_byte_quota', 'event_capacity'],
		['memories_session_concurrency_quota', 'uploads_in_progress'],
	])('names the cause of a %s refusal for the guest copy', async (token, reason) => {
		mockReserve.mockRejectedValue(reservationFailure(token));
		await expect(reserveGuestMemoryItem(reservationInput())).rejects.toMatchObject({
			details: { reason },
		});
	});

	it('rethrows unknown persistence errors untouched', async () => {
		const error = new SupabaseHttpError(500, 'connection reset', null);
		mockReserve.mockRejectedValue(error);
		await expect(reserveGuestMemoryItem(reservationInput())).rejects.toBe(error);
	});

	it.each(['validating', 'accepted', 'duplicate'] as const)(
		'returns a replayed %s reservation without a new upload capability',
		async (status) => {
			mockReserve.mockResolvedValue(buildMediaRow({ status }));

			const result = await reserveGuestMemoryItem(reservationInput());

			expect(result.upload).toBeNull();
			expect(result.item.status).toBe(status);
			expect(mockCapability).not.toHaveBeenCalled();
		},
	);

	it.each(['rejected', 'deleted'] as const)(
		'refuses to reopen a replayed %s reservation',
		async (status) => {
			mockReserve.mockResolvedValue(buildMediaRow({ status }));

			await expect(reserveGuestMemoryItem(reservationInput())).rejects.toMatchObject({
				status: 409,
				code: 'conflict',
			});
			expect(mockCapability).not.toHaveBeenCalled();
		},
	);

	it('settles abandoned in-flight items and retries once when the session is at capacity', async () => {
		mockReserve
			.mockRejectedValueOnce(reservationFailure('memories_session_concurrency_quota'))
			.mockResolvedValueOnce(buildMediaRow());
		mockInFlight.mockResolvedValue([
			buildMediaRow({
				status: 'uploading',
				created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
			}),
		]);
		mockInspect.mockResolvedValue(foundInspection());
		mockClaim.mockResolvedValue(buildMediaRow({ status: 'validating' }));
		mockFinalize.mockResolvedValue(buildMediaRow({ status: 'accepted' }));
		mockCapability.mockResolvedValue(buildUploadCapability());

		const result = await reserveGuestMemoryItem(reservationInput());

		expect(mockInFlight).toHaveBeenCalledWith(EVENT_ID, SESSION_ID);
		expect(mockReserve).toHaveBeenCalledTimes(2);
		expect(mockReserve.mock.calls[1][0]).toEqual(mockReserve.mock.calls[0][0]);
		expect(result.upload).toEqual(buildUploadCapability());
	});

	it('answers 429 without retrying when nothing in flight could be settled', async () => {
		mockReserve.mockRejectedValue(reservationFailure('memories_session_concurrency_quota'));
		mockInFlight.mockResolvedValue([
			buildMediaRow({ status: 'uploading', created_at: new Date().toISOString() }),
		]);

		await expect(reserveGuestMemoryItem(reservationInput())).rejects.toMatchObject({
			status: 429,
			code: 'rate_limited',
		});
		expect(mockReserve).toHaveBeenCalledTimes(1);
		expect(mockInspect).not.toHaveBeenCalled();
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

	it('answers 429, not an outage, when the signer throttles the session', async () => {
		const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		logged.mockClear();
		mockReserve.mockResolvedValue(buildMediaRow());
		mockCapability.mockRejectedValue(new MemoriesSignerError(429));

		await expect(reserveGuestMemoryItem(reservationInput())).rejects.toMatchObject({
			status: 429,
			code: 'rate_limited',
		});
		// The slot is returned so the retry a minute later can reserve again.
		expect(mockRelease).toHaveBeenCalledWith(ITEM_ID, SESSION_ID);
		expect(logged).not.toHaveBeenCalled();
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
		mockInspect.mockResolvedValue({ kind: 'unavailable' });
		await expect(
			completeGuestMemoryItem({ space, session, mediaItemId: ITEM_ID }),
		).rejects.toMatchObject({ status: 503, code: 'service_unavailable' });
		expect(mockFinalize).not.toHaveBeenCalled();
	});

	it('accepts on the retry an upload left validating after the Worker was unavailable', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'validating' }));
		mockInspect.mockResolvedValueOnce({ kind: 'unavailable' });
		await expect(
			completeGuestMemoryItem({ space, session, mediaItemId: ITEM_ID }),
		).rejects.toMatchObject({ status: 503 });

		mockInspect.mockResolvedValueOnce(foundInspection());
		mockFinalize.mockResolvedValue(
			buildMediaRow({ status: 'accepted', accepted_at: '2026-10-24T11:05:00.000Z' }),
		);
		const item = await completeGuestMemoryItem({ space, session, mediaItemId: ITEM_ID });

		expect(item.status).toBe('accepted');
		expect(mockClaim).not.toHaveBeenCalled();
		expect(mockFinalize).toHaveBeenCalledTimes(1);
		expect(mockFinalize).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'accepted' }));
	});

	it('claims validation, inspects and accepts a matching upload', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'uploading' }));
		mockClaim.mockResolvedValue(buildMediaRow({ status: 'validating' }));
		mockInspect.mockResolvedValue(
			foundInspection({ checksumSha256: CHECKSUM_SHA256.toUpperCase() }),
		);
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
		mockInspect.mockResolvedValue(foundInspection({ sizeBytes: 1_048_575 }));
		mockFinalize.mockResolvedValue(buildMediaRow({ status: 'rejected' }));

		const item = await completeGuestMemoryItem({ space, session, mediaItemId: ITEM_ID });

		expect(mockFinalize).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'rejected' }));
		expect(item.status).toBe('rejected');
	});

	it('rejects a confirmed upload whose object the Worker reports absent', async () => {
		mockFind.mockResolvedValue(buildMediaRow({ status: 'validating' }));
		mockInspect.mockResolvedValue({ kind: 'missing' });
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

describe('settleStaleMemoryItem', () => {
	const now = new Date('2026-10-30T06:00:00.000Z');
	const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

	beforeEach(() => {
		jest.clearAllMocks();
		mockFinalize.mockImplementation(async ({ outcome }) => buildMediaRow({ status: outcome }));
	});

	it('leaves a validation alone until its retry delay passed', async () => {
		const row = buildMediaRow({ status: 'validating', updated_at: ago(30) });
		await expect(settleStaleMemoryItem(row, now)).resolves.toBe('pending');
		expect(mockInspect).not.toHaveBeenCalled();
	});

	it('accepts a stale validation whose object matches the reservation', async () => {
		mockInspect.mockResolvedValue(foundInspection());
		const row = buildMediaRow({ status: 'validating', updated_at: ago(120) });

		await expect(settleStaleMemoryItem(row, now)).resolves.toBe('validated');
		expect(mockFinalize).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'accepted' }));
	});

	it('rejects a stale validation only when the Worker reports the object absent', async () => {
		mockInspect.mockResolvedValue({ kind: 'missing' });
		const row = buildMediaRow({ status: 'validating', updated_at: ago(120) });

		await expect(settleStaleMemoryItem(row, now)).resolves.toBe('rejected');
		expect(mockFinalize).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'rejected' }));
	});

	it.each(['validating', 'uploading'] as const)(
		'never settles a %s item when storage cannot be inspected',
		async (status) => {
			mockInspect.mockResolvedValue({ kind: 'unavailable' });
			const row = buildMediaRow({ status, created_at: ago(7200), updated_at: ago(7200) });

			await expect(settleStaleMemoryItem(row, now)).resolves.toBe('pending');
			expect(mockFinalize).not.toHaveBeenCalled();
			expect(mockPatch).not.toHaveBeenCalled();
		},
	);

	it('leaves a young reservation to its browser', async () => {
		const row = buildMediaRow({ status: 'uploading', created_at: ago(300) });
		await expect(settleStaleMemoryItem(row, now)).resolves.toBe('pending');
		expect(mockInspect).not.toHaveBeenCalled();
	});

	it('rescues an upload whose bytes arrived but whose browser never confirmed it', async () => {
		mockInspect.mockResolvedValue(foundInspection());
		mockClaim.mockResolvedValue(buildMediaRow({ status: 'validating' }));
		const row = buildMediaRow({ status: 'uploading', created_at: ago(900) });

		await expect(settleStaleMemoryItem(row, now)).resolves.toBe('rescued');
		expect(mockClaim).toHaveBeenCalledWith(ITEM_ID, SESSION_ID);
		expect(mockFinalize).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'accepted' }));
		expect(mockAudit).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'submitted_for_validation', actorType: 'system' }),
		);
	});

	it('leaves the rescue to the guest when the claim was already taken', async () => {
		mockInspect.mockResolvedValue(foundInspection());
		mockClaim.mockResolvedValue(null);
		const row = buildMediaRow({ status: 'uploading', created_at: ago(900) });

		await expect(settleStaleMemoryItem(row, now)).resolves.toBe('pending');
		expect(mockFinalize).not.toHaveBeenCalled();
	});

	it('keeps an absent upload that may still be streaming on venue Wi-Fi', async () => {
		mockInspect.mockResolvedValue({ kind: 'missing' });
		const row = buildMediaRow({ status: 'uploading', created_at: ago(20 * 60) });

		await expect(settleStaleMemoryItem(row, now)).resolves.toBe('pending');
		expect(mockPatch).not.toHaveBeenCalled();
	});

	it('releases an abandoned upload with a grace period for a late PUT', async () => {
		mockInspect.mockResolvedValue({ kind: 'missing' });
		mockPatch.mockResolvedValue(buildMediaRow({ status: 'deleted' }));
		const row = buildMediaRow({ status: 'uploading', created_at: ago(31 * 60) });

		await expect(settleStaleMemoryItem(row, now)).resolves.toBe('released');
		expect(mockPatch).toHaveBeenCalledWith(
			ITEM_ID,
			{
				status: 'deleted',
				deleted_at: now.toISOString(),
				cleanup_after: new Date(
					now.getTime() + MEMORIES_LATE_UPLOAD_GRACE_SECONDS * 1000,
				).toISOString(),
			},
			'&status=eq.uploading',
		);
		expect(mockAudit).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'reservation_abandoned', actorType: 'system' }),
		);
	});

	it('reports a release lost to a concurrent completion as pending', async () => {
		mockInspect.mockResolvedValue({ kind: 'missing' });
		mockPatch.mockResolvedValue(null);
		const row = buildMediaRow({ status: 'uploading', created_at: ago(31 * 60) });

		await expect(settleStaleMemoryItem(row, now)).resolves.toBe('pending');
		expect(mockAudit).not.toHaveBeenCalled();
	});
});
