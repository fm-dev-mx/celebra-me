import {
	isMemoriesMediaStatus,
	sanitizeMemoriesCaption,
	type MemoriesMediaItem,
	type MemoriesMediaPublicItem,
	type MemoriesOrganizerItem,
} from '@/lib/memories/contract/catalog';
import {
	getMemoriesMimePolicy,
	normalizeMemoriesMimeType,
	type MemoriesAllowedMimeType,
} from '@/lib/memories/contract/media-policy';
import type { MediaRow, OrganizerMediaRow } from './catalog.repository';

const RETIRED_UPLOADER = { displayName: 'Invitado retirado', guestAlias: 'invitado-retirado' };

export function mapMediaRow(row: MediaRow): MemoriesMediaItem {
	if (!isMemoriesMediaStatus(row.status)) throw new Error('Invalid media catalog row.');
	const mimeType = normalizeMemoriesMimeType(row.mime_type);
	if (!getMemoriesMimePolicy(mimeType)) throw new Error('Invalid media MIME type.');
	return {
		id: row.id,
		eventId: row.event_id,
		sessionId: row.session_id,
		objectKey: row.object_key,
		mimeType: mimeType as MemoriesAllowedMimeType,
		sizeBytes: Number(row.size_bytes),
		checksumSha256: (row.checksum_sha256 ?? '').toLowerCase(),
		durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
		caption: sanitizeMemoriesCaption(row.caption),
		status: row.status,
		duplicateOfId: row.duplicate_of_id ?? null,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		acceptedAt: row.accepted_at,
		rejectedAt: row.rejected_at,
		deletedAt: row.deleted_at,
	};
}

export function toPublicItem(item: MemoriesMediaItem): MemoriesMediaPublicItem {
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

export function toOrganizerItem(row: OrganizerMediaRow): MemoriesOrganizerItem {
	const relation = Array.isArray(row.uploader) ? row.uploader[0] : row.uploader;
	return {
		...toPublicItem(mapMediaRow(row)),
		uploader: relation
			? { displayName: relation.display_name, guestAlias: relation.guest_alias }
			: RETIRED_UPLOADER,
	};
}
