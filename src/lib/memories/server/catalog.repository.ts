/**
 * Sessions, items and audit rows. The only module that knows these table, RPC
 * and embed names. Secrets (token and recovery hashes) travel in RPC bodies.
 */

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type {
	MemoriesMediaActor,
	MemoriesMediaKind,
	MemoriesMediaStatus,
	MemoriesVisibilityFilter,
} from '@/lib/memories/contract/catalog';

const SESSIONS = 'event_memory_sessions';
const ITEMS = 'event_memory_items';
const AUDIT = 'event_memory_audit_events';

const SESSION_COLUMNS =
	'id,event_id,created_at,last_seen_at,expires_at,revoked_at,anonymized_at,display_name,guest_alias';
const MEDIA_COLUMNS =
	'id,event_id,session_id,object_key,mime_type,size_bytes,checksum_sha256,duration_seconds,caption,status,duplicate_of_id,created_at,updated_at,accepted_at,rejected_at,deleted_at,idempotency_key,cleanup_after,cleanup_claimed_at,cleanup_lease_id,object_deleted_at,hidden_at,thumbnail_object_key,thumbnail_bytes';

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
	hidden_at: string | null;
	thumbnail_object_key: string | null;
	thumbnail_bytes: number | null;
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
	uploaderAlias?: string;
	kind?: MemoriesMediaKind;
	visibility?: MemoriesVisibilityFilter;
	createdFrom?: string;
	createdTo?: string;
}): Promise<OrganizerMediaRow[]> {
	const query = new URLSearchParams();
	const filtersUploader = Boolean(input.uploader || input.uploaderAlias);
	const uploaderRelation = filtersUploader
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
	if (input.kind)
		query.set('mime_type', input.kind === 'video' ? 'like.video/*' : 'like.image/*');
	if (input.visibility)
		query.set('hidden_at', input.visibility === 'hidden' ? 'not.is.null' : 'is.null');
	if (input.uploaderAlias) {
		query.set('uploader.guest_alias', `eq.${input.uploaderAlias}`);
	} else if (input.uploader) {
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

/**
 * The shared gallery's page: available, visible files with the uploader's name only.
 * Hidden, pending, rejected and deleted files never leave the server.
 */
export async function listGalleryMedia(input: {
	eventId: string;
	limit: number;
	offset: number;
}): Promise<OrganizerMediaRow[]> {
	const query = new URLSearchParams();
	query.set('select', `${MEDIA_COLUMNS},uploader:${SESSIONS}(display_name,guest_alias)`);
	query.set('event_id', `eq.${input.eventId}`);
	query.set('status', 'eq.accepted');
	query.set('hidden_at', 'is.null');
	query.set('object_deleted_at', 'is.null');
	query.set('order', 'created_at.desc,id.desc');
	query.set('limit', String(input.limit));
	query.set('offset', String(input.offset));
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

export type StaleMediaCursor = { at: string; id: string };

/**
 * Resident in-flight items older than the cutoff, oldest first. Reservations age
 * from `created_at`; validations from `updated_at`, which the claim refreshes.
 * Keyset pagination lets the cleanup walk past rows it had to leave pending.
 */
export async function listStaleInFlightMedia(input: {
	status: 'uploading' | 'validating';
	cutoff: string;
	limit: number;
	after: StaleMediaCursor | null;
}): Promise<MediaRow[]> {
	const column = input.status === 'uploading' ? 'created_at' : 'updated_at';
	const query = new URLSearchParams();
	query.set('select', MEDIA_COLUMNS);
	query.set('status', `eq.${input.status}`);
	query.set('object_deleted_at', 'is.null');
	query.append(column, `lt.${input.cutoff}`);
	if (input.after) {
		const at = `"${input.after.at}"`;
		query.set('or', `(${column}.gt.${at},and(${column}.eq.${at},id.gt.${input.after.id}))`);
	}
	query.set('order', `${column}.asc,id.asc`);
	query.set('limit', String(input.limit));
	return supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `${ITEMS}?${query.toString()}`,
		useServiceRole: true,
	});
}

export async function listSessionInFlightMedia(
	eventId: string,
	sessionId: string,
): Promise<MediaRow[]> {
	return supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `${ITEMS}?select=${MEDIA_COLUMNS}&event_id=eq.${encodeURIComponent(eventId)}&session_id=eq.${encodeURIComponent(sessionId)}&status=in.(uploading,validating)&object_deleted_at=is.null&order=created_at.asc`,
		useServiceRole: true,
	});
}

/**
 * Guests with at least one available file and how many they shared. Keyset-paged
 * like the usage query; bounded by the space's object quota.
 */
