import { randomBytes, randomUUID } from 'node:crypto';
import {
	VALENTINA_MEMORIES_CLEANUP_BATCH_SIZE,
	VALENTINA_MEMORIES_CLEANUP_LEASE_SECONDS,
	VALENTINA_MEMORIES_SESSION_TTL_SECONDS,
	VALENTINA_MEMORIES_VALIDATION_RETRY_DELAY_SECONDS,
} from '@/data/valentina-memories-media.contract';
import {
	VALENTINA_MEMORIES_EVENT_ID,
	VALENTINA_MEMORIES_RESERVATION_TTL_SECONDS,
} from '@/data/valentina-memories-upload.contract';
import { appendValentinaMemoriesAudit } from '@/lib/memories/valentina-memories-audit';
import { deleteValentinaMemoryObject } from '@/lib/memories/valentina-memories-retrieval';
import {
	hashValentinaMemorySecret,
	reconcileValentinaMemoryValidation,
} from '@/lib/memories/valentina-memories.service';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

type CleanupMediaRow = {
	id: string;
	session_id: string;
	object_key: string;
	mime_type: string;
};

async function reconcilePendingValidations(): Promise<{ reconciled: number; pending: number }> {
	const cutoff = new Date(
		Date.now() - VALENTINA_MEMORIES_VALIDATION_RETRY_DELAY_SECONDS * 1000,
	).toISOString();
	const rows = await supabaseRestRequest<{ id: string }[]>({
		pathWithQuery: `valentina_memory_items?select=id&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&status=eq.validating&updated_at=lt.${encodeURIComponent(cutoff)}&order=updated_at.asc&limit=${VALENTINA_MEMORIES_CLEANUP_BATCH_SIZE}`,
		useServiceRole: true,
	});
	let reconciled = 0;
	let pending = 0;
	for (const row of rows) {
		if (await reconcileValentinaMemoryValidation(row.id)) reconciled += 1;
		else pending += 1;
	}
	return { reconciled, pending };
}

async function anonymizeEmptySessions(sessionIds: Set<string>): Promise<void> {
	for (const sessionId of sessionIds) {
		const active = await supabaseRestRequest<{ id: string }[]>({
			pathWithQuery: `valentina_memory_items?select=id&session_id=eq.${encodeURIComponent(sessionId)}&object_deleted_at=is.null&limit=1`,
			useServiceRole: true,
		});
		if (active.length > 0) continue;
		await supabaseRestRequest({
			pathWithQuery: `valentina_memory_sessions?id=eq.${encodeURIComponent(sessionId)}`,
			method: 'PATCH',
			useServiceRole: true,
			body: {
				display_name: 'Invitado retirado',
				token_hash: hashValentinaMemorySecret(randomBytes(32).toString('base64url')),
				recovery_code_hash: hashValentinaMemorySecret(
					randomBytes(32).toString('base64url'),
				),
				revoked_at: new Date().toISOString(),
			},
		});
		await appendValentinaMemoriesAudit({
			actorType: 'system',
			action: 'guest_session_anonymized',
		});
	}
}

async function anonymizeExpiredEmptySessions(): Promise<void> {
	const now = new Date().toISOString();
	const sessions = await supabaseRestRequest<{ id: string }[]>({
		pathWithQuery: `valentina_memory_sessions?select=id&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&or=(expires_at.lte.${encodeURIComponent(now)},revoked_at.not.is.null)&limit=${VALENTINA_MEMORIES_CLEANUP_BATCH_SIZE}`,
		useServiceRole: true,
	});
	await anonymizeEmptySessions(new Set(sessions.map((session) => session.id)));
}

async function deleteClaimedObjects(
	rows: CleanupMediaRow[],
	leaseId: string,
): Promise<{
	deleted: number;
	failed: number;
}> {
	let deleted = 0;
	let failed = 0;
	const cleanedSessionIds = new Set<string>();
	for (const row of rows) {
		const removed = await deleteValentinaMemoryObject({
			objectKey: row.object_key,
			mimeType: row.mime_type,
		}).catch(() => false);
		if (!removed) {
			failed += 1;
			continue;
		}
		const now = new Date().toISOString();
		await supabaseRestRequest({
			pathWithQuery: `valentina_memory_items?id=eq.${encodeURIComponent(row.id)}&cleanup_lease_id=eq.${leaseId}`,
			method: 'PATCH',
			useServiceRole: true,
			body: {
				object_deleted_at: now,
				caption: '',
				cleanup_claimed_at: null,
				cleanup_lease_id: null,
				updated_at: now,
			},
		});
		cleanedSessionIds.add(row.session_id);
		deleted += 1;
		await appendValentinaMemoriesAudit({
			mediaItemId: row.id,
			actorType: 'system',
			action: 'object_deleted',
		});
	}
	await anonymizeEmptySessions(cleanedSessionIds);
	return { deleted, failed };
}

export async function cleanupValentinaMemoryObjects(): Promise<{
	validationReconciled: number;
	validationPending: number;
	expiredReservations: number;
	claimed: number;
	deleted: number;
	failed: number;
	auditPurged: number;
}> {
	const now = new Date();
	const validation = await reconcilePendingValidations();
	await anonymizeExpiredEmptySessions();
	const expiredReservations = await supabaseRestRequest<number>({
		pathWithQuery: 'rpc/expire_valentina_memory_reservations',
		method: 'POST',
		useServiceRole: true,
		body: {
			p_upload_cutoff: new Date(
				now.getTime() - VALENTINA_MEMORIES_RESERVATION_TTL_SECONDS * 1000,
			).toISOString(),
			p_validation_cutoff: new Date(
				now.getTime() - VALENTINA_MEMORIES_SESSION_TTL_SECONDS * 1000,
			).toISOString(),
		},
	});
	const leaseId = randomUUID();
	const rows = await supabaseRestRequest<CleanupMediaRow[]>({
		pathWithQuery: 'rpc/claim_valentina_memory_cleanup',
		method: 'POST',
		useServiceRole: true,
		body: {
			p_lease_id: leaseId,
			p_batch_size: VALENTINA_MEMORIES_CLEANUP_BATCH_SIZE,
			p_lease_seconds: VALENTINA_MEMORIES_CLEANUP_LEASE_SECONDS,
		},
	});
	const deletion = await deleteClaimedObjects(rows, leaseId);
	const auditPurged = await supabaseRestRequest<number>({
		pathWithQuery: 'rpc/purge_valentina_memory_audit',
		method: 'POST',
		useServiceRole: true,
		body: { p_cutoff: now.toISOString() },
	});
	return {
		validationReconciled: validation.reconciled,
		validationPending: validation.pending,
		expiredReservations: Number(expiredReservations) || 0,
		claimed: rows.length,
		...deletion,
		auditPurged: Number(auditPurged) || 0,
	};
}
