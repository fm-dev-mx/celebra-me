/**
 * Sessions, items and audit rows. The only module that knows these table, RPC
 * and embed names. Secrets (token and recovery hashes) travel in RPC bodies.
 */

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { MemoriesMediaActor, MemoriesMediaStatus } from '@/lib/memories/contract/catalog';

const SESSIONS = 'event_memory_sessions';
const ITEMS = 'event_memory_items';
const AUDIT = 'event_memory_audit_events';

const SESSION_COLUMNS =
	'id,event_id,created_at,last_seen_at,expires_at,revoked_at,anonymized_at,display_name,guest_alias';
const MEDIA_COLUMNS =
	'id,event_id,session_id,object_key,mime_type,size_bytes,checksum_sha256,duration_seconds,caption,status,duplicate_of_id,created_at,updated_at,accepted_at,rejected_at,deleted_at,idempotency_key,cleanup_after,cleanup_claimed_at,cleanup_lease_id,object_deleted_at';

export type SessionRow = {
	id: string;
	event_id: string;
	created_at: string;
	last_seen_at: string;
	expires_at: string;
	revoked_at: string | null;
	anonymized_at: string | null;
	display_name: string;
	guest_alias: string;
};

export type MediaRow = {
	id: string;
	event_id: string;
	session_id: string;
	object_key: string;
	mime_type: string;
	size_bytes: number;
	checksum_sha256: string | null;
	duration_seconds: number | null;
	caption: string;
	status: MemoriesMediaStatus;
	duplicate_of_id: string | null;
	created_at: string;
	updated_at: string;
	accepted_at: string | null;
	rejected_at: string | null;
	deleted_at: string | null;
	idempotency_key: string | null;
	cleanup_after: string | null;
	cleanup_claimed_at: string | null;
	cleanup_lease_id: string | null;
	object_deleted_at: string | null;
};

export type OrganizerMediaRow = MediaRow & {
	uploader:
		| { display_name: string; guest_alias: string }
		| Array<{ display_name: string; guest_alias: string }>
		| null;
};

function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
	return supabaseRestRequest<T>({
		pathWithQuery: `rpc/${name}`,
		method: 'POST',
		useServiceRole: true,
		body,
	});
}

// Sessions ---------------------------------------------------------------------

export async function resolveSessionByTokenHash(
	eventId: string,
	tokenHash: string,
): Promise<SessionRow | null> {
	const rows = await rpc<SessionRow[]>('resolve_event_memory_session', {
		p_event_id: eventId,
		p_token_hash: tokenHash,
	});
	return rows[0] ?? null;
}

export async function recoverSessionByRecoveryHash(
	eventId: string,
	recoveryCodeHash: string,
	nextTokenHash: string,
): Promise<SessionRow | null> {
	const rows = await rpc<SessionRow[]>('recover_event_memory_session', {
		p_event_id: eventId,
		p_recovery_code_hash: recoveryCodeHash,
		p_token_hash: nextTokenHash,
	});
	return rows[0] ?? null;
}

