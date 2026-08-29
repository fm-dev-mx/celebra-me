import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { parseCookieHeader } from '@/lib/rsvp/core/utils';
import { getIp } from '@/lib/rsvp/core/http';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { SupabaseHttpError, supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { findEventBySlugService } from '@/lib/rsvp/repositories/event.repository';
import { findMembershipByEventForHost } from '@/lib/rsvp/repositories/role-membership.repository';
import {
	VALENTINA_MEMORIES_EVENT_SLUG,
	VALENTINA_MEMORIES_AUDIT_RETENTION_SECONDS,
	VALENTINA_MEMORIES_MAX_CAPTION_LENGTH,
	VALENTINA_MEMORIES_MAX_ITEMS_PER_SESSION,
	VALENTINA_MEMORIES_MEDIA_STATUSES,
	VALENTINA_MEMORIES_SESSION_COOKIE,
	VALENTINA_MEMORIES_SESSION_TTL_SECONDS,
	canTransitionValentinaMemoriesMedia,
	getValentinaMemoriesRecoveryCodePattern,
	isValidSha256Hex,
	isValentinaMemoriesObjectKeyForMime,
	sanitizeValentinaMemoriesCaption,
	type ValentinaMemoriesMediaActor,
	type ValentinaMemoriesMediaItem,
	type ValentinaMemoriesMediaPublicItem,
	type ValentinaMemoriesMediaStatus,
} from '@/data/valentina-memories-media.contract';
import {
	VALENTINA_MEMORIES_EVENT_ID,
	VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS,
	getValentinaMemoriesMimePolicy,
	normalizeMemoriesMimeType,
	type ValentinaMemoriesAllowedMimeType,
} from '@/data/valentina-memories-upload.contract';
import {
	inspectValentinaMemoryObject,
	type ValentinaMemoryInspectionResult,
} from '@/lib/memories/valentina-memories-retrieval';

type SessionRow = {
	id: string;
	event_key: string;
	token_hash: string;
	recovery_code_hash: string;
	created_at: string;
	last_seen_at: string;
	expires_at: string;
	revoked_at: string | null;
};

type MediaRow = {
	id: string;
	event_key: string;
	session_id: string;
	object_key: string;
	mime_type: string;
	size_bytes: number;
	checksum_sha256: string | null;
	duration_seconds: number | null;
	caption: string;
	status: ValentinaMemoriesMediaStatus;
	duplicate_of_id: string | null;
	created_at: string;
	updated_at: string;
	accepted_at: string | null;
	rejected_at: string | null;
	deleted_at: string | null;
};

const SESSION_COLUMNS =
	'id,event_key,token_hash,recovery_code_hash,created_at,last_seen_at,expires_at,revoked_at';
const MEDIA_COLUMNS =
	'id,event_key,session_id,object_key,mime_type,size_bytes,checksum_sha256,duration_seconds,caption,status,duplicate_of_id,created_at,updated_at,accepted_at,rejected_at,deleted_at';
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function requireValentinaMemoryRateLimit(
	request: Request,
	operation: 'session' | 'recover' | 'register' | 'read' | 'mutate',
	entityId = 'anonymous',
): Promise<void> {
	const limits = {
		session: { maxHits: 10, windowSec: 60 },
		recover: { maxHits: 5, windowSec: 60 },
		register: { maxHits: 30, windowSec: 60 },
		read: { maxHits: 60, windowSec: 60 },
		mutate: { maxHits: 30, windowSec: 60 },
	}[operation];
	const allowed = await checkRateLimit({
		namespace: 'rsvp-public',
		entityId: `valentina-memories:${operation}:${entityId}`,
		ip: getIp(request),
		maxHits: limits.maxHits,
		windowSec: limits.windowSec,
	});
	if (!allowed)
		throw new ApiError(
			429,
			'rate_limited',
			'Demasiadas solicitudes. Intente de nuevo más tarde.',
		);
}

function sha256(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

function makeRecoveryCode(): string {
	const bytes = randomBytes(12);
	const raw = Array.from(
		bytes,
		(byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length],
	).join('');
	return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function requireRecoveryCode(value: unknown): string {
	const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
	if (!getValentinaMemoriesRecoveryCodePattern().test(code)) {
		throw new ApiError(400, 'bad_request', 'El código de recuperación no es válido.');
	}
	return code;
}

function mapMediaRow(row: MediaRow): ValentinaMemoriesMediaItem {
	if (
		row.event_key !== VALENTINA_MEMORIES_EVENT_ID ||
		!VALENTINA_MEMORIES_MEDIA_STATUSES.includes(row.status)
	) {
		throw new Error('Invalid Valentina media catalog row.');
	}
	const mimeType = normalizeMemoriesMimeType(row.mime_type);
	if (!getValentinaMemoriesMimePolicy(mimeType)) {
		throw new Error('Invalid Valentina media MIME type.');
	}
	return {
		id: row.id,
		eventKey: VALENTINA_MEMORIES_EVENT_ID,
		sessionId: row.session_id,
		objectKey: row.object_key,
		mimeType: mimeType as ValentinaMemoriesAllowedMimeType,
		sizeBytes: Number(row.size_bytes),
		checksumSha256: (row.checksum_sha256 ?? '').toLowerCase(),
		durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
		caption: sanitizeValentinaMemoriesCaption(row.caption),
		status: row.status,
		duplicateOfId: row.duplicate_of_id ?? null,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		acceptedAt: row.accepted_at,
		rejectedAt: row.rejected_at,
		deletedAt: row.deleted_at,
	};
}

function toPublicItem(item: ValentinaMemoriesMediaItem): ValentinaMemoriesMediaPublicItem {
	const { sessionId: _sessionId, eventKey: _eventKey, ...publicItem } = item;
	return publicItem;
}

async function findActiveSessionByToken(token: string): Promise<SessionRow | null> {
	const now = new Date().toISOString();
	const rows = await supabaseRestRequest<SessionRow[]>({
		pathWithQuery: `valentina_memory_sessions?select=${SESSION_COLUMNS}&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&token_hash=eq.${sha256(token)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(now)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ?? null;
}

export async function getGuestMemorySessionFromRequest(
	request: Request,
): Promise<SessionRow | null> {
	const token = parseCookieHeader(request.headers.get('cookie'))[
		VALENTINA_MEMORIES_SESSION_COOKIE
	];
	if (!token) return null;
	const session = await findActiveSessionByToken(token);
	if (!session) return null;
	void supabaseRestRequest({
		pathWithQuery: `valentina_memory_sessions?id=eq.${encodeURIComponent(session.id)}`,
		method: 'PATCH',
		useServiceRole: true,
		body: { last_seen_at: new Date().toISOString() },
	}).catch(() => undefined);
	return session;
}

export function setGuestMemorySessionCookie(cookies: AstroCookies, token: string): void {
	cookies.set(VALENTINA_MEMORIES_SESSION_COOKIE, token, {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		path: '/',
		maxAge: VALENTINA_MEMORIES_SESSION_TTL_SECONDS,
	});
}

export function clearGuestMemorySessionCookie(cookies: AstroCookies): void {
	cookies.delete(VALENTINA_MEMORIES_SESSION_COOKIE, { path: '/' });
}

export async function createGuestMemorySession(): Promise<{
	sessionId: string;
	sessionToken: string;
	recoveryCode: string;
	expiresAt: string;
}> {
	const sessionToken = randomBytes(32).toString('base64url');
	const recoveryCode = makeRecoveryCode();
	const expiresAt = new Date(
		Date.now() + VALENTINA_MEMORIES_SESSION_TTL_SECONDS * 1000,
	).toISOString();
	const rows = await supabaseRestRequest<SessionRow[]>({
		pathWithQuery: `valentina_memory_sessions?select=${SESSION_COLUMNS}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			event_key: VALENTINA_MEMORIES_EVENT_ID,
			token_hash: sha256(sessionToken),
			recovery_code_hash: sha256(recoveryCode),
			expires_at: expiresAt,
		},
	});
	if (!rows[0])
		throw new ApiError(
			503,
			'service_unavailable',
			'No se pudo iniciar la sesión de recuerdos.',
		);
	return { sessionId: rows[0].id, sessionToken, recoveryCode, expiresAt };
}

export async function recoverGuestMemorySession(value: unknown): Promise<{
	sessionToken: string;
	sessionId: string;
	expiresAt: string;
}> {
	const recoveryCode = requireRecoveryCode(value);
	const now = new Date().toISOString();
	const rows = await supabaseRestRequest<SessionRow[]>({
		pathWithQuery: `valentina_memory_sessions?select=${SESSION_COLUMNS}&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&recovery_code_hash=eq.${sha256(recoveryCode)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(now)}&limit=1`,
		useServiceRole: true,
	});
	const session = rows[0];
	if (!session)
		throw new ApiError(401, 'unauthorized', 'El código de recuperación expiró o no es válido.');
	const sessionToken = randomBytes(32).toString('base64url');
	const updated = await supabaseRestRequest<SessionRow[]>({
		pathWithQuery: `valentina_memory_sessions?id=eq.${encodeURIComponent(session.id)}&select=${SESSION_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: { token_hash: sha256(sessionToken), last_seen_at: now },
	});
	const next = updated[0];
	if (!next)
		throw new ApiError(
			503,
			'service_unavailable',
			'No se pudo recuperar la sesión de recuerdos.',
		);
	return { sessionToken, sessionId: next.id, expiresAt: next.expires_at };
}

async function findMediaById(id: string): Promise<MediaRow | null> {
	const rows = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `valentina_memory_items?select=${MEDIA_COLUMNS}&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&id=eq.${encodeURIComponent(id)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ?? null;
}

async function appendAudit(input: {
	mediaItemId?: string;
	actorType: ValentinaMemoriesMediaActor;
	actorId?: string;
	action: string;
	metadata?: Record<string, unknown>;
}): Promise<void> {
	await supabaseRestRequest({
		pathWithQuery: 'valentina_memory_audit_events',
		method: 'POST',
		useServiceRole: true,
		body: {
			event_key: VALENTINA_MEMORIES_EVENT_ID,
			media_item_id: input.mediaItemId ?? null,
			actor_type: input.actorType,
			actor_id: input.actorId ?? null,
			action: input.action,
			metadata: input.metadata ?? {},
			expires_at: new Date(
				Date.now() + VALENTINA_MEMORIES_AUDIT_RETENTION_SECONDS * 1000,
			).toISOString(),
		},
	});
}

export async function recordValentinaMemoryAccess(input: {
	mediaItemId: string;
	actorType: 'guest' | 'organizer';
	actorId?: string;
	mode: 'inline' | 'attachment';
}): Promise<void> {
	await appendAudit({
		mediaItemId: input.mediaItemId,
		actorType: input.actorType,
		actorId: input.actorId,
		action: input.mode === 'attachment' ? 'download_requested' : 'preview_requested',
	});
}

function validateRegisterPayload(input: {
	mimeType: unknown;
	sizeBytes: unknown;
	checksumSha256: unknown;
	durationSeconds?: unknown;
	objectKey: unknown;
}) {
	const mimeType = normalizeMemoriesMimeType(
		typeof input.mimeType === 'string' ? input.mimeType : '',
	);
	const policy = getValentinaMemoriesMimePolicy(mimeType);
	const sizeBytes =
		typeof input.sizeBytes === 'number' ? input.sizeBytes : Number(input.sizeBytes);
	const durationSeconds = input.durationSeconds == null ? null : Number(input.durationSeconds);
	const checksumSha256 =
		typeof input.checksumSha256 === 'string' ? input.checksumSha256.trim().toLowerCase() : '';

	if (
		!policy ||
		!Number.isSafeInteger(sizeBytes) ||
		sizeBytes <= 0 ||
		sizeBytes > policy.maxBytes ||
		!isValidSha256Hex(checksumSha256)
	) {
		throw new ApiError(400, 'bad_request', 'El archivo no cumple la política de carga.');
	}
	if (
		policy.category === 'video' &&
		(!Number.isFinite(durationSeconds) ||
			(durationSeconds as number) <= 0 ||
			(durationSeconds as number) > VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS)
	) {
		throw new ApiError(400, 'bad_request', 'La duración del video no es válida.');
	}
	if (!isValentinaMemoriesObjectKeyForMime(input.objectKey, mimeType)) {
		throw new ApiError(400, 'bad_request', 'El identificador de almacenamiento no es válido.');
	}

	return { mimeType, policy, sizeBytes, durationSeconds, checksumSha256 };
}

export async function registerGuestMemoryItem(input: {
	session: SessionRow;
	objectKey: unknown;
	mimeType: unknown;
	sizeBytes: unknown;
	checksumSha256: unknown;
	durationSeconds?: unknown;
}): Promise<ValentinaMemoriesMediaPublicItem> {
	const { mimeType, policy, sizeBytes, durationSeconds, checksumSha256 } =
		validateRegisterPayload(input);

	const existing = await supabaseRestRequest<{ id: string }[]>({
		pathWithQuery: `valentina_memory_items?select=id&session_id=eq.${encodeURIComponent(input.session.id)}&status=neq.deleted`,
		useServiceRole: true,
	});
	if (existing.length >= VALENTINA_MEMORIES_MAX_ITEMS_PER_SESSION) {
		throw new ApiError(429, 'rate_limited', 'Alcanzó el máximo de recuerdos para esta sesión.');
	}

	const rows = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `valentina_memory_items?select=${MEDIA_COLUMNS}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			event_key: VALENTINA_MEMORIES_EVENT_ID,
			session_id: input.session.id,
			object_key: input.objectKey,
			mime_type: mimeType,
			size_bytes: sizeBytes,
			checksum_sha256: checksumSha256,
			duration_seconds: policy.category === 'video' ? durationSeconds : null,
			status: 'uploading',
		},
	});
	if (!rows[0])
		throw new ApiError(503, 'service_unavailable', 'No se pudo registrar el recuerdo.');
	const item = mapMediaRow(rows[0]);
	await appendAudit({ mediaItemId: item.id, actorType: 'guest', action: 'registered' });
	return toPublicItem(item);
}

export async function listGuestMemoryItems(
	session: SessionRow,
): Promise<ValentinaMemoriesMediaPublicItem[]> {
	const rows = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `valentina_memory_items?select=${MEDIA_COLUMNS}&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&session_id=eq.${encodeURIComponent(session.id)}&order=created_at.desc`,
		useServiceRole: true,
	});
	return rows.map(mapMediaRow).map(toPublicItem);
}

function isInspectionSuccessful(
	item: ValentinaMemoriesMediaItem,
	inspection: {
		exists: boolean;
		sizeBytes: number;
		checksumSha256?: string | null;
		signatureValid: boolean;
		durationSeconds?: number | null;
	} | null,
): boolean {
	if (
		!inspection ||
		!inspection.exists ||
		!inspection.signatureValid ||
		!inspection.checksumSha256
	)
		return false;
	const policy = getValentinaMemoriesMimePolicy(item.mimeType);
	if (!policy || inspection.sizeBytes <= 0 || inspection.sizeBytes > policy.maxBytes)
		return false;
	if (inspection.checksumSha256.toLowerCase() !== item.checksumSha256.toLowerCase()) {
		return false;
	}
	if (
		policy.category === 'video' &&
		(inspection.durationSeconds == null ||
			inspection.durationSeconds <= 0 ||
			inspection.durationSeconds > VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS)
	) {
		return false;
	}
	return true;
}

async function currentPublicMemoryItem(itemId: string): Promise<ValentinaMemoriesMediaPublicItem> {
	const current = await findMediaById(itemId);
	if (!current) throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
	return toPublicItem(mapMediaRow(current));
}

async function patchValidatingMemoryItem(
	itemId: string,
	body: Record<string, string>,
): Promise<MediaRow[]> {
	return supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `valentina_memory_items?id=eq.${encodeURIComponent(itemId)}&status=eq.validating&select=${MEDIA_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});
}

async function rejectMemoryItem(input: {
	item: ValentinaMemoriesMediaItem;
	inspection: ValentinaMemoryInspectionResult | null;
	now: string;
}): Promise<ValentinaMemoriesMediaPublicItem> {
	const rejectedRows = await patchValidatingMemoryItem(input.item.id, {
		status: 'rejected',
		rejected_at: input.now,
		updated_at: input.now,
	});
	await appendAudit({
		mediaItemId: input.item.id,
		actorType: 'system',
		action: 'validation_failed',
		metadata: { inspection: input.inspection ?? null },
	});
	return rejectedRows[0]
		? toPublicItem(mapMediaRow(rejectedRows[0]))
		: currentPublicMemoryItem(input.item.id);
}

async function markMemoryItemDuplicate(input: {
	itemId: string;
	duplicateOfId: string;
	now: string;
}): Promise<ValentinaMemoriesMediaPublicItem> {
	const duplicateRows = await patchValidatingMemoryItem(input.itemId, {
		status: 'duplicate',
		duplicate_of_id: input.duplicateOfId,
		updated_at: input.now,
	});
	if (!duplicateRows[0]) return currentPublicMemoryItem(input.itemId);
	await appendAudit({
		mediaItemId: input.itemId,
		actorType: 'system',
		action: 'deduplicated',
		metadata: { duplicateOfId: input.duplicateOfId },
	});
	return toPublicItem(mapMediaRow(duplicateRows[0]));
}

async function acceptMemoryItemOrMarkDuplicate(input: {
	item: ValentinaMemoriesMediaItem;
	now: string;
}): Promise<ValentinaMemoriesMediaPublicItem> {
	let acceptedRows: MediaRow[];
	try {
		acceptedRows = await patchValidatingMemoryItem(input.item.id, {
			status: 'accepted',
			accepted_at: input.now,
			updated_at: input.now,
		});
	} catch (error) {
		if (!(error instanceof SupabaseHttpError) || error.code !== '23505') throw error;
		const winner = await supabaseRestRequest<MediaRow[]>({
			pathWithQuery: `valentina_memory_items?select=${MEDIA_COLUMNS}&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&checksum_sha256=eq.${encodeURIComponent(input.item.checksumSha256)}&status=eq.accepted&id=neq.${encodeURIComponent(input.item.id)}&limit=1`,
			useServiceRole: true,
		});
		if (!winner[0]) throw error;
		return markMemoryItemDuplicate({
			itemId: input.item.id,
			duplicateOfId: winner[0].id,
			now: input.now,
		});
	}
	if (!acceptedRows[0]) return currentPublicMemoryItem(input.item.id);
	const acceptedItem = mapMediaRow(acceptedRows[0]);
	await appendAudit({
		mediaItemId: acceptedItem.id,
		actorType: 'system',
		action: 'validated_and_accepted',
	});
	return toPublicItem(acceptedItem);
}

export async function completeGuestMemoryItem(input: {
	session: SessionRow;
	mediaItemId: string;
}): Promise<ValentinaMemoriesMediaPublicItem> {
	const row = await findMediaById(input.mediaItemId);
	if (!row || row.session_id !== input.session.id) {
		throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
	}
	const item = mapMediaRow(row);
	if (
		item.status === 'accepted' ||
		item.status === 'duplicate' ||
		item.status === 'rejected' ||
		item.status === 'deleted'
	) {
		return toPublicItem(item);
	}
	if (item.status !== 'uploading' && item.status !== 'validating') {
		throw new ApiError(409, 'conflict', 'El recuerdo no puede pasar a validación.');
	}

	const now = new Date().toISOString();
	if (item.status === 'uploading') {
		const validatingRows = await supabaseRestRequest<MediaRow[]>({
			pathWithQuery: `valentina_memory_items?id=eq.${encodeURIComponent(item.id)}&status=eq.uploading&select=${MEDIA_COLUMNS}`,
			method: 'PATCH',
			useServiceRole: true,
			prefer: 'return=representation',
			body: { status: 'validating', updated_at: now },
		});
		if (!validatingRows[0]) return currentPublicMemoryItem(item.id);
		await appendAudit({
			mediaItemId: item.id,
			actorType: 'guest',
			action: 'submitted_for_validation',
		});
	}

	const inspection = await inspectValentinaMemoryObject({
		objectKey: item.objectKey,
		mimeType: item.mimeType,
	});

	if (!isInspectionSuccessful(item, inspection)) {
		return rejectMemoryItem({ item, inspection, now });
	}

	const existingAccepted = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `valentina_memory_items?select=${MEDIA_COLUMNS}&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&checksum_sha256=eq.${encodeURIComponent(item.checksumSha256)}&status=eq.accepted&id=neq.${encodeURIComponent(item.id)}&limit=1`,
		useServiceRole: true,
	});
	if (existingAccepted.length > 0) {
		return markMemoryItemDuplicate({
			itemId: item.id,
			duplicateOfId: existingAccepted[0].id,
			now,
		});
	}
	return acceptMemoryItemOrMarkDuplicate({ item, now });
}

export async function updateGuestMemoryCaption(input: {
	session: SessionRow;
	mediaItemId: string;
	caption: unknown;
}): Promise<ValentinaMemoriesMediaPublicItem> {
	const row = await findMediaById(input.mediaItemId);
	if (!row || row.session_id !== input.session.id) {
		throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
	}
	const item = mapMediaRow(row);
	if (item.status === 'deleted')
		throw new ApiError(409, 'conflict', 'El recuerdo ya fue eliminado.');
	const caption = sanitizeValentinaMemoriesCaption(input.caption);
	if (caption.length > VALENTINA_MEMORIES_MAX_CAPTION_LENGTH) {
		throw new ApiError(400, 'bad_request', 'El texto es demasiado largo.');
	}
	const rows = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `valentina_memory_items?id=eq.${encodeURIComponent(item.id)}&status=neq.deleted&select=${MEDIA_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: { caption, updated_at: new Date().toISOString() },
	});
	if (!rows[0])
		throw new ApiError(503, 'service_unavailable', 'No se pudo actualizar el recuerdo.');
	const next = mapMediaRow(rows[0]);
	await appendAudit({ mediaItemId: next.id, actorType: 'guest', action: 'caption_updated' });
	return toPublicItem(next);
}

export async function deleteGuestMemoryItem(input: {
	session: SessionRow;
	mediaItemId: string;
}): Promise<void> {
	const row = await findMediaById(input.mediaItemId);
	if (!row || row.session_id !== input.session.id) {
		throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
	}
	const item = mapMediaRow(row);
	if (item.status === 'deleted') return;
	const rows = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `valentina_memory_items?id=eq.${encodeURIComponent(item.id)}&status=neq.deleted&select=${MEDIA_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			status: 'deleted',
			deleted_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		},
	});
	if (!rows[0])
		throw new ApiError(503, 'service_unavailable', 'No se pudo eliminar el recuerdo.');
	await appendAudit({ mediaItemId: item.id, actorType: 'guest', action: 'deleted' });
}