export async function listUploaderFileCounts(
	eventId: string,
): Promise<Array<{ display_name: string; guest_alias: string; files: number }>> {
	const counts = new Map<string, number>();
	let after: string | null = null;
	for (;;) {
		const page: Array<{ id: string; session_id: string }> = await supabaseRestRequest<
			Array<{ id: string; session_id: string }>
		>({
			pathWithQuery:
				`${ITEMS}?select=id,session_id&event_id=eq.${encodeURIComponent(eventId)}` +
				`&status=eq.accepted` +
				(after ? `&id=gt.${encodeURIComponent(after)}` : '') +
				`&order=id.asc&limit=${USAGE_PAGE_SIZE}`,
			useServiceRole: true,
		});
		for (const row of page) counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
		if (page.length < USAGE_PAGE_SIZE) break;
		after = page[page.length - 1].id;
	}
	if (counts.size === 0) return [];
	// Paging the event's sessions keeps the URL short however many guests shared.
	const uploaders: Array<{ display_name: string; guest_alias: string; files: number }> = [];
	let afterSession: string | null = null;
	for (;;) {
		const page: Array<{ id: string; display_name: string; guest_alias: string }> =
			await supabaseRestRequest<
				Array<{ id: string; display_name: string; guest_alias: string }>
			>({
				pathWithQuery:
					`${SESSIONS}?select=id,display_name,guest_alias&event_id=eq.${encodeURIComponent(eventId)}` +
					(afterSession ? `&id=gt.${encodeURIComponent(afterSession)}` : '') +
					`&order=id.asc&limit=${USAGE_PAGE_SIZE}`,
				useServiceRole: true,
			});
		for (const session of page) {
			const files = counts.get(session.id);
			if (files)
				uploaders.push({
					display_name: session.display_name,
					guest_alias: session.guest_alias,
					files,
				});
		}
		if (page.length < USAGE_PAGE_SIZE) return uploaders;
		afterSession = page[page.length - 1].id;
	}
}

/** Minimal columns for usage aggregates: no keys, captions or checksums. */
export type MediaUsageRow = {
	id: string;
	event_id: string;
	session_id: string;
	status: MemoriesMediaStatus;
	mime_type: string;
	size_bytes: number;
	accepted_at: string | null;
};

const USAGE_PAGE_SIZE = 1000;

function eventIdFilter(eventIds: readonly string[]): string {
	return `in.(${eventIds.map((id) => encodeURIComponent(id)).join(',')})`;
}

/**
 * Every row still holding an R2 object, the same set the reservation quota counts.
 * Bounded by `max_event_objects` per space; keyset-paged past PostgREST's row cap.
 */
export async function listResidentMediaUsage(
	eventIds: readonly string[],
): Promise<MediaUsageRow[]> {
	if (eventIds.length === 0) return [];
	const rows: MediaUsageRow[] = [];
	let after: string | null = null;
	for (;;) {
		const page: MediaUsageRow[] = await supabaseRestRequest<MediaUsageRow[]>({
			pathWithQuery:
				`${ITEMS}?select=id,event_id,session_id,status,mime_type,size_bytes,accepted_at` +
				`&event_id=${eventIdFilter(eventIds)}&object_deleted_at=is.null` +
				(after ? `&id=gt.${encodeURIComponent(after)}` : '') +
				`&order=id.asc&limit=${USAGE_PAGE_SIZE}`,
			useServiceRole: true,
		});
		rows.push(...page);
		if (page.length < USAGE_PAGE_SIZE) return rows;
		after = page[page.length - 1].id;
	}
}

/** Event id of every guest session, for registration counts. */
export async function listSessionEventIds(eventIds: readonly string[]): Promise<string[]> {
	if (eventIds.length === 0) return [];
	const eventIdsOut: string[] = [];
	let after: string | null = null;
	for (;;) {
		const page: Array<{ id: string; event_id: string }> = await supabaseRestRequest<
			Array<{ id: string; event_id: string }>
		>({
			pathWithQuery:
				`${SESSIONS}?select=id,event_id&event_id=${eventIdFilter(eventIds)}` +
				(after ? `&id=gt.${encodeURIComponent(after)}` : '') +
				`&order=id.asc&limit=${USAGE_PAGE_SIZE}`,
			useServiceRole: true,
		});
		eventIdsOut.push(...page.map((row) => row.event_id));
		if (page.length < USAGE_PAGE_SIZE) return eventIdsOut;
		after = page[page.length - 1].id;
	}
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

/** When a host last downloaded a file of the event; null if never. */
export async function findLastOrganizerDownloadAt(eventId: string): Promise<string | null> {
	const rows = await supabaseRestRequest<Array<{ created_at: string }>>({
		pathWithQuery:
			`${AUDIT}?select=created_at&event_id=eq.${encodeURIComponent(eventId)}` +
			`&action=eq.download_requested&actor_type=eq.organizer&order=created_at.desc&limit=1`,
		useServiceRole: true,
	});
	return rows[0]?.created_at ?? null;
}

export async function purgeAudit(cutoff: string): Promise<number> {
	const count = await rpc<number>('purge_event_memory_audit', { p_cutoff: cutoff });
	return Number(count) || 0;
}
