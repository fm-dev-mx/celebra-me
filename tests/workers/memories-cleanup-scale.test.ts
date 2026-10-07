/**
 * The daily cleanup against a full event: how long the purge after retention
 * takes at the pace its time budget allows, and what a missed or failed run
 * leaves behind. Real cleanup service and Retrieval Worker; storage and catalog
 * are the in-memory doubles from `memories-stack.ts`.
 */

jest.mock('@/lib/memories/server/catalog.repository', () => {
	const stack = jest.requireActual<typeof import('./memories-stack')>('./memories-stack');
	return stack.catalog.module;
});

import { randomUUID } from 'node:crypto';
import {
	resolveMemoriesWindowState,
	type MemoriesSpaceRecord,
} from '@/lib/memories/contract/catalog';
import {
	MEMORIES_CLEANUP_BATCH_SIZE,
	MEMORIES_CLEANUP_LEASE_SECONDS,
	MEMORIES_CLEANUP_TIME_BUDGET_MS,
	MEMORIES_LIMIT_PROFILES,
} from '@/lib/memories/contract/limits';
import { buildMemoriesObjectKey } from '@/lib/memories/contract/object-key';
import type { MediaRow, SessionRow } from '@/lib/memories/server/catalog.repository';
import { runMemoriesCleanup } from '@/lib/memories/server/cleanup.service';
import { getMediaObjectForRetrieval } from '@/lib/memories/server/guest-media.service';
import { buildMediaRow, buildSpace } from '../unit/memories/fixtures';
import { catalog, sha256Hex, startMemoriesStack, type MemoriesStack } from './memories-stack';

const RETENTION_ENDS = '2027-01-06T07:00:00.000Z';
const UPLOADED_AT = '2026-10-31T04:00:00.000Z';
const DAY = 24 * 60 * 60 * 1000;
const GUESTS = 150;
/** Assumed round trip of one delete through the Retrieval Worker; not a measurement. */
const DELETE_LATENCY_MS = 300;
/** A full space is 1,500 signed Worker requests: slow on a loaded CI runner, never on its own. */
const FULL_EVENT_TEST_TIMEOUT_MS = 120_000;

let stack: MemoriesStack;
let space: MemoriesSpaceRecord;

/** Fills the space to its file quota with accepted photos, ten per guest. */
function seedFullEvent(objects: number): MediaRow[] {
	const sessions: SessionRow[] = Array.from({ length: GUESTS }, (_, index) =>
		catalog.addSession(`Invitado ${index + 1}`),
	);
	const rows: MediaRow[] = [];
	for (let index = 0; index < objects; index += 1) {
		const bytes = new Uint8Array([0xff, 0xd8, 0xff, index & 0xff, (index >> 8) & 0xff]);
		const objectKey = buildMemoriesObjectKey(space.eventId, randomUUID(), 'jpg');
		stack.bucket.objects.set(objectKey, bytes);
		rows.push(
			buildMediaRow({
				id: randomUUID(),
				session_id: sessions[index % GUESTS].id,
				object_key: objectKey,
				size_bytes: bytes.byteLength,
				checksum_sha256: sha256Hex(bytes),
				status: 'accepted',
				created_at: UPLOADED_AT,
				updated_at: UPLOADED_AT,
				accepted_at: UPLOADED_AT,
				idempotency_key: randomUUID(),
			}),
		);
	}
	catalog.items.push(...rows);
	return rows;
}

function resetStack(now: Date): void {
	jest.setSystemTime(now);
	stack.bucket.objects.clear();
	stack.retrieveWorkerDown = false;
	stack.beforeRequest = null;
	// Sessions are created during the event: their clock must be inside retention.
	jest.setSystemTime(new Date(UPLOADED_AT));
	catalog.reset(space);
	jest.setSystemTime(now);
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
		now: new Date(UPLOADED_AT),
	});
	stack = startMemoriesStack();
	space = buildSpace({
		uploadStartsAt: '2026-10-23T07:00:00.000Z',
		uploadEndsAt: '2026-11-07T07:00:00.000Z',
		retentionEndsAt: RETENTION_ENDS,
	});
});

afterAll(() => {
	stack.restore();
	jest.useRealTimers();
});

