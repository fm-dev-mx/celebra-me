/**
 * Daily lifecycle pass over every event memory space. Physical deletion goes
 * through the Retrieval Worker; the R2 lifecycle rule remains the final backstop.
 */

import {
	MEMORIES_AUDIT_RETENTION_SECONDS,
	MEMORIES_CLEANUP_BATCH_SIZE,
	MEMORIES_CLEANUP_LEASE_SECONDS,
	MEMORIES_CLEANUP_TIME_BUDGET_MS,
	MEMORIES_RESERVATION_TTL_SECONDS,
	MEMORIES_VALIDATION_RETRY_DELAY_SECONDS,
	MEMORIES_VALIDATION_TTL_SECONDS,
} from '@/lib/memories/contract/limits';
import { appendMemoriesAudit } from './audit';
import {
	anonymizeSession,
	claimCleanup,
	expireContent,
	expireReservations,
	listSessionsPendingAnonymization,
	listStaleValidations,
	markObjectDeleted,
	purgeAudit,
	type MediaRow,
} from './catalog.repository';
import { reconcileMemoryValidation } from './guest-media.service';
import { createMemoriesLeaseId, createMemoriesSessionToken, hashMemoriesSecret } from './secrets';
import { deleteMemoriesObject } from './worker-gateway';

export interface MemoriesCleanupResult {
	validationReconciled: number;
	validationPending: number;
	expiredReservations: number;
	expiredContent: number;
	claimed: number;
	deleted: number;
	failed: number;
	anonymized: number;
	auditPurged: number;
}

async function reconcilePendingValidations(): Promise<{ reconciled: number; pending: number }> {
	const cutoff = new Date(
		Date.now() - MEMORIES_VALIDATION_RETRY_DELAY_SECONDS * 1000,
	).toISOString();
	const rows = await listStaleValidations(cutoff, MEMORIES_CLEANUP_BATCH_SIZE);
	let reconciled = 0;
	let pending = 0;
	for (const row of rows) {
		if (await reconcileMemoryValidation(row.event_id, row.id)) reconciled += 1;
		else pending += 1;
	}
	return { reconciled, pending };
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
	const validation = await reconcilePendingValidations();
	const expiredReservations = await expireReservations({
		uploadCutoff: new Date(
			now.getTime() - MEMORIES_RESERVATION_TTL_SECONDS * 1000,
		).toISOString(),
		validationCutoff: new Date(
			now.getTime() - MEMORIES_VALIDATION_TTL_SECONDS * 1000,
		).toISOString(),
	});
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
		validationReconciled: validation.reconciled,
		validationPending: validation.pending,
		expiredReservations,
		expiredContent,
		claimed,
		deleted,
		failed,
		anonymized,
		auditPurged,
	};
}