export async function assertValentinaOrganizerAccess(input: {
	accessToken: string;
	isSuperAdmin: boolean;
}): Promise<void> {
	const event = await findEventBySlugService(VALENTINA_MEMORIES_EVENT_SLUG);
	if (!event) throw new ApiError(404, 'not_found', 'El evento no está disponible.');
	if (input.isSuperAdmin) return;
	const membership = await findMembershipByEventForHost(event.id, input.accessToken);
	if (!membership || membership.membershipRole !== 'owner') {
		throw new ApiError(403, 'forbidden', 'No tiene autorización para estos recuerdos.');
	}
}

export async function listOrganizerMemoryItems(): Promise<ValentinaMemoriesMediaPublicItem[]> {
	const rows = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `valentina_memory_items?select=${MEDIA_COLUMNS}&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&order=created_at.desc`,
		useServiceRole: true,
	});
	return rows.map(mapMediaRow).map(toPublicItem);
}

export async function updateOrganizerMemoryItem(input: {
	mediaItemId: string;
	caption?: unknown;
	status?: unknown;
	actorId: string;
}): Promise<ValentinaMemoriesMediaPublicItem> {
	const row = await findMediaById(input.mediaItemId);
	if (!row) throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
	const item = mapMediaRow(row);
	const nextStatus = input.status === undefined ? item.status : input.status;
	if (
		typeof nextStatus !== 'string' ||
		!VALENTINA_MEMORIES_MEDIA_STATUSES.includes(nextStatus as ValentinaMemoriesMediaStatus)
	) {
		throw new ApiError(400, 'bad_request', 'Estado de moderación no válido.');
	}
	const targetStatus = nextStatus as ValentinaMemoriesMediaStatus;
	if (
		targetStatus !== item.status &&
		!canTransitionValentinaMemoriesMedia(item.status, targetStatus)
	) {
		throw new ApiError(409, 'conflict', 'La transición de moderación no está permitida.');
	}
	const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (input.caption !== undefined) body.caption = sanitizeValentinaMemoriesCaption(input.caption);
	if (targetStatus !== item.status) {
		body.status = targetStatus;
		body.accepted_at = targetStatus === 'accepted' ? new Date().toISOString() : null;
		body.rejected_at = targetStatus === 'rejected' ? new Date().toISOString() : null;
		body.deleted_at = targetStatus === 'deleted' ? new Date().toISOString() : null;
	}
	const rows = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `valentina_memory_items?id=eq.${encodeURIComponent(item.id)}&select=${MEDIA_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});
	if (!rows[0])
		throw new ApiError(503, 'service_unavailable', 'No se pudo actualizar el recuerdo.');
	const next = mapMediaRow(rows[0]);
	await appendAudit({
		mediaItemId: next.id,
		actorType: 'organizer',
		actorId: input.actorId,
		action: targetStatus !== item.status ? 'moderation_updated' : 'caption_updated',
		metadata: { fromStatus: item.status, toStatus: targetStatus },
	});
	return toPublicItem(next);
}

export async function getMediaObjectForPrivateRetrieval(
	mediaItemId: string,
	ownerSessionId?: string,
): Promise<{
	objectKey: string;
	mimeType: string;
	downloadName: string;
}> {
	const row = await findMediaById(mediaItemId);
	if (!row) throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
	if (ownerSessionId && row.session_id !== ownerSessionId) {
		throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
	}
	const item = mapMediaRow(row);
	if (
		item.deletedAt ||
		item.status === 'deleted' ||
		(!ownerSessionId && item.status !== 'accepted')
	) {
		throw new ApiError(404, 'not_found', 'Recuerdo no disponible.');
	}
	if (!isValentinaMemoriesObjectKeyForMime(row.object_key, row.mime_type)) {
		throw new ApiError(500, 'internal_error', 'El recuerdo no tiene un identificador válido.');
	}
	return {
		objectKey: row.object_key,
		mimeType: row.mime_type,
		downloadName: `valentina-${randomUUID()}.${getValentinaMemoriesMimePolicy(row.mime_type)?.extension ?? 'bin'}`,
	};
}
