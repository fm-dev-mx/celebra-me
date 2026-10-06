import { ApiError } from '@/lib/rsvp/core/errors';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import {
	calculateMemoriesGuestQuota,
	isMemoriesCatalogVisibleStatus,
	isMemoriesTerminalStatus,
	isMemoriesUuid,
	isValidSha256Hex,
	sanitizeMemoriesCaption,
	type MemoriesGuestQuota,
	type MemoriesMediaItem,
	type MemoriesMediaPublicItem,
	type MemoriesReservationRefusal,
	type MemoriesSpaceRecord,
} from '@/lib/memories/contract/catalog';
import {
	MEMORIES_LATE_UPLOAD_GRACE_SECONDS,
	MEMORIES_RESERVATION_TTL_SECONDS,
	MEMORIES_SESSION_MAX_IN_FLIGHT,
	MEMORIES_UPLOAD_ABANDON_SECONDS,
	MEMORIES_VALIDATION_RETRY_DELAY_SECONDS,
} from '@/lib/memories/contract/limits';
import {
	MEMORIES_MAX_VIDEO_DURATION_SECONDS,
	getMemoriesMimePolicy,
	normalizeMemoriesMimeType,
	roundMemoriesVideoDurationSeconds,
} from '@/lib/memories/contract/media-policy';
import {
	MEMORIES_THUMBNAIL_MIME_TYPE,
	buildMemoriesObjectKey,
	isMemoriesObjectKeyForMime,
} from '@/lib/memories/contract/object-key';
import { appendMemoriesAudit } from './audit';
import {
	claimValidation,
	findMediaById,
	finalizeMedia,
	listSessionInFlightMedia,
	listSessionMedia,
	patchMedia,
	releaseReservation,
	reserveMedia,
	type MediaRow,
	type SessionRow,
} from './catalog.repository';
import { mapMediaRow, toPublicItem } from './media-mapper';
import { createMemoriesObjectId } from './secrets';
import { isMemorySpaceFull } from './usage.service';
import {
	inspectMemoriesObject,
	isMemoriesSignerRateLimit,
	requestMemoriesUploadCapability,
	type MemoriesInspectionResult,
	type MemoriesUploadCapability,
} from './worker-gateway';

const RESERVATION_ERRORS: Record<
	string,
	{
		status: number;
		code:
			| 'limit_reached'
			| 'rate_limited'
			| 'conflict'
			| 'forbidden'
			| 'not_found'
			| 'unauthorized';
		message: string;
		/** Sent to the browser so the guest copy can name the limit that was hit. */
		reason?: MemoriesReservationRefusal;
	}
> = {
	memories_session_file_quota: {
		status: 409,
		code: 'limit_reached',
		message: 'Alcanzó el máximo de archivos para esta sesión.',
		reason: 'session_files',
	},
	memories_session_video_quota: {
		status: 409,
		code: 'limit_reached',
		message: 'Alcanzó el máximo de videos para esta sesión.',
		reason: 'session_videos',
	},
	memories_session_byte_quota: {
		status: 409,
		code: 'limit_reached',
		message: 'Alcanzó el máximo de almacenamiento para esta sesión.',
		reason: 'session_bytes',
	},
	memories_event_object_quota: {
		status: 409,
		code: 'limit_reached',
		message: 'El evento alcanzó su capacidad de archivos.',
		reason: 'event_capacity',
	},
	memories_event_byte_quota: {
		status: 409,
		code: 'limit_reached',
		message: 'El evento alcanzó su capacidad de almacenamiento.',
		reason: 'event_capacity',
	},
	memories_session_concurrency_quota: {
		status: 429,
		code: 'rate_limited',
		message: 'Espere a que terminen sus cargas actuales.',
		reason: 'uploads_in_progress',
	},
	memories_idempotency_conflict: {
		status: 409,
		code: 'conflict',
		message: 'La solicitud de carga ya se utilizó para otro archivo.',
	},
	memories_upload_window_closed: {
		status: 403,
		code: 'forbidden',
		message: 'La ventana para subir recuerdos no está abierta.',
	},
	memories_space_unavailable: {
		status: 404,
		code: 'not_found',
		message: 'El espacio de recuerdos no está disponible.',
	},
	memories_session_unavailable: {
		status: 401,
		code: 'unauthorized',
		message: 'La sesión ya no está disponible.',
	},
};

