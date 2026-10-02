/**
 * One memory space from opening to purge, through the real app services and the
 * real Sign and Retrieval Worker handlers. Only storage (R2) and the catalog
 * (Postgres) are in-memory doubles; see `memories-stack.ts`.
 *
 * The steps share state and run in order: open → upload → close → download →
 * retention end → purge.
 */

jest.mock('@/lib/memories/server/catalog.repository', () => {
	const stack = jest.requireActual<typeof import('./memories-stack')>('./memories-stack');
	return stack.catalog.module;
});

import {
	MEMORIES_SESSION_MAX_IN_FLIGHT,
	MEMORIES_SIGN_RATE_LIMIT,
	MEMORIES_UPLOAD_ABANDON_SECONDS,
} from '@/lib/memories/contract/limits';
import type { MemoriesSpaceRecord } from '@/lib/memories/contract/catalog';
import type { SessionRow } from '@/lib/memories/server/catalog.repository';
import { runMemoriesCleanup } from '@/lib/memories/server/cleanup.service';
import {
	completeGuestMemoryItem,
	deleteGuestMemoryItem,
	getMediaObjectForRetrieval,
	listGuestMemoryItems,
	reserveGuestMemoryItem,
} from '@/lib/memories/server/guest-media.service';
import { retrieveMemoriesObject } from '@/lib/memories/server/worker-gateway';
import { buildSpace } from '../unit/memories/fixtures';
import {
	BROWSER_ORIGIN,
	catalog,
	heicPhoto,
	jpegPhoto,
	phoneVideo,
	pngBytes,
	readStream,
	sha256Hex,
	startMemoriesStack,
	type MediaSample,
	type MemoriesStack,
} from './memories-stack';

const OPENS = '2026-10-23T07:00:00.000Z';
const CLOSES = '2026-11-07T07:00:00.000Z';
const RETENTION_ENDS = '2027-01-06T07:00:00.000Z';
const PARTY = new Date('2026-10-31T04:00:00.000Z');
const MINUTE = 60_000;

let stack: MemoriesStack;
let space: MemoriesSpaceRecord;
let guestA: SessionRow;
let guestB: SessionRow;
let requestCounter = 0;

function setClock(date: Date): void {
	jest.setSystemTime(date);
}

function advanceClock(milliseconds: number): void {
	jest.setSystemTime(Date.now() + milliseconds);
}

function nextRequestId(): string {
	requestCounter += 1;
	return `d0000000-0000-4000-8000-${String(requestCounter).padStart(12, '0')}`;
}

function reserve(session: SessionRow, sample: MediaSample, clientRequestId: string) {
	return reserveGuestMemoryItem({
		space,
		session,
		mimeType: sample.mimeType,
		sizeBytes: sample.bytes.byteLength,
		checksumSha256: sha256Hex(sample.bytes),
		durationSeconds: sample.durationSeconds,
		clientRequestId,
	});
}

/** The browser's PUT to the Sign Worker with the headers the reservation returned. */
function putToWorker(
	upload: { uploadUrl: string; requiredHeaders: Record<string, string> },
	bytes: Uint8Array,
): Promise<Response> {
	return fetch(upload.uploadUrl, {
		method: 'PUT',
		headers: { ...upload.requiredHeaders, Origin: BROWSER_ORIGIN },
		body: bytes as BodyInit,
	});
}

/** The whole guest flow for one file on a good connection. */
async function uploadFile(session: SessionRow, sample: MediaSample, sentBytes = sample.bytes) {
	const reservation = await reserve(session, sample, nextRequestId());
	if (!reservation.upload) throw new Error('Expected an upload capability.');
	const put = await putToWorker(reservation.upload, sentBytes);
	const item = await completeGuestMemoryItem({
		space,
		session,
		mediaItemId: reservation.item.id,
	});
	return { put, item };
}

async function download(mediaItemId: string, range?: string) {
	const object = await getMediaObjectForRetrieval(space, mediaItemId);
	const response = await retrieveMemoriesObject({ ...object, mode: 'attachment', range });
	return { response, bytes: await readStream(response.body) };
}

beforeAll(() => {
	jest.useFakeTimers({
		doNotFake: [
			'hrtime',
			'nextTick',
			'performance',
			'queueMicrotask',
			'requestAnimationFrame',
			'cancelAnimationFrame',
			'requestIdleCallback',
			'cancelIdleCallback',
			'setImmediate',
			'clearImmediate',
			'setInterval',
			'clearInterval',
			'setTimeout',
			'clearTimeout',
		],
		now: PARTY,
	});
	stack = startMemoriesStack();
	space = buildSpace({
		uploadStartsAt: OPENS,
		uploadEndsAt: CLOSES,
		retentionEndsAt: RETENTION_ENDS,
	});
	catalog.reset(space);
	guestA = catalog.addSession('Tía Ana');
	guestB = catalog.addSession('Primo Luis');
});

afterAll(() => {
	stack.restore();
	jest.useRealTimers();
});

