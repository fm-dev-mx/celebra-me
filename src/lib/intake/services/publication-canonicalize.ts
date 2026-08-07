/**
 * Isomorphic publication value normalization shared by server publish/diff
 * and the client invitation editor section-save path. Must not import `node:*`.
 */
import { foldShowFlourishesIntoPresentationOptions } from '@/lib/invitation/presentation-options';
import { toEditorDate } from '@/lib/shared/data-utils';
import { normalizeTime } from '@/lib/time/time-format';

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

const EMPTY_OPTIONAL_COLLECTION_KEYS = new Set(['gallery', 'itinerary']);

/** True when a gallery/itinerary-like object has no meaningful items. */
function isEmptyOptionalCollection(value: Record<string, unknown>): boolean {
	const items = value.items;
	return Array.isArray(items) && items.length === 0;
}

/**
 * During the prose → machine transition, treat equivalent date/time spellings
 * as equal so preflight does not invent pending changes.
 */
function canonicalizeDateTimeField(key: string, value: unknown): unknown {
	if (typeof value !== 'string') return canonicalizePublicationValue(value);
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	if (key === 'date') {
		return toEditorDate(trimmed) ?? trimmed;
	}
	if (key === 'time') {
		return normalizeTime(trimmed) ?? trimmed;
	}
	return canonicalizePublicationValue(trimmed);
}

/**
 * Fold legacy `sectionStyles.location.showFlourishes` into the canonical
 * `location.presentationOptions.showFlourishes` owner and drop the legacy key
 * before equality checks / hashing.
 */
export function preparePublicationProjection(value: unknown): unknown {
	if (!isPlainObject(value)) return value;
	const root = isPlainObject(value.content)
		? { ...value, content: { ...value.content } }
		: { ...value };
	const content = (isPlainObject(root.content) ? root.content : root) as Record<string, unknown>;

	const sectionStyles = content.sectionStyles;
	const legacyFlourishes =
		isPlainObject(sectionStyles) && isPlainObject(sectionStyles.location)
			? (sectionStyles.location.showFlourishes as boolean | undefined)
			: undefined;

	if (isPlainObject(content.location)) {
		content.location = foldShowFlourishesIntoPresentationOptions(
			content.location,
			legacyFlourishes,
		) as Record<string, unknown>;
	}

	if (isPlainObject(sectionStyles) && isPlainObject(sectionStyles.location)) {
		const { showFlourishes: _legacy, ...locationStyleRest } = sectionStyles.location;
		content.sectionStyles = {
			...sectionStyles,
			location: locationStyleRest,
		};
	}

	return root;
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
		const raw = value[key];
		const normalized =
			key === 'date' || key === 'time'
				? canonicalizeDateTimeField(key, raw)
				: canonicalizePublicationValue(raw);
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