function mapReservationError(error: unknown): never {
	if (error instanceof SupabaseHttpError) {
		for (const [token, mapped] of Object.entries(RESERVATION_ERRORS)) {
			if (error.body.includes(token))
				throw new ApiError(
					mapped.status,
					mapped.code,
					mapped.message,
					mapped.reason ? { reason: mapped.reason } : undefined,
				);
		}
	}
	throw error;
}

function isConcurrencyQuotaError(error: unknown): boolean {
	return (
		error instanceof SupabaseHttpError &&
		error.body.includes('memories_session_concurrency_quota')
	);
}

function requireOwnItem(row: MediaRow | null, session: SessionRow): MemoriesMediaItem {
	if (!row || row.session_id !== session.id) {
		throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
	}
	return mapMediaRow(row);
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
	const policy = getMemoriesMimePolicy(mimeType);
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
		(durationSeconds === null ||
			!Number.isFinite(durationSeconds) ||
			durationSeconds <= 0 ||
			durationSeconds > MEMORIES_MAX_VIDEO_DURATION_SECONDS)
	) {
		throw new ApiError(400, 'bad_request', 'La duración del video no es válida.');
	}
	if (!isMemoriesUuid(input.clientRequestId)) {
		throw new ApiError(400, 'bad_request', 'La solicitud de carga no es válida.');
	}
	return {
		mimeType,
		policy,
		sizeBytes,
		durationSeconds:
			durationSeconds === null ? null : roundMemoriesVideoDurationSeconds(durationSeconds),
		checksumSha256,
		clientRequestId: input.clientRequestId,
	};
}

export async function reserveGuestMemoryItem(input: {
	space: MemoriesSpaceRecord;
	session: SessionRow;
	mimeType: unknown;
	sizeBytes: unknown;
	checksumSha256: unknown;
	durationSeconds?: unknown;
	clientRequestId: unknown;
}): Promise<{ item: MemoriesMediaPublicItem; upload: MemoriesUploadCapability | null }> {
	const { mimeType, policy, sizeBytes, durationSeconds, checksumSha256, clientRequestId } =
		validateRegisterPayload(input);
	const reservation = {
		eventId: input.space.eventId,
		sessionId: input.session.id,
		objectKey: buildMemoriesObjectKey(
			input.space.eventId,
			createMemoriesObjectId(),
			policy.extension,
		),
		mimeType,
		sizeBytes,
		checksumSha256,
		durationSeconds: policy.category === 'video' ? durationSeconds : null,
		idempotencyKey: clientRequestId,
		maxSessionInFlight: MEMORIES_SESSION_MAX_IN_FLIGHT,
	};
	let row: MediaRow | null = null;
	try {
		row = await reserveMedia(reservation);
	} catch (error) {
		// The cleanup runs once a day: a session whose slots are held by uploads
		// its browser abandoned settles them here and tries once more.
		if (!isConcurrencyQuotaError(error)) mapReservationError(error);
		const settled = await settleSessionInFlightItems(input.space, input.session).catch(() => 0);
		if (settled === 0) mapReservationError(error);
		try {
			row = await reserveMedia(reservation);
		} catch (retryError) {
			mapReservationError(retryError);
		}
	}
	if (!row) throw new ApiError(503, 'service_unavailable', 'No se pudo registrar el recuerdo.');
	const item = mapMediaRow(row);
	// A replayed request id returns the existing row. Only a pending upload may
	// receive a new PUT capability; anything else must never reopen its key.
	if (item.status === 'validating' || item.status === 'accepted' || item.status === 'duplicate')
		return { item: toPublicItem(item), upload: null };
	if (item.status !== 'uploading')
		throw new ApiError(
			409,
			'conflict',
			'La solicitud de carga anterior ya se cerró. Vuelva a subir el archivo.',
		);
	let upload: MemoriesUploadCapability;
	try {
		upload = await requestMemoriesUploadCapability({
			objectKey: item.objectKey,
			sessionId: input.session.id,
			mimeType: item.mimeType,
			sizeBytes: item.sizeBytes,
			checksumSha256: item.checksumSha256,
		});
	} catch (error) {
		await releaseReservation(item.id, input.session.id).catch(() => undefined);
		// The Sign Worker throttles per session: the guest must wait, nothing is broken.
		if (isMemoriesSignerRateLimit(error)) {
			throw new ApiError(
				429,
				'rate_limited',
				'Demasiadas solicitudes. Intente de nuevo más tarde.',
			);
		}
		console.error('[memories] Upload capability failed after reservation.', error);
		throw new ApiError(
			503,
			'service_unavailable',
			'No se pudo preparar la carga. Intente de nuevo.',
		);
	}
	await appendMemoriesAudit({
		eventId: input.space.eventId,
		mediaItemId: item.id,
		actorType: 'guest',
		action: 'reserved',
	});
	return { item: toPublicItem(item), upload };
}

