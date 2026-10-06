/**
 * Daily lifecycle pass over every event memory space. In-flight uploads are
 * settled only from storage evidence; physical deletion goes through the
 * Retrieval Worker; the R2 lifecycle rule remains the final backstop.
 */

import {
	MEMORIES_AUDIT_RETENTION_SECONDS,
	MEMORIES_CLEANUP_BATCH_SIZE,
	MEMORIES_CLEANUP_LEASE_SECONDS,
	MEMORIES_CLEANUP_SETTLE_BUDGET_MS,
	MEMORIES_CLEANUP_TIME_BUDGET_MS,
	MEMORIES_RESERVATION_TTL_SECONDS,
	MEMORIES_VALIDATION_RETRY_DELAY_SECONDS,
} from '@/lib/memories/contract/limits';
import { appendMemoriesAudit } from './audit';
import {
	anonymizeSession,
	claimCleanup,
	expireContent,
	listSessionsPendingAnonymization,
	listStaleInFlightMedia,
	markObjectDeleted,
	purgeAudit,
	type MediaRow,
	type StaleMediaCursor,
} from './catalog.repository';
import { settleStaleMemoryItem, type MemoriesSettleResult } from './guest-media.service';
import { createMemoriesLeaseId, createMemoriesSessionToken, hashMemoriesSecret } from './secrets';
import { MEMORIES_THUMBNAIL_MIME_TYPE } from '@/lib/memories/contract/object-key';
import { deleteMemoriesObject } from './worker-gateway';

export interface MemoriesCleanupResult {
	validationSettled: number;
	validationRejected: number;
	uploadsRescued: number;
	uploadsReleased: number;
	inFlightPending: number;
	settleComplete: boolean;
	expiredContent: number;
	claimed: number;
	deleted: number;
	failed: number;
	anonymized: number;
	auditPurged: number;
}

type SettleTally = Record<MemoriesSettleResult, number> & { complete: boolean };

async function settleStaleInFlight(input: {
	status: 'uploading' | 'validating';
	cutoff: string;
	now: Date;
	deadline: number;
	tally: SettleTally;
}): Promise<void> {
	let after: StaleMediaCursor | null = null;
	while (Date.now() < input.deadline) {
		const rows = await listStaleInFlightMedia({
			status: input.status,
			cutoff: input.cutoff,
			limit: MEMORIES_CLEANUP_BATCH_SIZE,
			after,
		});
		for (const row of rows) {
			input.tally[await settleStaleMemoryItem(row, input.now)] += 1;
		}
		if (rows.length < MEMORIES_CLEANUP_BATCH_SIZE) return;
		const last = rows[rows.length - 1];
		after = {
			at: input.status === 'uploading' ? last.created_at : last.updated_at,
			id: last.id,
		};
	}
	input.tally.complete = false;
}

async function settleInFlightItems(now: Date, deadline: number): Promise<SettleTally> {
	const tally: SettleTally = {
		validated: 0,
		rescued: 0,
		rejected: 0,
		released: 0,
		pending: 0,
		complete: true,
	};
	await settleStaleInFlight({
		status: 'validating',
		cutoff: new Date(
			now.getTime() - MEMORIES_VALIDATION_RETRY_DELAY_SECONDS * 1000,
		).toISOString(),
		now,
		deadline,
		tally,
	});
	await settleStaleInFlight({
		status: 'uploading',
		cutoff: new Date(now.getTime() - MEMORIES_RESERVATION_TTL_SECONDS * 1000).toISOString(),
		now,
		deadline,
		tally,
	});
	return tally;
}

async function anonymizeSessions(
	sessions: Iterable<{ id: string; event_id: string }>,
): Promise<number> {
	let anonymized = 0;
	for (const session of sessions) {
		const done = await anonymizeSession({
			eventId: session.event_id,
			sessionId: session.id,
			tokenHash: hashMemoriesSecret(createMemoriesSessionToken()),
			recoveryCodeHash: hashMemoriesSecret(createMemoriesSessionToken()),
			auditExpiresAt: new Date(
				Date.now() + MEMORIES_AUDIT_RETENTION_SECONDS * 1000,
			).toISOString(),
		});
		if (done) anonymized += 1;
	}
	return anonymized;
}

async function deleteClaimedObjects(
	rows: MediaRow[],
	leaseId: string,
): Promise<{
	deleted: number;
	failed: number;
	sessions: Map<string, { id: string; event_id: string }>;
}> {
	let deleted = 0;
	let failed = 0;
	const sessions = new Map<string, { id: string; event_id: string }>();
	for (const row of rows) {
		const removed = await deleteMemoriesObject({
			objectKey: row.object_key,
			mimeType: row.mime_type,
		}).catch(() => false);
		if (!removed) {
			failed += 1;
			continue;
		}
		// The bucket lifecycle rule still catches a thumbnail this call misses.
		if (row.thumbnail_object_key) {
			await deleteMemoriesObject({
				objectKey: row.thumbnail_object_key,
				mimeType: MEMORIES_THUMBNAIL_MIME_TYPE,
			}).catch(() => false);
		}
		await markObjectDeleted(row.id, leaseId);
		sessions.set(row.session_id, { id: row.session_id, event_id: row.event_id });
		deleted += 1;
		await appendMemoriesAudit({
			eventId: row.event_id,
			mediaItemId: row.id,
			actorType: 'system',
			action: 'object_deleted',
		});
	}
	return { deleted, failed, sessions };
}

export async function runMemoriesCleanup(
	now = new Date(),
	timeBudgetMs = MEMORIES_CLEANUP_TIME_BUDGET_MS,
): Promise<MemoriesCleanupResult> {
	const startedAt = Date.now();
	const nowIso = now.toISOString();
	const settled = await settleInFlightItems(
		now,
		startedAt + Math.min(MEMORIES_CLEANUP_SETTLE_BUDGET_MS, timeBudgetMs),
	);
	const expiredContent = await expireContent(nowIso);

	let claimed = 0;
	let deleted = 0;
	let failed = 0;
	const touchedSessions = new Map<string, { id: string; event_id: string }>();
	// Keep claiming batches until the budget is spent or nothing is due.
	while (Date.now() - startedAt < timeBudgetMs) {
		const leaseId = createMemoriesLeaseId();
		const rows = await claimCleanup({
			leaseId,
			batchSize: MEMORIES_CLEANUP_BATCH_SIZE,
			leaseSeconds: MEMORIES_CLEANUP_LEASE_SECONDS,
		});
		if (rows.length === 0) break;
		claimed += rows.length;
		const outcome = await deleteClaimedObjects(rows, leaseId);
		deleted += outcome.deleted;
		failed += outcome.failed;
		for (const [key, session] of outcome.sessions) touchedSessions.set(key, session);
		if (outcome.failed > 0) break;
	}

	const expiredSessions = await listSessionsPendingAnonymization(
		nowIso,
		MEMORIES_CLEANUP_BATCH_SIZE,
	);
	for (const session of expiredSessions) touchedSessions.set(session.id, session);
	const anonymized = await anonymizeSessions(touchedSessions.values());
	const auditPurged = await purgeAudit(nowIso);

	return {
		validationSettled: settled.validated,
		validationRejected: settled.rejected,
		uploadsRescued: settled.rescued,
		uploadsReleased: settled.released,
		inFlightPending: settled.pending,
		settleComplete: settled.complete,
		expiredContent,
		claimed,
		deleted,
		failed,
		anonymized,
		auditPurged,
	};
}
