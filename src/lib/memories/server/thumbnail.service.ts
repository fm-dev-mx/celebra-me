/**
 * Guest thumbnails: after an original is accepted, the guest's browser renders a
 * small WebP and sends it straight to R2 with its own capability. The thumbnail
 * never counts against a quota, is capped at 96 KiB and is deleted with its original.
 */

import { ApiError } from '@/lib/rsvp/core/errors';
import { isValidSha256Hex, type MemoriesSpaceRecord } from '@/lib/memories/contract/catalog';
import {
	MEMORIES_THUMBNAIL_MAX_BYTES,
	MEMORIES_THUMBNAIL_MIME_TYPE,
	buildMemoriesThumbnailKey,
} from '@/lib/memories/contract/object-key';
import { appendMemoriesAudit } from './audit';
import { findMediaById, patchMedia, type SessionRow } from './catalog.repository';
import { mapMediaRow } from './media-mapper';
import {
	inspectMemoriesObject,
	isMemoriesSignerRateLimit,
	requestMemoriesUploadCapability,
	type MemoriesUploadCapability,
} from './worker-gateway';

async function requireThumbnailTarget(
	space: MemoriesSpaceRecord,
	session: SessionRow,
	mediaItemId: string,
) {
	const row = await findMediaById(space.eventId, mediaItemId);
	if (!row || row.session_id !== session.id)
		throw new ApiError(404, 'not_found', 'Recuerdo no encontrado.');
	const item = mapMediaRow(row);
	if (item.status !== 'accepted' || item.deletedAt)
		throw new ApiError(409, 'conflict', 'El recuerdo no admite una vista previa.');
	const thumbnailKey = buildMemoriesThumbnailKey(item.objectKey);
	if (!thumbnailKey)
		throw new ApiError(500, 'internal_error', 'El recuerdo no tiene un identificador válido.');
	return { item, thumbnailKey };
}

export async function reserveGuestThumbnail(input: {
	space: MemoriesSpaceRecord;
	session: SessionRow;
	mediaItemId: string;
	sizeBytes: unknown;
	checksumSha256: unknown;
}): Promise<{ upload: MemoriesUploadCapability | null }> {
	const sizeBytes = input.sizeBytes;
	if (
		typeof sizeBytes !== 'number' ||
		!Number.isSafeInteger(sizeBytes) ||
		sizeBytes <= 0 ||
		sizeBytes > MEMORIES_THUMBNAIL_MAX_BYTES ||
		!isValidSha256Hex(input.checksumSha256)
	) {
		throw new ApiError(400, 'bad_request', 'La vista previa no cumple la política.');
	}
	const { item, thumbnailKey } = await requireThumbnailTarget(
		input.space,
		input.session,
		input.mediaItemId,
	);
	// A thumbnail is written once; a second one would orphan the first object.
	if (item.thumbnailObjectKey) return { upload: null };
	try {
		const upload = await requestMemoriesUploadCapability({
			objectKey: thumbnailKey,
			sessionId: input.session.id,
			mimeType: MEMORIES_THUMBNAIL_MIME_TYPE,
			sizeBytes,
			checksumSha256: input.checksumSha256.toLowerCase(),
		});
		return { upload };
	} catch (error) {
		if (isMemoriesSignerRateLimit(error))
			throw new ApiError(429, 'rate_limited', 'Demasiadas solicitudes.');
		throw new ApiError(503, 'service_unavailable', 'No se pudo preparar la vista previa.');
	}
}

/** Records the thumbnail once its bytes are verified in storage. */
export async function confirmGuestThumbnail(input: {
	space: MemoriesSpaceRecord;
	session: SessionRow;
	mediaItemId: string;
}): Promise<{ hasThumbnail: boolean }> {
	const { item, thumbnailKey } = await requireThumbnailTarget(
		input.space,
		input.session,
		input.mediaItemId,
	);
	if (item.thumbnailObjectKey) return { hasThumbnail: true };
	const outcome = await inspectMemoriesObject({
		objectKey: thumbnailKey,
		mimeType: MEMORIES_THUMBNAIL_MIME_TYPE,
	});
	if (outcome.kind === 'unavailable')
		throw new ApiError(503, 'service_unavailable', 'No se pudo confirmar la vista previa.');
	if (
		outcome.kind === 'missing' ||
		!outcome.inspection.signatureValid ||
		outcome.inspection.sizeBytes <= 0 ||
		outcome.inspection.sizeBytes > MEMORIES_THUMBNAIL_MAX_BYTES
	) {
		throw new ApiError(409, 'conflict', 'La vista previa no es válida.');
	}
	const updated = await patchMedia(
		item.id,
		{ thumbnail_object_key: thumbnailKey, thumbnail_bytes: outcome.inspection.sizeBytes },
		'&thumbnail_object_key=is.null',
	);
	if (updated) {
		await appendMemoriesAudit({
			eventId: input.space.eventId,
			mediaItemId: item.id,
			actorType: 'guest',
			action: 'thumbnail_attached',
		});
	}
	return { hasThumbnail: true };
}