export async function listGuestMemoryItems(
	space: MemoriesSpaceRecord,
	session: SessionRow,
): Promise<{ items: MemoriesMediaPublicItem[]; quota: MemoriesGuestQuota; eventFull: boolean }> {
	const [rows, eventFull] = await Promise.all([
		listSessionMedia(space.eventId, session.id),
		isMemorySpaceFull(space).catch(() => false),
	]);
	return {
		eventFull,
		items: rows
			.map(mapMediaRow)
			.filter((item) => isMemoriesCatalogVisibleStatus(item.status))
			.map(toPublicItem),
		quota: calculateMemoriesGuestQuota(
			rows.map((row) => ({
				mimeType: row.mime_type,
				sizeBytes: Number(row.size_bytes),
				status: row.status,
				objectDeleted: row.object_deleted_at !== null,
			})),
			space,
			MEMORIES_SESSION_MAX_IN_FLIGHT,
		),
	};
}

function isInspectionSuccessful(
	item: MemoriesMediaItem,
	inspection: MemoriesInspectionResult,
): boolean {
	if (!inspection.exists || !inspection.signatureValid || !inspection.checksumSha256)
		return false;
	const policy = getMemoriesMimePolicy(item.mimeType);
	if (!policy || inspection.sizeBytes !== item.sizeBytes) return false;
	if (inspection.checksumSha256.toLowerCase() !== item.checksumSha256) return false;
	if (
		policy.category === 'video' &&
		(inspection.durationSeconds == null ||
			inspection.durationSeconds <= 0 ||
			inspection.durationSeconds > MEMORIES_MAX_VIDEO_DURATION_SECONDS)
	) {
		return false;
	}
	return true;
}