export async function insertSession(input: {
	eventId: string;
	tokenHash: string;
	recoveryCodeHash: string;
	displayName: string;
	guestAlias: string;
	expiresAt: string;
}): Promise<SessionRow | null> {
	const rows = await supabaseRestRequest<SessionRow[]>({
		pathWithQuery: `${SESSIONS}?select=${SESSION_COLUMNS}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			event_id: input.eventId,
			token_hash: input.tokenHash,
			recovery_code_hash: input.recoveryCodeHash,
			display_name: input.displayName,
			guest_alias: input.guestAlias,
			expires_at: input.expiresAt,
		},
	});
	return rows[0] ?? null;
}

export async function updateSessionDisplayName(
	sessionId: string,
	displayName: string,
): Promise<SessionRow | null> {
	const rows = await supabaseRestRequest<SessionRow[]>({
		pathWithQuery: `${SESSIONS}?id=eq.${encodeURIComponent(sessionId)}&revoked_at=is.null&select=${SESSION_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: { display_name: displayName, last_seen_at: new Date().toISOString() },
	});
	return rows[0] ?? null;
}

export async function revokeSessionsByAlias(
	eventId: string,
	guestAlias: string,
): Promise<SessionRow[]> {
	return supabaseRestRequest<SessionRow[]>({
		pathWithQuery: `${SESSIONS}?event_id=eq.${encodeURIComponent(eventId)}&guest_alias=eq.${encodeURIComponent(guestAlias)}&revoked_at=is.null&select=${SESSION_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: { revoked_at: new Date().toISOString() },
	});
}

export async function listSessionsPendingAnonymization(
	now: string,
	limit: number,
): Promise<{ id: string; event_id: string }[]> {
	return supabaseRestRequest<{ id: string; event_id: string }[]>({
		pathWithQuery: `${SESSIONS}?select=id,event_id&anonymized_at=is.null&or=(expires_at.lte.${encodeURIComponent(now)},revoked_at.not.is.null)&order=expires_at.asc,id.asc&limit=${limit}`,
		useServiceRole: true,
	});
}

export async function anonymizeSession(input: {
	eventId: string;
	sessionId: string;
	tokenHash: string;
	recoveryCodeHash: string;
	auditExpiresAt: string;
}): Promise<boolean> {
	return rpc<boolean>('anonymize_event_memory_session', {
		p_event_id: input.eventId,
		p_session_id: input.sessionId,
		p_token_hash: input.tokenHash,
		p_recovery_code_hash: input.recoveryCodeHash,
		p_audit_expires_at: input.auditExpiresAt,
	});
}

// Items ------------------------------------------------------------------------

export async function findMediaById(eventId: string, itemId: string): Promise<MediaRow | null> {
	const rows = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `${ITEMS}?select=${MEDIA_COLUMNS}&event_id=eq.${encodeURIComponent(eventId)}&id=eq.${encodeURIComponent(itemId)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ?? null;
}

export async function listSessionMedia(eventId: string, sessionId: string): Promise<MediaRow[]> {
	return supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `${ITEMS}?select=${MEDIA_COLUMNS}&event_id=eq.${encodeURIComponent(eventId)}&session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.desc`,
		useServiceRole: true,
	});
}

export async function listOrganizerMedia(input: {
	eventId: string;
	limit: number;
	offset: number;
	status?: MemoriesMediaStatus;
	uploader?: string;
	createdFrom?: string;
	createdTo?: string;
}): Promise<OrganizerMediaRow[]> {
	const query = new URLSearchParams();
	const uploaderRelation = input.uploader
		? `uploader:${SESSIONS}!inner(display_name,guest_alias)`
		: `uploader:${SESSIONS}(display_name,guest_alias)`;
	query.set('select', `${MEDIA_COLUMNS},${uploaderRelation}`);
	query.set('event_id', `eq.${input.eventId}`);
	query.set('order', 'created_at.desc,id.desc');
	query.set('limit', String(input.limit));
	query.set('offset', String(input.offset));
	query.set('status', input.status ? `eq.${input.status}` : 'neq.deleted');
	if (input.createdFrom) query.append('created_at', `gte.${input.createdFrom}`);
	if (input.createdTo) query.append('created_at', `lt.${input.createdTo}`);
	if (input.uploader) {
		query.set(
			'uploader.or',
			`(display_name.ilike.*${input.uploader}*,guest_alias.ilike.*${input.uploader}*)`,
		);
	}
	return supabaseRestRequest<OrganizerMediaRow[]>({
		pathWithQuery: `${ITEMS}?${query.toString()}`,
		useServiceRole: true,
	});
}

export async function patchMedia(
	itemId: string,
	body: Record<string, unknown>,
	extraFilter = '',
): Promise<MediaRow | null> {
	const rows = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `${ITEMS}?id=eq.${encodeURIComponent(itemId)}${extraFilter}&select=${MEDIA_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: { ...body, updated_at: new Date().toISOString() },
	});
	return rows[0] ?? null;
}

export async function reserveMedia(input: {
	eventId: string;
	sessionId: string;
	objectKey: string;
	mimeType: string;
	sizeBytes: number;
	checksumSha256: string;
	durationSeconds: number | null;
	idempotencyKey: string;
	maxSessionInFlight: number;
}): Promise<MediaRow | null> {
	const rows = await rpc<MediaRow[]>('reserve_event_memory_item', {
		p_event_id: input.eventId,
		p_session_id: input.sessionId,
		p_object_key: input.objectKey,
		p_mime_type: input.mimeType,
		p_size_bytes: input.sizeBytes,
		p_checksum_sha256: input.checksumSha256,
		p_duration_seconds: input.durationSeconds,
		p_idempotency_key: input.idempotencyKey,
		p_max_session_in_flight: input.maxSessionInFlight,
	});
	return rows[0] ?? null;
}

export async function releaseReservation(itemId: string, sessionId: string): Promise<boolean> {
	return rpc<boolean>('release_event_memory_reservation', {
		p_item_id: itemId,
		p_session_id: sessionId,
	});
}

export async function claimValidation(itemId: string, sessionId: string): Promise<MediaRow | null> {
	const rows = await rpc<MediaRow[]>('claim_event_memory_validation', {
		p_item_id: itemId,
		p_session_id: sessionId,
	});
	return rows[0] ?? null;
}

export async function finalizeMedia(input: {
	itemId: string;
	sessionId: string;
	outcome: 'accepted' | 'rejected';
	cleanupAfter: string;
}): Promise<MediaRow | null> {
	const rows = await rpc<MediaRow[]>('finalize_event_memory_item', {
		p_item_id: input.itemId,
		p_session_id: input.sessionId,
		p_outcome: input.outcome,
		p_cleanup_after: input.cleanupAfter,
	});
	return rows[0] ?? null;
}

export async function listStaleValidations(
	cutoff: string,
	limit: number,
): Promise<{ id: string; event_id: string }[]> {
	return supabaseRestRequest<{ id: string; event_id: string }[]>({
		pathWithQuery: `${ITEMS}?select=id,event_id&status=eq.validating&updated_at=lt.${encodeURIComponent(cutoff)}&order=updated_at.asc&limit=${limit}`,
		useServiceRole: true,
	});
}

export async function expireReservations(input: {
	uploadCutoff: string;
	validationCutoff: string;
}): Promise<number> {
	const count = await rpc<number>('expire_event_memory_reservations', {
		p_upload_cutoff: input.uploadCutoff,
		p_validation_cutoff: input.validationCutoff,
	});
	return Number(count) || 0;
}

export async function expireContent(now: string): Promise<number> {
	const count = await rpc<number>('expire_event_memory_content', { p_now: now });
	return Number(count) || 0;
}

export async function claimCleanup(input: {
	leaseId: string;
	batchSize: number;
	leaseSeconds: number;
}): Promise<MediaRow[]> {
	return rpc<MediaRow[]>('claim_event_memory_cleanup', {
		p_lease_id: input.leaseId,
		p_batch_size: input.batchSize,
		p_lease_seconds: input.leaseSeconds,
	});
}

export async function markObjectDeleted(itemId: string, leaseId: string): Promise<void> {
	const now = new Date().toISOString();
	await supabaseRestRequest({
		pathWithQuery: `${ITEMS}?id=eq.${encodeURIComponent(itemId)}&cleanup_lease_id=eq.${encodeURIComponent(leaseId)}`,
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
}

// Audit -------------------------------------------------------------------------

export async function insertAudit(input: {
	eventId: string;
	mediaItemId: string | null;
	actorType: MemoriesMediaActor;
	actorId: string | null;
	action: string;
	metadata: Record<string, unknown>;
	expiresAt: string;
}): Promise<void> {
	await supabaseRestRequest({
		pathWithQuery: AUDIT,
		method: 'POST',
		useServiceRole: true,
		body: {
			event_id: input.eventId,
			media_item_id: input.mediaItemId,
			actor_type: input.actorType,
			actor_id: input.actorId,
			action: input.action,
			metadata: input.metadata,
			expires_at: input.expiresAt,
		},
	});
}

export async function purgeAudit(cutoff: string): Promise<number> {
	const count = await rpc<number>('purge_event_memory_audit', { p_cutoff: cutoff });
	return Number(count) || 0;
}
