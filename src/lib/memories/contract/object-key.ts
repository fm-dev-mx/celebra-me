/**
 * R2 object key layout: `events/<event uuid>/<object uuid>.<extension>`.
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
