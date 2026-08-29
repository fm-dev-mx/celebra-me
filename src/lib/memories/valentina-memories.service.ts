import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { parseCookieHeader } from '@/lib/rsvp/core/utils';
import { SupabaseHttpError, supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { findEventBySlugService } from '@/lib/rsvp/repositories/event.repository';
import { findMembershipByEventForHost } from '@/lib/rsvp/repositories/role-membership.repository';
import {
	VALENTINA_MEMORIES_EVENT_SLUG,
	VALENTINA_MEMORIES_CATALOG_PAGE_SIZE,
	VALENTINA_MEMORIES_DISPLAY_NAME_MIN_LENGTH,
	VALENTINA_MEMORIES_MAX_CAPTION_LENGTH,
	VALENTINA_MEMORIES_MEDIA_STATUSES,
	VALENTINA_MEMORIES_SESSION_COOKIE,
	VALENTINA_MEMORIES_SESSION_TTL_SECONDS,
	canTransitionValentinaMemoriesMedia,
	getValentinaMemoriesRecoveryCodePattern,
	isValidSha256Hex,
	isValentinaMemoriesObjectKeyForMime,
	sanitizeValentinaMemoriesDisplayName,
	sanitizeValentinaMemoriesCaption,
	type ValentinaMemoriesMediaItem,
	type ValentinaMemoriesMediaPublicItem,
	type ValentinaMemoriesOrganizerItem,
	type ValentinaMemoriesGuestProfile,
	type ValentinaMemoriesMediaStatus,
} from '@/data/valentina-memories-media.contract';
import {
	VALENTINA_MEMORIES_EVENT_ID,
	VALENTINA_MEMORIES_EVENT_MAX_BYTES,
	VALENTINA_MEMORIES_EVENT_MAX_OBJECTS,
	VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS,
	VALENTINA_MEMORIES_SESSION_MAX_BYTES,
	VALENTINA_MEMORIES_SESSION_MAX_FILES,
	VALENTINA_MEMORIES_SESSION_MAX_IN_FLIGHT,
	VALENTINA_MEMORIES_SESSION_MAX_VIDEOS,
	buildValentinaMemoriesObjectKey,
	getValentinaMemoriesMimePolicy,
	normalizeMemoriesMimeType,
	type ValentinaMemoriesAllowedMimeType,
} from '@/data/valentina-memories-upload.contract';
import { inspectValentinaMemoryObject } from '@/lib/memories/valentina-memories-retrieval';
import { appendValentinaMemoriesAudit } from '@/lib/memories/valentina-memories-audit';
import {
	requestValentinaMemoryUploadCapability,
	type ValentinaMemoriesUploadCapability,
} from '@/lib/memories/valentina-memories-upload-request';
import { calculateValentinaMemoriesGuestQuota } from '@/lib/memories/valentina-memories-quota';

type SessionRow = {
	id: string;
	event_key: string;
	token_hash: string;
	recovery_code_hash: string;
	created_at: string;
	last_seen_at: string;
	expires_at: string;
	revoked_at: string | null;
	display_name: string;
	guest_alias: string;
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
	idempotency_key: string | null;
	cleanup_after: string | null;
	cleanup_claimed_at: string | null;
	cleanup_lease_id: string | null;
	object_deleted_at: string | null;
};

const SESSION_COLUMNS =
	'id,event_key,token_hash,recovery_code_hash,created_at,last_seen_at,expires_at,revoked_at,display_name,guest_alias';
const MEDIA_COLUMNS =
	'id,event_key,session_id,object_key,mime_type,size_bytes,checksum_sha256,duration_seconds,caption,status,duplicate_of_id,created_at,updated_at,accepted_at,rejected_at,deleted_at,idempotency_key,cleanup_after,cleanup_claimed_at,cleanup_lease_id,object_deleted_at';
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function hashValentinaMemorySecret(value: string): string {
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

function makeGuestAlias(): string {
	return `invitado-${randomBytes(4).toString('hex')}`;
}

function requireDisplayName(value: unknown): string {
	const displayName = sanitizeValentinaMemoriesDisplayName(value);
	if (displayName.length < VALENTINA_MEMORIES_DISPLAY_NAME_MIN_LENGTH) {
		throw new ApiError(400, 'bad_request', 'Escriba su nombre o apodo.');
	}
	return displayName;
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
	return {
		id: item.id,
		mimeType: item.mimeType,
		sizeBytes: item.sizeBytes,
		durationSeconds: item.durationSeconds,
		caption: item.caption,
		status: item.status,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
		acceptedAt: item.acceptedAt,
		rejectedAt: item.rejectedAt,
		deletedAt: item.deletedAt,
	};
}

function toGuestProfile(session: SessionRow): ValentinaMemoriesGuestProfile {
	return {
		displayName: session.display_name,
		expiresAt: session.expires_at,
	};
}

export function getGuestMemoryProfile(session: SessionRow): ValentinaMemoriesGuestProfile {
	return toGuestProfile(session);
}

async function findActiveSessionByToken(token: string): Promise<SessionRow | null> {
	const now = new Date().toISOString();
	const rows = await supabaseRestRequest<SessionRow[]>({
		pathWithQuery: `valentina_memory_sessions?select=${SESSION_COLUMNS}&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&token_hash=eq.${hashValentinaMemorySecret(token)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(now)}&limit=1`,
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

export async function createGuestMemorySession(displayNameValue: unknown): Promise<{
	sessionToken: string;
	recoveryCode: string;
	profile: ValentinaMemoriesGuestProfile;
}> {
	const displayName = requireDisplayName(displayNameValue);
	const sessionToken = randomBytes(32).toString('base64url');
	const recoveryCode = makeRecoveryCode();
	const expiresAt = new Date(
		Date.now() + VALENTINA_MEMORIES_SESSION_TTL_SECONDS * 1000,
	).toISOString();
	let rows: SessionRow[] = [];
	for (let attempt = 0; attempt < 3 && rows.length === 0; attempt += 1) {
		try {
			rows = await supabaseRestRequest<SessionRow[]>({
				pathWithQuery: `valentina_memory_sessions?select=${SESSION_COLUMNS}`,
				method: 'POST',
				useServiceRole: true,
				prefer: 'return=representation',
				body: {
					event_key: VALENTINA_MEMORIES_EVENT_ID,
					token_hash: hashValentinaMemorySecret(sessionToken),
					recovery_code_hash: hashValentinaMemorySecret(recoveryCode),
					display_name: displayName,
					guest_alias: makeGuestAlias(),
					expires_at: expiresAt,
				},
			});
		} catch (error) {
			if (!(error instanceof SupabaseHttpError) || error.code !== '23505' || attempt === 2)
				throw error;
		}
	}
	if (!rows[0])
		throw new ApiError(
			503,
			'service_unavailable',
			'No se pudo iniciar la sesión de recuerdos.',
		);
	return { sessionToken, recoveryCode, profile: toGuestProfile(rows[0]) };
}

export async function recoverGuestMemorySession(value: unknown): Promise<{
	sessionToken: string;
	profile: ValentinaMemoriesGuestProfile;
}> {
	const recoveryCode = requireRecoveryCode(value);
	const now = new Date().toISOString();
	const rows = await supabaseRestRequest<SessionRow[]>({
		pathWithQuery: `valentina_memory_sessions?select=${SESSION_COLUMNS}&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&recovery_code_hash=eq.${hashValentinaMemorySecret(recoveryCode)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(now)}&limit=1`,
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
		body: { token_hash: hashValentinaMemorySecret(sessionToken), last_seen_at: now },
	});
	const next = updated[0];
	if (!next)
		throw new ApiError(
			503,
			'service_unavailable',
			'No se pudo recuperar la sesión de recuerdos.',
		);
	return { sessionToken, profile: toGuestProfile(next) };
}

export async function updateGuestMemoryProfile(input: {
	session: SessionRow;
	displayName: unknown;
}): Promise<ValentinaMemoriesGuestProfile> {
	const displayName = requireDisplayName(input.displayName);
	const rows = await supabaseRestRequest<SessionRow[]>({
		pathWithQuery: `valentina_memory_sessions?id=eq.${encodeURIComponent(input.session.id)}&revoked_at=is.null&select=${SESSION_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: { display_name: displayName, last_seen_at: new Date().toISOString() },
	});
	if (!rows[0]) throw new ApiError(404, 'not_found', 'La sesión ya no está disponible.');
	await appendValentinaMemoriesAudit({ actorType: 'guest', action: 'profile_updated' });
	return toGuestProfile(rows[0]);
}

async function findMediaById(id: string): Promise<MediaRow | null> {
	const rows = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `valentina_memory_items?select=${MEDIA_COLUMNS}&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&id=eq.${encodeURIComponent(id)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ?? null;
}

function validateRegisterPayload(input: {
	mimeType: unknown;
	sizeBytes: unknown;
	checksumSha256: unknown;
	durationSeconds?: unknown;
	clientRequestId: unknown;
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
	const clientRequestId = typeof input.clientRequestId === 'string' ? input.clientRequestId : '';
	if (
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
			clientRequestId,
		)
	)
		throw new ApiError(400, 'bad_request', 'La solicitud de carga no es válida.');

	return { mimeType, policy, sizeBytes, durationSeconds, checksumSha256, clientRequestId };
}

function mapReservationError(error: unknown): never {
	if (error instanceof SupabaseHttpError) {
		const quotaMessages: Record<string, string> = {
			memories_session_file_quota: 'Alcanzó el máximo de archivos para esta sesión.',
			memories_session_video_quota: 'Alcanzó el máximo de videos para esta sesión.',
			memories_session_byte_quota: 'Alcanzó el máximo de almacenamiento para esta sesión.',
			memories_event_object_quota: 'El evento alcanzó su capacidad de archivos.',
			memories_event_byte_quota: 'El evento alcanzó su capacidad de almacenamiento.',
		};
		for (const [code, message] of Object.entries(quotaMessages)) {
			if (error.body.includes(code)) throw new ApiError(409, 'limit_reached', message);
		}
		if (error.body.includes('memories_session_concurrency_quota'))
			throw new ApiError(429, 'rate_limited', 'Espere a que terminen sus cargas actuales.');
		if (error.body.includes('memories_idempotency_conflict'))
			throw new ApiError(
				409,
				'conflict',
				'La solicitud de carga ya se utilizó para otro archivo.',
			);
	}
	throw error;
}

export async function reserveGuestMemoryItem(input: {
	session: SessionRow;
	mimeType: unknown;
	sizeBytes: unknown;
	checksumSha256: unknown;
	durationSeconds?: unknown;
	clientRequestId: unknown;
}): Promise<{ item: ValentinaMemoriesMediaPublicItem; upload: ValentinaMemoriesUploadCapability }> {
	const { mimeType, policy, sizeBytes, durationSeconds, checksumSha256, clientRequestId } =
		validateRegisterPayload(input);
	const objectKey = buildValentinaMemoriesObjectKey(randomUUID(), policy.extension);
	let rows: MediaRow[];
	try {
		rows = await supabaseRestRequest<MediaRow[]>({
			pathWithQuery: 'rpc/reserve_valentina_memory_item',
			method: 'POST',
			useServiceRole: true,
			body: {
				p_event_key: VALENTINA_MEMORIES_EVENT_ID,
				p_session_id: input.session.id,
				p_object_key: objectKey,
				p_mime_type: mimeType,
				p_size_bytes: sizeBytes,
				p_checksum_sha256: checksumSha256,
				p_duration_seconds: policy.category === 'video' ? durationSeconds : null,
				p_idempotency_key: clientRequestId,
				p_max_session_files: VALENTINA_MEMORIES_SESSION_MAX_FILES,
				p_max_session_videos: VALENTINA_MEMORIES_SESSION_MAX_VIDEOS,
				p_max_session_bytes: VALENTINA_MEMORIES_SESSION_MAX_BYTES,
				p_max_session_in_flight: VALENTINA_MEMORIES_SESSION_MAX_IN_FLIGHT,
				p_max_event_objects: VALENTINA_MEMORIES_EVENT_MAX_OBJECTS,
				p_max_event_bytes: VALENTINA_MEMORIES_EVENT_MAX_BYTES,
			},
		});
	} catch (error) {
		mapReservationError(error);
	}
	if (!rows[0])
		throw new ApiError(503, 'service_unavailable', 'No se pudo registrar el recuerdo.');
	const item = mapMediaRow(rows[0]);
	const upload = await requestValentinaMemoryUploadCapability({
		objectKey: item.objectKey,
		sessionId: input.session.id,
		mimeType: item.mimeType,
		sizeBytes: item.sizeBytes,
		checksumSha256: item.checksumSha256,
	});
	await appendValentinaMemoriesAudit({
		mediaItemId: item.id,
		actorType: 'guest',
		action: 'reserved',
	});
	return { item: toPublicItem(item), upload };
}

export async function listGuestMemoryItems(session: SessionRow): Promise<{
	items: ValentinaMemoriesMediaPublicItem[];
	quota: ReturnType<typeof calculateValentinaMemoriesGuestQuota>;
}> {
	const rows = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `valentina_memory_items?select=${MEDIA_COLUMNS}&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&session_id=eq.${encodeURIComponent(session.id)}&order=created_at.desc`,
		useServiceRole: true,
	});
	return {
		items: rows.map(mapMediaRow).map(toPublicItem),
		quota: calculateValentinaMemoriesGuestQuota(rows),
	};
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
	if (!policy || inspection.sizeBytes !== item.sizeBytes) return false;
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

async function finalizeMemoryItem(input: {
	item: ValentinaMemoriesMediaItem;
	outcome: 'accepted' | 'rejected';
}): Promise<ValentinaMemoriesMediaPublicItem> {
	const rows = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: 'rpc/finalize_valentina_memory_item',
		method: 'POST',
		useServiceRole: true,
		body: {
			p_item_id: input.item.id,
			p_session_id: input.item.sessionId,
			p_outcome: input.outcome,
			p_cleanup_after: new Date().toISOString(),
		},
	});
	const fallback = rows[0] ?? (await findMediaById(input.item.id));
	if (!fallback) throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
	const next = mapMediaRow(fallback);
	await appendValentinaMemoriesAudit({
		mediaItemId: input.item.id,
		actorType: 'system',
		action:
			next.status === 'accepted'
				? 'validated_and_accepted'
				: next.status === 'duplicate'
					? 'deduplicated'
					: 'validation_failed',
	});
	return toPublicItem(next);
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

	if (item.status === 'uploading') {
		const validatingRows = await supabaseRestRequest<MediaRow[]>({
			pathWithQuery: 'rpc/claim_valentina_memory_validation',
			method: 'POST',
			useServiceRole: true,
			body: { p_item_id: item.id, p_session_id: input.session.id },
		});
		if (!validatingRows[0]) return currentPublicMemoryItem(item.id);
		await appendValentinaMemoriesAudit({
			mediaItemId: item.id,
			actorType: 'guest',
			action: 'submitted_for_validation',
		});
	}

	const inspection = await inspectValentinaMemoryObject({
		objectKey: item.objectKey,
		mimeType: item.mimeType,
	});

	if (!inspection) {
		throw new ApiError(
			503,
			'service_unavailable',
			'La validación sigue pendiente. Intente de nuevo.',
		);
	}
	return finalizeMemoryItem({
		item,
		outcome: isInspectionSuccessful(item, inspection) ? 'accepted' : 'rejected',
	});
}

export async function reconcileValentinaMemoryValidation(mediaItemId: string): Promise<boolean> {
	const row = await findMediaById(mediaItemId);
	if (!row || row.status !== 'validating') return true;
	const item = mapMediaRow(row);
	const inspection = await inspectValentinaMemoryObject({
		objectKey: item.objectKey,
		mimeType: item.mimeType,
	}).catch(() => null);
	if (!inspection) return false;
	await finalizeMemoryItem({
		item,
		outcome: isInspectionSuccessful(item, inspection) ? 'accepted' : 'rejected',
	});
	return true;
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
	await appendValentinaMemoriesAudit({
		mediaItemId: next.id,
		actorType: 'guest',
		action: 'caption_updated',
	});
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
			cleanup_after: new Date().toISOString(),
		},
	});
	if (!rows[0])
		throw new ApiError(503, 'service_unavailable', 'No se pudo eliminar el recuerdo.');
	await appendValentinaMemoriesAudit({
		mediaItemId: item.id,
		actorType: 'guest',
		action: 'deleted',
	});
}

export async function assertValentinaOrganizerAccess(input: {
	accessToken: string;
}): Promise<void> {
	const event = await findEventBySlugService(VALENTINA_MEMORIES_EVENT_SLUG);
	if (!event) throw new ApiError(404, 'not_found', 'El evento no está disponible.');
	const membership = await findMembershipByEventForHost(event.id, input.accessToken);
	if (!membership || membership.membershipRole !== 'owner') {
		throw new ApiError(403, 'forbidden', 'No tiene autorización para estos recuerdos.');
	}
}

export async function listOrganizerMemoryItems(input: { page?: number } = {}): Promise<{
	items: ValentinaMemoriesOrganizerItem[];
	nextPage: number | null;
}> {
	const maxPage =
		Math.ceil(VALENTINA_MEMORIES_EVENT_MAX_OBJECTS / VALENTINA_MEMORIES_CATALOG_PAGE_SIZE) - 1;
	const page =
		Number.isSafeInteger(input.page) &&
		(input.page as number) >= 0 &&
		(input.page as number) <= maxPage
			? (input.page as number)
			: 0;
	const offset = page * VALENTINA_MEMORIES_CATALOG_PAGE_SIZE;
	const rows = await supabaseRestRequest<MediaRow[]>({
		pathWithQuery: `valentina_memory_items?select=${MEDIA_COLUMNS}&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&order=created_at.desc,id.desc&limit=${VALENTINA_MEMORIES_CATALOG_PAGE_SIZE + 1}&offset=${offset}`,
		useServiceRole: true,
	});
	const pageRows = rows.slice(0, VALENTINA_MEMORIES_CATALOG_PAGE_SIZE);
	const sessionIds = Array.from(new Set(pageRows.map((row) => row.session_id)));
	const sessions = sessionIds.length
		? await supabaseRestRequest<SessionRow[]>({
				pathWithQuery: `valentina_memory_sessions?select=${SESSION_COLUMNS}&event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&id=in.(${sessionIds.join(',')})`,
				useServiceRole: true,
			})
		: [];
	const uploaderBySession = new Map(
		sessions.map((session) => [
			session.id,
			{ displayName: session.display_name, guestAlias: session.guest_alias },
		]),
	);
	return {
		items: pageRows.map((row) => ({
			...toPublicItem(mapMediaRow(row)),
			uploader: uploaderBySession.get(row.session_id) ?? {
				displayName: 'Invitado retirado',
				guestAlias: 'invitado-retirado',
			},
		})),
		nextPage: rows.length > VALENTINA_MEMORIES_CATALOG_PAGE_SIZE ? page + 1 : null,
	};
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
		if (targetStatus === 'deleted' || targetStatus === 'rejected')
			body.cleanup_after = new Date().toISOString();
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
	await appendValentinaMemoriesAudit({
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
	if (item.deletedAt || item.status !== 'accepted') {
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

export async function revokeGuestMemorySession(input: {
	guestAlias: unknown;
	actorId: string;
}): Promise<void> {
	const guestAlias = typeof input.guestAlias === 'string' ? input.guestAlias.trim() : '';
	if (!/^invitado-[a-z0-9]{8}$/.test(guestAlias))
		throw new ApiError(400, 'bad_request', 'El alias de invitado no es válido.');
	const rows = await supabaseRestRequest<SessionRow[]>({
		pathWithQuery: `valentina_memory_sessions?event_key=eq.${VALENTINA_MEMORIES_EVENT_ID}&guest_alias=eq.${encodeURIComponent(guestAlias)}&revoked_at=is.null&select=${SESSION_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: { revoked_at: new Date().toISOString() },
	});
	if (!rows[0]) throw new ApiError(404, 'not_found', 'La sesión no está disponible.');
	await appendValentinaMemoriesAudit({
		actorType: 'organizer',
		actorId: input.actorId,
		action: 'guest_session_revoked',
	});
}
