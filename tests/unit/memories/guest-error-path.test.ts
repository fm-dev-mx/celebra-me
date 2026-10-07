/**
 * Follows every refusal of a reservation across the layers a guest crosses:
 * database token → service error → HTTP body → browser client → guest copy.
 * A refusal must reach the guest as a message that says what to do next.
 */

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

jest.mock('@/lib/dashboard/api-client', () => ({
	dashboardApi: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

import { createMemoriesGuestApi } from '@/lib/memories/client/api';
import {
	mapRequestIssue,
	memoriesIssueCopy,
	type MemoriesCaptureIssue,
} from '@/lib/memories/client/media-prep';
import { memoriesCaptureCopy as copy } from '@/lib/memories/copy';
import {
	listSessionInFlightMedia,
	releaseReservation,
	reserveMedia,
} from '@/lib/memories/server/catalog.repository';
import { reserveGuestMemoryItem } from '@/lib/memories/server/guest-media.service';
import {
	MemoriesSignerError,
	requestMemoriesUploadCapability,
} from '@/lib/memories/server/worker-gateway';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse } from '@/lib/rsvp/core/http';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import {
	CHECKSUM_SHA256,
	CLIENT_REQUEST_ID,
	PUBLIC_SLUG,
	buildMediaRow,
	buildSessionRow,
	buildSpace,
} from './fixtures';

const mockReserve = reserveMedia as jest.MockedFunction<typeof reserveMedia>;
const mockRelease = releaseReservation as jest.MockedFunction<typeof releaseReservation>;
const mockInFlight = listSessionInFlightMedia as jest.MockedFunction<
	typeof listSessionInFlightMedia
>;
const mockCapability = requestMemoriesUploadCapability as jest.MockedFunction<
	typeof requestMemoriesUploadCapability
>;

const reservation = {
	mimeType: 'image/jpeg',
	sizeBytes: 1_048_576,
	checksumSha256: CHECKSUM_SHA256,
	durationSeconds: undefined,
	clientRequestId: CLIENT_REQUEST_ID,
};

/** What the guest reads when the reservation route answers with `failure`. */
async function guestIssueFor(failure: unknown): Promise<MemoriesCaptureIssue> {
	jest.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(failure));
	const error = await createMemoriesGuestApi(PUBLIC_SLUG)
		.reserve(reservation)
		.catch((caught: unknown) => caught);
	return mapRequestIssue(error, 'sign_failed');
}

async function reserveFailure(): Promise<unknown> {
	return reserveGuestMemoryItem({
		space: buildSpace(),
		session: buildSessionRow(),
		...reservation,
	}).catch((caught: unknown) => caught);
}

describe('reservation refusals reach the guest with a specific message', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		mockRelease.mockResolvedValue(true);
		mockInFlight.mockResolvedValue([]);
	});

	it.each([
		['memories_session_file_quota', 'session_files_reached', copy.sessionFilesReached],
		['memories_session_video_quota', 'session_videos_reached', copy.sessionVideosReached],
		['memories_session_byte_quota', 'session_bytes_reached', copy.sessionBytesReached],
		['memories_event_object_quota', 'event_full', copy.eventFull],
		['memories_event_byte_quota', 'event_full', copy.eventFull],
		['memories_session_concurrency_quota', 'uploads_in_progress', copy.uploadsInProgress],
		['memories_upload_window_closed', 'window_closed', copy.windowClosed],
		['memories_space_unavailable', 'unavailable', copy.unavailable],
		['memories_session_unavailable', 'session_lost', copy.sessionLost],
		['memories_idempotency_conflict', 'upload_expired', copy.uploadExpired],
	] as const)('%s → %s', async (token, issue, message) => {
		mockReserve.mockRejectedValue(
			new SupabaseHttpError(400, `{"code":"P0001","message":"${token}"}`, 'P0001'),
		);

		const guestIssue = await guestIssueFor(await reserveFailure());

		expect(guestIssue).toBe(issue);
		expect(memoriesIssueCopy(guestIssue)).toBe(message);
	});

	it('a per-session throttle of the Sign Worker reads as "wait", not as an outage', async () => {
		mockReserve.mockResolvedValue(buildMediaRow());
		mockCapability.mockRejectedValue(new MemoriesSignerError(429));

		const guestIssue = await guestIssueFor(await reserveFailure());

		expect(guestIssue).toBe('rate_limited');
		expect(memoriesIssueCopy(guestIssue)).toBe(copy.rateLimited);
	});

	it('an unreachable Sign Worker reads as unavailable', async () => {
		mockReserve.mockResolvedValue(buildMediaRow());
		mockCapability.mockRejectedValue(new MemoriesSignerError(503));

		expect(await guestIssueFor(await reserveFailure())).toBe('unavailable');
	});

	it('the app rate limit and a missing session keep their own messages', async () => {
		expect(
			await guestIssueFor(new ApiError(429, 'rate_limited', 'Demasiadas solicitudes.')),
		).toBe('rate_limited');
		expect(
			await guestIssueFor(
				new ApiError(401, 'unauthorized', 'Inicie una sesión de recuerdos.'),
			),
		).toBe('session_lost');
	});

	it('never leaks database detail on an unexpected failure', async () => {
		const response = errorResponse(new SupabaseHttpError(500, 'connection reset', null));
		expect(await response.json()).toMatchObject({ error: { code: 'internal_error' } });
		expect(await guestIssueFor(new SupabaseHttpError(500, 'connection reset', null))).toBe(
			'sign_failed',
		);
	});
});

describe('guest copy', () => {
	// The record type forces this list to name every issue the capture island can show.
	const ISSUES: Record<MemoriesCaptureIssue, true> = {
		unsupported_type: true,
		file_too_large: true,
		video_too_large: true,
		video_too_long: true,
		video_unreadable: true,
		window_closed: true,
		rate_limited: true,
		uploads_in_progress: true,
		quota_reached: true,
		session_files_reached: true,
		session_videos_reached: true,
		session_bytes_reached: true,
		event_full: true,
		session_lost: true,
		sign_failed: true,
		put_failed: true,
		network_failed: true,
		upload_expired: true,
		unavailable: true,
	};

	it('has a distinct Spanish sentence for every issue', () => {
		const messages = (Object.keys(ISSUES) as MemoriesCaptureIssue[]).map(memoriesIssueCopy);
		for (const message of messages) expect(message).toMatch(/^[A-ZÁÉÍÓÚÑ].+\.$/);
		// `unavailable` and the page-level disabled notice may share wording; issues may not.
		expect(new Set(messages).size).toBe(messages.length);
	});

	it.each([
		'file_too_large',
		'video_too_large',
		'video_too_long',
		'video_unreadable',
		'rate_limited',
		'uploads_in_progress',
		'session_files_reached',
		'session_videos_reached',
		'session_bytes_reached',
		'event_full',
		'session_lost',
		'sign_failed',
		'put_failed',
		'network_failed',
		'upload_expired',
	] as const)('tells the guest what to do after %s', (issue) => {
		expect(memoriesIssueCopy(issue)).toMatch(
			/intente|espere|recargue|avise|toque|puede subir|no puede durar|si elimina/i,
		);
	});
});
