/**
 * R2 object key layout: `events/<event uuid>/<object uuid>.<extension>`, and
 * `events/<event uuid>/thumbs/<object uuid>.webp` for the small preview of an original.
 *
 * Keys carry no client identity and survive event slug renames. Both the app and
 * the Workers validate keys with this module.
 *
 * This module must stay free of imports beyond the sibling contract files.
 */

import { MEMORIES_UUID_PATTERN } from './catalog';
import { getMemoriesMimePolicy } from './media-policy';

export const MEMORIES_OBJECT_PREFIX = 'events/' as const;

const UUID_SOURCE = MEMORIES_UUID_PATTERN.source.slice(1, -1);

export function buildMemoriesObjectKey(
	eventId: string,
	objectId: string,
	extension: string,
): string {
	return `${MEMORIES_OBJECT_PREFIX}${eventId}/${objectId}.${extension}`;
}

export function parseMemoriesObjectKey(
	objectKey: unknown,
): { eventId: string; objectId: string; extension: string } | null {
	if (typeof objectKey !== 'string') return null;
	const match = new RegExp(
		`^${MEMORIES_OBJECT_PREFIX}(${UUID_SOURCE})/(${UUID_SOURCE})\\.([a-z0-9]{1,8})$`,
		'i',
	).exec(objectKey);
	if (!match) return null;
	return {
		eventId: match[1].toLowerCase(),
		objectId: match[2].toLowerCase(),
		extension: match[3].toLowerCase(),
	};
}

export function isMemoriesObjectKeyForMime(
	objectKey: unknown,
	mimeType: unknown,
): objectKey is string {
	if (typeof mimeType !== 'string') return false;
	const parsed = parseMemoriesObjectKey(objectKey);
	const policy = getMemoriesMimePolicy(mimeType);
	return Boolean(parsed && policy && parsed.extension === policy.extension);
}

export const MEMORIES_THUMBNAIL_MIME_TYPE = 'image/webp' as const;
/** Mirrors the CHECK on event_memory_items.thumbnail_bytes. */
export const MEMORIES_THUMBNAIL_MAX_BYTES = 96 * 1024;
export const MEMORIES_THUMBNAIL_MAX_DIMENSION_PX = 480;

/** The thumbnail of an original lives next to it and shares its object id. */
export function buildMemoriesThumbnailKey(originalObjectKey: string): string | null {
	const parsed = parseMemoriesObjectKey(originalObjectKey);
	if (!parsed) return null;
	return `${MEMORIES_OBJECT_PREFIX}${parsed.eventId}/thumbs/${parsed.objectId}.webp`;
}

export function isMemoriesThumbnailKey(objectKey: unknown): objectKey is string {
	if (typeof objectKey !== 'string') return false;
	return new RegExp(
		`^${MEMORIES_OBJECT_PREFIX}${UUID_SOURCE}/thumbs/${UUID_SOURCE}\\.webp$`,
		'i',
	).test(objectKey);
}

/** What the Workers may store or serve: an original for its MIME, or a WebP thumbnail. */
export function isMemoriesStorableKey(objectKey: unknown, mimeType: unknown): objectKey is string {
	if (isMemoriesObjectKeyForMime(objectKey, mimeType)) return true;
	return (
		typeof mimeType === 'string' &&
		mimeType.trim().toLowerCase() === MEMORIES_THUMBNAIL_MIME_TYPE &&
		isMemoriesThumbnailKey(objectKey)
	);
}
