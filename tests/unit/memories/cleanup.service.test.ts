jest.mock('@/lib/memories/server/catalog.repository', () => ({
	anonymizeSession: jest.fn(),
	claimCleanup: jest.fn(),
	expireContent: jest.fn(),
	listSessionsPendingAnonymization: jest.fn(),
	listStaleInFlightMedia: jest.fn(),
	markObjectDeleted: jest.fn(),
	purgeAudit: jest.fn(),
}));

jest.mock('@/lib/memories/server/worker-gateway', () => ({
	deleteMemoriesObject: jest.fn(),
}));

jest.mock('@/lib/memories/server/guest-media.service', () => ({
	settleStaleMemoryItem: jest.fn(),
}));

jest.mock('@/lib/memories/server/audit', () => ({
	appendMemoriesAudit: jest.fn().mockResolvedValue(undefined),
}));

import {
	MEMORIES_CLEANUP_BATCH_SIZE,
	MEMORIES_CLEANUP_LEASE_SECONDS,
	MEMORIES_RESERVATION_TTL_SECONDS,
	MEMORIES_VALIDATION_RETRY_DELAY_SECONDS,
} from '@/lib/memories/contract/limits';
import { isMemoriesUuid } from '@/lib/memories/contract/catalog';
import { appendMemoriesAudit } from '@/lib/memories/server/audit';
import {
	anonymizeSession,
	claimCleanup,
	expireContent,
	listSessionsPendingAnonymization,
	listStaleInFlightMedia,
	markObjectDeleted,
	purgeAudit,
} from '@/lib/memories/server/catalog.repository';
import { runMemoriesCleanup } from '@/lib/memories/server/cleanup.service';
import { settleStaleMemoryItem } from '@/lib/memories/server/guest-media.service';
import { deleteMemoriesObject } from '@/lib/memories/server/worker-gateway';
import { EVENT_ID, NOW, OTHER_SESSION_ID, SESSION_ID, buildMediaRow } from './fixtures';

const mockAnonymize = anonymizeSession as jest.MockedFunction<typeof anonymizeSession>;
const mockClaim = claimCleanup as jest.MockedFunction<typeof claimCleanup>;
const mockExpireContent = expireContent as jest.MockedFunction<typeof expireContent>;
const mockPendingSessions = listSessionsPendingAnonymization as jest.MockedFunction<
	typeof listSessionsPendingAnonymization
>;
const mockStale = listStaleInFlightMedia as jest.MockedFunction<typeof listStaleInFlightMedia>;
const mockMarkDeleted = markObjectDeleted as jest.MockedFunction<typeof markObjectDeleted>;
const mockPurge = purgeAudit as jest.MockedFunction<typeof purgeAudit>;
const mockDeleteObject = deleteMemoriesObject as jest.MockedFunction<typeof deleteMemoriesObject>;
const mockSettle = settleStaleMemoryItem as jest.MockedFunction<typeof settleStaleMemoryItem>;
const mockAudit = appendMemoriesAudit as jest.MockedFunction<typeof appendMemoriesAudit>;

const EXPIRED_SESSION_ID = 'a0000000-0000-4000-8000-0000000000e1';
const ITEM_A = 'b0000000-0000-4000-8000-0000000000c1';
const ITEM_B = 'b0000000-0000-4000-8000-0000000000c2';
const ITEM_C = 'b0000000-0000-4000-8000-0000000000c3';

function claimedRow(id: string, sessionId: string) {
	return buildMediaRow({
		id,
		session_id: sessionId,
		status: 'deleted',
		deleted_at: '2026-10-23T00:00:00.000Z',
		cleanup_after: '2026-10-23T00:00:00.000Z',
		cleanup_claimed_at: NOW.toISOString(),
		object_key: `events/${EVENT_ID}/${id}.jpg`,
	});
}

function inFlightRow(
	id: string,
	status: 'uploading' | 'validating',
	at = '2026-10-24T11:00:00.000Z',
) {
	return buildMediaRow({ id, status, created_at: at, updated_at: at });
}