describe('memory space lifecycle', () => {
	const photo = jpegPhoto(1);
	const heic = heicPhoto(2);
	// A minute-long 60 fps clip: the `moov` atom alone exceeds the 64 KiB read window.
	const video = phoneVideo({ seed: 3, durationSeconds: 12.345678, moovBytes: 90 * 1024 });
	const accepted: Record<string, string> = {};

	it('before the window opens, a reservation is refused and nothing is stored', async () => {
		setClock(new Date(Date.parse(OPENS) - MINUTE));

		await expect(reserve(guestA, photo, nextRequestId())).rejects.toMatchObject({
			status: 403,
			code: 'forbidden',
		});
		expect(stack.bucket.objects.size).toBe(0);
		expect(catalog.items).toHaveLength(0);
	});

	it('open: a photo is reserved, sent to the Worker, validated and accepted', async () => {
		setClock(PARTY);

		const { put, item } = await uploadFile(guestA, photo);

		expect(put.status).toBe(201);
		expect(item.status).toBe('accepted');
		expect([...stack.bucket.objects.values()][0]).toEqual(photo.bytes);
		accepted.photo = item.id;
	});

	it('open: an iPhone HEIC photo is accepted as sent', async () => {
		const { item } = await uploadFile(guestA, heic);

		expect(item).toMatchObject({ status: 'accepted', mimeType: 'image/heic' });
		accepted.heic = item.id;
	});

	it('open: a video whose connection drops is retried on the same reservation', async () => {
		const requestId = nextRequestId();
		const first = await reserve(guestA, video, requestId);
		if (!first.upload) throw new Error('Expected an upload capability.');
		stack.nextUploadFault = 'drop_request';
		await expect(putToWorker(first.upload, video.bytes)).rejects.toThrow('Load failed');

		// "Intentar de nuevo" sends the same request id and the same browser-reported duration.
		const retry = await reserve(guestA, video, requestId);
		if (!retry.upload) throw new Error('Expected a fresh upload capability.');
		const put = await putToWorker(retry.upload, video.bytes);
		const item = await completeGuestMemoryItem({
			space,
			session: guestA,
			mediaItemId: retry.item.id,
		});

		expect(retry.item.id).toBe(first.item.id);
		expect(put.status).toBe(201);
		// The duration is read from a `moov` atom that sits after the media data.
		expect(item).toMatchObject({ status: 'accepted', durationSeconds: 12.346 });
		expect(catalog.items.filter((row) => row.mime_type === 'video/quicktime')).toHaveLength(1);
		accepted.video = item.id;
	});

	it('open: a file already stored whose answer was lost is confirmed, not sent twice', async () => {
		const sample = jpegPhoto(4);
		const requestId = nextRequestId();
		const first = await reserve(guestB, sample, requestId);
		if (!first.upload) throw new Error('Expected an upload capability.');
		stack.nextUploadFault = 'lose_response';
		await expect(putToWorker(first.upload, sample.bytes)).rejects.toThrow('Load failed');

		const retry = await reserve(guestB, sample, requestId);
		if (!retry.upload) throw new Error('Expected a fresh upload capability.');
		const put = await putToWorker(retry.upload, sample.bytes);
		const item = await completeGuestMemoryItem({
			space,
			session: guestB,
			mediaItemId: retry.item.id,
		});

		// 412 is the browser's cue to go on to "complete" instead of reporting a failure.
		expect(put.status).toBe(412);
		expect(item.status).toBe('accepted');
		accepted.recovered = item.id;
	});

	it('open: the same photo from another guest is kept once', async () => {
		const { item } = await uploadFile(guestB, photo);
		expect(item.status).toBe('duplicate');
	});

	it('open: bytes that are not what the guest declared are rejected by the Worker inspection', async () => {
		const disguised: MediaSample = { bytes: pngBytes(), mimeType: 'image/jpeg' };
		const { put, item } = await uploadFile(guestB, disguised);

		expect(put.status).toBe(201);
		expect(item.status).toBe('rejected');
	});

	it('open: the Sign Worker throttle reaches the guest as "too many requests"', async () => {
		advanceClock(2 * MINUTE);
		const outcomes: Array<number | 'reserved'> = [];
		for (let attempt = 0; attempt <= MEMORIES_SIGN_RATE_LIMIT.limit; attempt += 1) {
			// The same request id keeps one reservation, so only the signer is exercised.
			const outcome = await reserve(
				guestB,
				jpegPhoto(5),
				'd0000000-0000-4000-8000-00000000aaaa',
			)
				.then(() => 'reserved' as const)
				.catch((error: { status: number }) => error.status);
			outcomes.push(outcome);
		}

		expect(outcomes.slice(0, MEMORIES_SIGN_RATE_LIMIT.limit)).toEqual(
			Array.from({ length: MEMORIES_SIGN_RATE_LIMIT.limit }, () => 'reserved'),
		);
		expect(outcomes.at(-1)).toBe(429);
		// The throttled attempt released its slot, so nothing stays in flight for it.
		expect(
			catalog.items.filter(
				(row) => row.idempotency_key === 'd0000000-0000-4000-8000-00000000aaaa',
			),
		).toHaveLength(0);
	});

	it('open: an upload the guest abandoned frees its in-flight slot after the cleanup', async () => {
		advanceClock(2 * MINUTE);
		for (let slot = 0; slot < MEMORIES_SESSION_MAX_IN_FLIGHT; slot += 1) {
			await reserve(guestA, jpegPhoto(10 + slot), nextRequestId());
		}
		await expect(reserve(guestA, jpegPhoto(20), nextRequestId())).rejects.toMatchObject({
			status: 429,
			details: { reason: 'uploads_in_progress' },
		});

		advanceClock((MEMORIES_UPLOAD_ABANDON_SECONDS + 60) * 1000);
		const cleanup = await runMemoriesCleanup(new Date());

		expect(cleanup.uploadsReleased).toBe(MEMORIES_SESSION_MAX_IN_FLIGHT);
		const quota = (await listGuestMemoryItems(space, guestA)).quota;
		expect(quota.inFlight.used).toBe(0);
		// The same pass removed the duplicate and the rejected file from storage.
		expect(cleanup.deleted).toBe(2);
		// Released keys stay scheduled for an hour so a PUT that still lands is removed too.
		const released = catalog.items.filter(
			(row) => row.status === 'deleted' && row.session_id === guestA.id,
		);
		expect(released).toHaveLength(MEMORIES_SESSION_MAX_IN_FLIGHT);
		expect(released.every((row) => row.object_deleted_at === null)).toBe(true);
	});

	it('open: a file the guest deletes disappears from the catalog and, after the cleanup, from storage', async () => {
		const { item } = await uploadFile(guestA, jpegPhoto(30));
		const objectsBefore = stack.bucket.objects.size;

		await deleteGuestMemoryItem({ space, session: guestA, mediaItemId: item.id });
		const listed = await listGuestMemoryItems(space, guestA);
		const cleanup = await runMemoriesCleanup(new Date());

		expect(listed.items.map((entry) => entry.id)).not.toContain(item.id);
		expect(cleanup.deleted).toBeGreaterThanOrEqual(1);
		expect(stack.bucket.objects.size).toBeLessThan(objectsBefore);
	});

	it('closed: new uploads are refused while guests still see what they shared', async () => {
		setClock(new Date(Date.parse(CLOSES) + MINUTE));

		await expect(reserve(guestA, jpegPhoto(40), nextRequestId())).rejects.toMatchObject({
			status: 403,
			code: 'forbidden',
		});
		const listed = await listGuestMemoryItems(space, guestA);
		expect(listed.items.map((entry) => entry.id)).toEqual(
			expect.arrayContaining([accepted.photo, accepted.heic, accepted.video]),
		);
	});

	it('closed: the host downloads every accepted original byte for byte', async () => {
		const photoDownload = await download(accepted.photo);
		const heicDownload = await download(accepted.heic);
		const videoDownload = await download(accepted.video);

		expect(photoDownload.response.status).toBe(200);
		expect(photoDownload.bytes).toEqual(photo.bytes);
		expect(photoDownload.response.headers.get('Content-Disposition')).toMatch(
			/^attachment; filename="recuerdo-.+\.jpg"$/,
		);
		expect(heicDownload.bytes).toEqual(heic.bytes);
		expect(videoDownload.bytes).toEqual(video.bytes);
		expect(videoDownload.response.headers.get('Content-Type')).toBe('video/quicktime');
	});

	it('closed: a video is served in ranges so it can be played before it is fully downloaded', async () => {
		const { response, bytes } = await download(accepted.video, 'bytes=0-1023');

		expect(response.status).toBe(206);
		expect(response.headers.get('Content-Range')).toBe(
			`bytes 0-1023/${video.bytes.byteLength}`,
		);
		expect(bytes).toEqual(video.bytes.subarray(0, 1024));
	});

	it('retention end: the cleanup removes every object and anonymizes every guest', async () => {
		setClock(new Date(Date.parse(RETENTION_ENDS) + MINUTE));
		expect(stack.bucket.objects.size).toBeGreaterThan(0);

		const cleanup = await runMemoriesCleanup(new Date());

		expect(cleanup.failed).toBe(0);
		expect(cleanup.expiredContent).toBeGreaterThanOrEqual(4);
		expect(cleanup.deleted).toBe(cleanup.claimed);
		expect(stack.bucket.objects.size).toBe(0);
		expect(catalog.items.every((row) => row.object_deleted_at !== null)).toBe(true);
		expect(catalog.items.every((row) => row.caption === '')).toBe(true);
		expect(catalog.sessions.map((session) => session.display_name)).toEqual([
			'Invitado retirado',
			'Invitado retirado',
		]);
		expect(cleanup.anonymized).toBe(2);
	});

	it('after the purge: nothing can be downloaded or uploaded', async () => {
		await expect(getMediaObjectForRetrieval(space, accepted.photo)).rejects.toMatchObject({
			status: 404,
		});
		await expect(reserve(guestA, jpegPhoto(50), nextRequestId())).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});
	});
});