describe('purge of a full event after retention', () => {
	const objects = MEMORIES_LIMIT_PROFILES.standard.maxEventObjects;
	// A run starts a new batch while it is inside its budget, so it overshoots by at most one.
	const batchMs = MEMORIES_CLEANUP_BATCH_SIZE * DELETE_LATENCY_MS;
	const objectsPerRun =
		Math.ceil(MEMORIES_CLEANUP_TIME_BUDGET_MS / batchMs) * MEMORIES_CLEANUP_BATCH_SIZE;

	it(
		'hides everything on the first run and removes the objects over the following daily runs',
		async () => {
			resetStack(new Date(Date.parse(RETENTION_ENDS) + 60_000));
			seedFullEvent(objects);
			stack.beforeRequest = () => jest.setSystemTime(Date.now() + DELETE_LATENCY_MS);

			const first = await runMemoriesCleanup(new Date());

			expect(first.expiredContent).toBe(objects);
			expect(catalog.items.every((row) => row.status === 'deleted')).toBe(true);
			expect(first.deleted).toBe(objectsPerRun);
			expect(stack.bucket.objects.size).toBe(objects - objectsPerRun);

			let runs = 1;
			while (stack.bucket.objects.size > 0) {
				jest.setSystemTime(Date.now() + DAY);
				const run = await runMemoriesCleanup(new Date());
				runs += 1;
				expect(run.failed).toBe(0);
				expect(run.deleted).toBe(run.claimed);
				expect(run.deleted).toBeGreaterThan(0);
				if (runs > objects) throw new Error('The purge is not converging.');
			}

			// At 300 ms per object the 20 s budget removes 75 objects per day: 20 daily runs
			// for a full Standard space. The R2 lifecycle rule stays as the final backstop.
			expect(objectsPerRun).toBe(75);
			expect(runs).toBe(Math.ceil(objects / objectsPerRun));
			expect(runs).toBe(20);
			expect(catalog.sessions.every((session) => session.anonymized_at !== null)).toBe(true);
		},
		FULL_EVENT_TEST_TIMEOUT_MS,
	);

	it('retries the objects of a failed run once their lease expires, without losing any', async () => {
		resetStack(new Date(Date.parse(RETENTION_ENDS) + 60_000));
		seedFullEvent(60);
		stack.retrieveWorkerDown = true;

		const outage = await runMemoriesCleanup(new Date());

		expect(outage).toMatchObject({
			expiredContent: 60,
			claimed: MEMORIES_CLEANUP_BATCH_SIZE,
			deleted: 0,
			failed: MEMORIES_CLEANUP_BATCH_SIZE,
		});
		expect(stack.bucket.objects.size).toBe(60);

		stack.retrieveWorkerDown = false;
		// Still inside the lease: the failed batch is skipped, the rest is deleted.
		const sameDay = await runMemoriesCleanup(new Date());
		expect(sameDay.deleted).toBe(60 - MEMORIES_CLEANUP_BATCH_SIZE);

		jest.setSystemTime(Date.now() + (MEMORIES_CLEANUP_LEASE_SECONDS + 1) * 1000);
		const afterLease = await runMemoriesCleanup(new Date());

		expect(afterLease.deleted).toBe(MEMORIES_CLEANUP_BATCH_SIZE);
		expect(stack.bucket.objects.size).toBe(0);
	});
});

describe('a cleanup that did not run', () => {
	it('leaves files reachable by the host route until the first run after retention', async () => {
		// Vercel Hobby delivers the daily cron on a best-effort basis: five days were missed.
		resetStack(new Date(Date.parse(RETENTION_ENDS) + 5 * DAY));
		const [row] = seedFullEvent(3);

		// Guests are cut off by the clock alone; the page shows the closure message.
		expect(resolveMemoriesWindowState(space, new Date())).toBe('expired');
		// The host download does not look at the clock: it works until the rows are expired.
		await expect(getMediaObjectForRetrieval(space, row.id)).resolves.toMatchObject({
			objectKey: row.object_key,
		});

		const catchUp = await runMemoriesCleanup(new Date());

		expect(catchUp).toMatchObject({ expiredContent: 3, deleted: 3, failed: 0 });
		expect(stack.bucket.objects.size).toBe(0);
		await expect(getMediaObjectForRetrieval(space, row.id)).rejects.toMatchObject({
			status: 404,
		});
	});

	it('catches up on uploads abandoned days ago in a single run', async () => {
		resetStack(new Date('2026-11-01T16:00:00.000Z'));
		const guest = catalog.addSession('Tía Ana');
		const abandonedAt = new Date(Date.now() - 3 * DAY).toISOString();
		const stale = Array.from({ length: 40 }, () =>
			buildMediaRow({
				id: randomUUID(),
				session_id: guest.id,
				object_key: buildMemoriesObjectKey(space.eventId, randomUUID(), 'jpg'),
				status: 'uploading',
				created_at: abandonedAt,
				updated_at: abandonedAt,
				idempotency_key: randomUUID(),
			}),
		);
		catalog.items.push(...stale);

		const run = await runMemoriesCleanup(new Date());

		// More than one page of stale rows is walked and every one is released.
		expect(stale.length).toBeGreaterThan(MEMORIES_CLEANUP_BATCH_SIZE);
		expect(run).toMatchObject({
			uploadsReleased: 40,
			settleComplete: true,
			inFlightPending: 0,
		});
		expect(catalog.items.every((item) => item.status === 'deleted')).toBe(true);
	});
});