function staleRowsFor(rowsByStatus: Partial<Record<'uploading' | 'validating', unknown[][]>>) {
	const queues = {
		uploading: [...(rowsByStatus.uploading ?? [])],
		validating: [...(rowsByStatus.validating ?? [])],
	};
	mockStale.mockImplementation(
		async ({ status }) => (queues[status].shift() ?? []) as ReturnType<typeof buildMediaRow>[],
	);
}

function primeQuietRun() {
	mockStale.mockResolvedValue([]);
	mockSettle.mockResolvedValue('pending');
	mockExpireContent.mockResolvedValue(0);
	mockClaim.mockResolvedValue([]);
	mockDeleteObject.mockResolvedValue(true);
	mockMarkDeleted.mockResolvedValue(undefined);
	mockPendingSessions.mockResolvedValue([]);
	mockAnonymize.mockResolvedValue(true);
	mockPurge.mockResolvedValue(0);
}

describe('runMemoriesCleanup', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		primeQuietRun();
	});

	it('looks for stale in-flight items with cutoffs derived from the global limits', async () => {
		mockExpireContent.mockResolvedValue(2);

		const result = await runMemoriesCleanup(NOW);

		expect(mockStale).toHaveBeenCalledWith({
			status: 'validating',
			cutoff: new Date(
				NOW.getTime() - MEMORIES_VALIDATION_RETRY_DELAY_SECONDS * 1000,
			).toISOString(),
			limit: MEMORIES_CLEANUP_BATCH_SIZE,
			after: null,
		});
		expect(mockStale).toHaveBeenCalledWith({
			status: 'uploading',
			cutoff: new Date(NOW.getTime() - MEMORIES_RESERVATION_TTL_SECONDS * 1000).toISOString(),
			limit: MEMORIES_CLEANUP_BATCH_SIZE,
			after: null,
		});
		expect(mockExpireContent).toHaveBeenCalledWith(NOW.toISOString());
		expect(mockPurge).toHaveBeenCalledWith(NOW.toISOString());
		expect(result).toMatchObject({
			expiredContent: 2,
			claimed: 0,
			inFlightPending: 0,
			settleComplete: true,
		});
	});

	it('settles every stale item from storage evidence and tallies each outcome', async () => {
		staleRowsFor({
			validating: [
				[
					inFlightRow(ITEM_A, 'validating'),
					inFlightRow(ITEM_B, 'validating'),
					inFlightRow(ITEM_C, 'validating'),
				],
			],
			uploading: [
				[
					inFlightRow('b0000000-0000-4000-8000-0000000000d1', 'uploading'),
					inFlightRow('b0000000-0000-4000-8000-0000000000d2', 'uploading'),
				],
			],
		});
		mockSettle
			.mockResolvedValueOnce('validated')
			.mockResolvedValueOnce('rejected')
			.mockResolvedValueOnce('pending')
			.mockResolvedValueOnce('rescued')
			.mockResolvedValueOnce('released');

		const result = await runMemoriesCleanup(NOW);

		expect(mockSettle).toHaveBeenCalledTimes(5);
		for (const [, now] of mockSettle.mock.calls) expect(now).toBe(NOW);
		expect(result).toMatchObject({
			validationSettled: 1,
			validationRejected: 1,
			uploadsRescued: 1,
			uploadsReleased: 1,
			inFlightPending: 1,
			settleComplete: true,
		});
	});

	it('walks past rows it had to leave pending with a keyset cursor', async () => {
		const firstPage = Array.from({ length: MEMORIES_CLEANUP_BATCH_SIZE }, (_, index) =>
			inFlightRow(
				`c0000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
				'validating',
				`2026-10-24T10:${String(index).padStart(2, '0')}:00.000Z`,
			),
		);
		staleRowsFor({ validating: [firstPage, [inFlightRow(ITEM_A, 'validating')]] });

		const result = await runMemoriesCleanup(NOW);

		const validatingCalls = mockStale.mock.calls
			.map(([input]) => input)
			.filter((input) => input.status === 'validating');
		expect(validatingCalls).toHaveLength(2);
		const last = firstPage[firstPage.length - 1];
		expect(validatingCalls[1].after).toEqual({ at: last.updated_at, id: last.id });
		expect(mockSettle).toHaveBeenCalledTimes(MEMORIES_CLEANUP_BATCH_SIZE + 1);
		expect(result).toMatchObject({
			inFlightPending: MEMORIES_CLEANUP_BATCH_SIZE + 1,
			settleComplete: true,
		});
	});

	it('pages uploads by reservation age', async () => {
		const firstPage = Array.from({ length: MEMORIES_CLEANUP_BATCH_SIZE }, (_, index) =>
			buildMediaRow({
				id: `d0000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
				status: 'uploading',
				created_at: `2026-10-24T09:${String(index).padStart(2, '0')}:00.000Z`,
				updated_at: '2026-10-24T11:59:00.000Z',
			}),
		);
		staleRowsFor({ uploading: [firstPage, []] });

		await runMemoriesCleanup(NOW);

		const uploadingCalls = mockStale.mock.calls
			.map(([input]) => input)
			.filter((input) => input.status === 'uploading');
		const last = firstPage[firstPage.length - 1];
		expect(uploadingCalls[1].after).toEqual({ at: last.created_at, id: last.id });
	});

	it('stops settling at its budget share and reports the walk as incomplete', async () => {
		let elapsed = 0;
		const base = 1_700_000_000_000;
		jest.spyOn(Date, 'now').mockImplementation(() => base + elapsed);
		mockStale.mockImplementation(async ({ status }) => {
			elapsed += 60;
			return Array.from({ length: MEMORIES_CLEANUP_BATCH_SIZE }, (_, index) =>
				inFlightRow(`e0000000-0000-4000-8000-${String(index).padStart(12, '0')}`, status),
			);
		});

		const result = await runMemoriesCleanup(NOW, 100);

		// Settle checks: 0 < 100, 60 < 100, 120 < 100 (stop); the upload walk never starts.
		expect(mockStale).toHaveBeenCalledTimes(2);
		expect(mockClaim).not.toHaveBeenCalled();
		expect(result.settleComplete).toBe(false);
	});

	it('claims batches until one comes back empty and anonymizes touched and expired sessions', async () => {
		mockClaim
			.mockResolvedValueOnce([claimedRow(ITEM_A, SESSION_ID), claimedRow(ITEM_B, SESSION_ID)])
			.mockResolvedValueOnce([claimedRow(ITEM_C, OTHER_SESSION_ID)])
			.mockResolvedValueOnce([]);
		mockPendingSessions.mockResolvedValue([{ id: EXPIRED_SESSION_ID, event_id: EVENT_ID }]);
		mockPurge.mockResolvedValue(5);

		const result = await runMemoriesCleanup(NOW);

		expect(mockClaim).toHaveBeenCalledTimes(3);
		for (const [input] of mockClaim.mock.calls) {
			expect(isMemoriesUuid(input.leaseId)).toBe(true);
			expect(input).toMatchObject({
				batchSize: MEMORIES_CLEANUP_BATCH_SIZE,
				leaseSeconds: MEMORIES_CLEANUP_LEASE_SECONDS,
			});
		}
		expect(new Set(mockClaim.mock.calls.map(([input]) => input.leaseId)).size).toBe(3);

		expect(mockDeleteObject).toHaveBeenCalledTimes(3);
		expect(mockDeleteObject).toHaveBeenCalledWith({
			objectKey: `events/${EVENT_ID}/${ITEM_A}.jpg`,
			mimeType: 'image/jpeg',
		});
		const firstLease = mockClaim.mock.calls[0][0].leaseId;
		const secondLease = mockClaim.mock.calls[1][0].leaseId;
		expect(mockMarkDeleted.mock.calls).toEqual([
			[ITEM_A, firstLease],
			[ITEM_B, firstLease],
			[ITEM_C, secondLease],
		]);
		expect(mockAudit).toHaveBeenCalledTimes(3);
		expect(mockAudit).toHaveBeenCalledWith({
			eventId: EVENT_ID,
			mediaItemId: ITEM_C,
			actorType: 'system',
			action: 'object_deleted',
		});

		expect(mockPendingSessions).toHaveBeenCalledWith(
			NOW.toISOString(),
			MEMORIES_CLEANUP_BATCH_SIZE,
		);
		const anonymizedIds = mockAnonymize.mock.calls.map(([input]) => input.sessionId);
		expect(anonymizedIds).toHaveLength(3);
		expect(new Set(anonymizedIds)).toEqual(
			new Set([SESSION_ID, OTHER_SESSION_ID, EXPIRED_SESSION_ID]),
		);
		for (const [input] of mockAnonymize.mock.calls) {
			expect(input.eventId).toBe(EVENT_ID);
			expect(input.tokenHash).toMatch(/^[0-9a-f]{64}$/);
			expect(input.recoveryCodeHash).toMatch(/^[0-9a-f]{64}$/);
			expect(input.tokenHash).not.toBe(input.recoveryCodeHash);
		}

		expect(result).toEqual({
			validationSettled: 0,
			validationRejected: 0,
			uploadsRescued: 0,
			uploadsReleased: 0,
			inFlightPending: 0,
			settleComplete: true,
			expiredContent: 0,
			claimed: 3,
			deleted: 3,
			failed: 0,
			anonymized: 3,
			auditPurged: 5,
		});
		expect(result.claimed).toBe(result.deleted + result.failed);
	});

	it('stops claiming after a batch with a failure and keeps the counts consistent', async () => {
		mockClaim.mockResolvedValue([
			claimedRow(ITEM_A, SESSION_ID),
			claimedRow(ITEM_B, OTHER_SESSION_ID),
		]);
		mockDeleteObject
			.mockResolvedValueOnce(true)
			.mockRejectedValueOnce(new Error('worker down'));

		const result = await runMemoriesCleanup(NOW);

		expect(mockClaim).toHaveBeenCalledTimes(1);
		expect(mockMarkDeleted).toHaveBeenCalledTimes(1);
		expect(mockMarkDeleted).toHaveBeenCalledWith(ITEM_A, mockClaim.mock.calls[0][0].leaseId);
		expect(mockAudit).toHaveBeenCalledTimes(1);
		expect(mockAnonymize).toHaveBeenCalledTimes(1);
		expect(mockAnonymize.mock.calls[0][0].sessionId).toBe(SESSION_ID);
		expect(result).toMatchObject({ claimed: 2, deleted: 1, failed: 1, anonymized: 1 });
		expect(result.claimed).toBe(result.deleted + result.failed);
	});

	it('counts a worker refusal as a failure without marking the row', async () => {
		mockClaim.mockResolvedValueOnce([claimedRow(ITEM_A, SESSION_ID)]);
		mockDeleteObject.mockResolvedValue(false);

		const result = await runMemoriesCleanup(NOW);

		expect(mockMarkDeleted).not.toHaveBeenCalled();
		expect(mockAnonymize).not.toHaveBeenCalled();
		expect(result).toMatchObject({ claimed: 1, deleted: 0, failed: 1, anonymized: 0 });
	});

	it('does not count sessions whose anonymization RPC reports no change', async () => {
		mockClaim.mockResolvedValueOnce([claimedRow(ITEM_A, SESSION_ID)]).mockResolvedValueOnce([]);
		mockAnonymize.mockResolvedValue(false);

		const result = await runMemoriesCleanup(NOW);

		expect(mockAnonymize).toHaveBeenCalledTimes(1);
		expect(result.anonymized).toBe(0);
	});

	it('stops claiming once the time budget is spent', async () => {
		let elapsed = 0;
		const base = 1_700_000_000_000;
		jest.spyOn(Date, 'now').mockImplementation(() => base + elapsed);
		mockClaim.mockImplementation(async () => {
			elapsed += 50;
			return [claimedRow(ITEM_A, SESSION_ID)];
		});

		const result = await runMemoriesCleanup(NOW, 120);

		// Loop checks: 0 < 120, 50 < 120, 100 < 120, 150 < 120 (stop).
		expect(mockClaim).toHaveBeenCalledTimes(3);
		expect(result).toMatchObject({ claimed: 3, deleted: 3, failed: 0 });
	});

	it('never claims or settles when the budget is already exhausted', async () => {
		const result = await runMemoriesCleanup(NOW, 0);
		expect(mockStale).not.toHaveBeenCalled();
		expect(mockClaim).not.toHaveBeenCalled();
		expect(result).toMatchObject({ claimed: 0, deleted: 0, failed: 0, settleComplete: false });
	});
});
