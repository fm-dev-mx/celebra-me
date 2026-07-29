/**
 * Isomorphic publication value normalization shared by server publish/diff
 * and the client invitation editor section-save path. Must not import `node:*`.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

const EMPTY_OPTIONAL_COLLECTION_KEYS = new Set(['gallery', 'itinerary']);

/** True when a gallery/itinerary-like object has no meaningful items. */
function isEmptyOptionalCollection(value: Record<string, unknown>): boolean {
	const items = value.items;
	return Array.isArray(items) && items.length === 0;
}

/** Normalizes values that are equivalent in the published contract. */
export function canonicalizePublicationValue(value: unknown): unknown {
	if (value === null || value === undefined || value === '') return undefined;
	if (typeof value === 'string') return value.trim() || undefined;
	if (Array.isArray(value)) {
		return value.map(canonicalizePublicationValue).filter((item) => item !== undefined);
	}
	if (!isPlainObject(value)) return value;

	const result: Record<string, unknown> = {};
	for (const key of Object.keys(value).sort()) {
		// Internal editor notes are never part of the public published contract.
		if (key === 'photoNotes') continue;
		// Uploaded URLs are derived when a snapshot is frozen and do not change its meaning.
		if (key === 'src' && value.type === 'uploaded') continue;
		const normalized = canonicalizePublicationValue(value[key]);
		if (normalized === undefined) continue;
		if (
			EMPTY_OPTIONAL_COLLECTION_KEYS.has(key) &&
			isPlainObject(normalized) &&
			isEmptyOptionalCollection(normalized)
		) {
			continue;
		}
		result[key] = normalized;
	}
	return Object.keys(result).length > 0 ? result : undefined;
}