async function finalizeItem(
	item: MemoriesMediaItem,
	outcome: 'accepted' | 'rejected',
): Promise<MemoriesMediaPublicItem> {
	const row =
		(await finalizeMedia({
			itemId: item.id,
			sessionId: item.sessionId,
			outcome,
			cleanupAfter: new Date().toISOString(),
		})) ?? (await findMediaById(item.eventId, item.id));
	if (!row) throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
	const next = mapMediaRow(row);
	await appendMemoriesAudit({
		eventId: item.eventId,
		mediaItemId: item.id,
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
	space: MemoriesSpaceRecord;
	session: SessionRow;
	mediaItemId: string;
}): Promise<MemoriesMediaPublicItem> {
	const item = requireOwnItem(
		await findMediaById(input.space.eventId, input.mediaItemId),
		input.session,
	);
	if (isMemoriesTerminalStatus(item.status)) return toPublicItem(item);
	if (item.status === 'uploading') {
		const claimed = await claimValidation(item.id, input.session.id);
		if (!claimed) {
			const current = await findMediaById(input.space.eventId, item.id);
			if (!current) throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
			return toPublicItem(mapMediaRow(current));
		}
		await appendMemoriesAudit({
			eventId: input.space.eventId,
			mediaItemId: item.id,
			actorType: 'guest',
			action: 'submitted_for_validation',
		});
	}
	const outcome = await inspectMemoriesObject({
		objectKey: item.objectKey,
		mimeType: item.mimeType,
	});
	if (outcome.kind === 'unavailable') {
		throw new ApiError(
			503,
			'service_unavailable',
			'La validación sigue pendiente. Intente de nuevo.',
		);
	}
	return finalizeItem(
		item,
		outcome.kind === 'found' && isInspectionSuccessful(item, outcome.inspection)
			? 'accepted'
			: 'rejected',
	);
}

export type MemoriesSettleResult = 'validated' | 'rescued' | 'rejected' | 'released' | 'pending';

/**
 * Settles one in-flight item from storage evidence. Nothing is rejected or
 * released unless the Retrieval Worker answered that the object is absent; an
 * unreachable Worker always leaves the item pending.
 */
export async function settleStaleMemoryItem(
	row: MediaRow,
	now = new Date(),
): Promise<MemoriesSettleResult> {
	const item = mapMediaRow(row);
	const nowMs = now.getTime();
	if (item.status === 'validating') {
		if (nowMs - Date.parse(row.updated_at) < MEMORIES_VALIDATION_RETRY_DELAY_SECONDS * 1000)
			return 'pending';
		const outcome = await inspectMemoriesObject({
			objectKey: item.objectKey,
			mimeType: item.mimeType,
		});
		if (outcome.kind === 'unavailable') return 'pending';
		if (outcome.kind === 'missing') {
			await finalizeItem(item, 'rejected');
			return 'rejected';
		}
		await finalizeItem(
			item,
			isInspectionSuccessful(item, outcome.inspection) ? 'accepted' : 'rejected',
		);
		return 'validated';
	}
	if (item.status !== 'uploading') return 'pending';
	const ageMs = nowMs - Date.parse(row.created_at);
	if (ageMs < MEMORIES_RESERVATION_TTL_SECONDS * 1000) return 'pending';
	const outcome = await inspectMemoriesObject({
		objectKey: item.objectKey,
		mimeType: item.mimeType,
	});
	if (outcome.kind === 'unavailable') return 'pending';
	if (outcome.kind === 'found') {
		// The bytes arrived but the browser never confirmed them.
		if (!(await claimValidation(item.id, item.sessionId))) return 'pending';
		await appendMemoriesAudit({
			eventId: item.eventId,
			mediaItemId: item.id,
			actorType: 'system',
			action: 'submitted_for_validation',
		});
		await finalizeItem(
			item,
			isInspectionSuccessful(item, outcome.inspection) ? 'accepted' : 'rejected',
		);
		return 'rescued';
	}
	if (ageMs < MEMORIES_UPLOAD_ABANDON_SECONDS * 1000) return 'pending';
	// A logical delete keeps the key scheduled, so a PUT that still lands is removed too.
	const released = await patchMedia(
		item.id,
		{
			status: 'deleted',
			deleted_at: now.toISOString(),
			cleanup_after: new Date(
				nowMs + MEMORIES_LATE_UPLOAD_GRACE_SECONDS * 1000,
			).toISOString(),
		},
		'&status=eq.uploading',
	);
	if (!released) return 'pending';
	await appendMemoriesAudit({
		eventId: item.eventId,
		mediaItemId: item.id,
		actorType: 'system',
		action: 'reservation_abandoned',
	});
	return 'released';
}

/** Settles the session's own in-flight items; returns how many left the in-flight state. */
async function settleSessionInFlightItems(
	space: MemoriesSpaceRecord,
	session: SessionRow,
): Promise<number> {
	const rows = await listSessionInFlightMedia(space.eventId, session.id);
	let settled = 0;
	for (const row of rows) {
		if ((await settleStaleMemoryItem(row)) !== 'pending') settled += 1;
	}
	return settled;
}

export async function updateGuestMemoryCaption(input: {
	space: MemoriesSpaceRecord;
	session: SessionRow;
	mediaItemId: string;
	caption: unknown;
}): Promise<MemoriesMediaPublicItem> {
	const item = requireOwnItem(
		await findMediaById(input.space.eventId, input.mediaItemId),
		input.session,
	);
	if (item.status === 'deleted')
		throw new ApiError(409, 'conflict', 'El recuerdo ya fue eliminado.');
	const row = await patchMedia(
		item.id,
		{ caption: sanitizeMemoriesCaption(input.caption) },
		'&status=neq.deleted',
	);
	if (!row) throw new ApiError(503, 'service_unavailable', 'No se pudo actualizar el recuerdo.');
	await appendMemoriesAudit({
		eventId: input.space.eventId,
		mediaItemId: item.id,
		actorType: 'guest',
		action: 'caption_updated',
	});
	return toPublicItem(mapMediaRow(row));
}

export async function deleteGuestMemoryItem(input: {
	space: MemoriesSpaceRecord;
	session: SessionRow;
	mediaItemId: string;
}): Promise<void> {
	const item = requireOwnItem(
		await findMediaById(input.space.eventId, input.mediaItemId),
		input.session,
	);
	if (item.status === 'deleted') return;
	const now = new Date().toISOString();
	const row = await patchMedia(
		item.id,
		{ status: 'deleted', deleted_at: now, cleanup_after: now },
		'&status=neq.deleted',
	);
	if (!row) throw new ApiError(503, 'service_unavailable', 'No se pudo eliminar el recuerdo.');
	await appendMemoriesAudit({
		eventId: input.space.eventId,
		mediaItemId: item.id,
		actorType: 'guest',
		action: 'deleted',
	});
}

/** Resolves the object behind a media id for the owning guest or the organizer. */
export async function getMediaObjectForRetrieval(
	space: MemoriesSpaceRecord,
	mediaItemId: string,
	ownerSessionId?: string,
	options: { variant?: 'original' | 'thumb'; excludeHidden?: boolean } = {},
): Promise<{ objectKey: string; mimeType: string; downloadName: string }> {
	const row = await findMediaById(space.eventId, mediaItemId);
	if (!row || (ownerSessionId && row.session_id !== ownerSessionId)) {
		throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
	}
	const item = mapMediaRow(row);
	if (item.deletedAt || item.status !== 'accepted' || (options.excludeHidden && item.hiddenAt)) {
		throw new ApiError(404, 'not_found', 'Recuerdo no disponible.');
	}
	// Files from before thumbnails existed fall back to the original.
	if (options.variant === 'thumb' && item.thumbnailObjectKey) {
		return {
			objectKey: item.thumbnailObjectKey,
			mimeType: MEMORIES_THUMBNAIL_MIME_TYPE,
			downloadName: `vista-previa-${item.id.slice(0, 8)}.webp`,
		};
	}
	if (!isMemoriesObjectKeyForMime(item.objectKey, item.mimeType)) {
		throw new ApiError(500, 'internal_error', 'El recuerdo no tiene un identificador válido.');
	}
	return {
		objectKey: item.objectKey,
		mimeType: item.mimeType,
		downloadName: `recuerdo-${item.createdAt.slice(0, 10)}-${item.id.slice(0, 8)}.${getMemoriesMimePolicy(item.mimeType)?.extension ?? 'bin'}`,
	};
}
