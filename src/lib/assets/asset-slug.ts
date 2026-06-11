import { isValidEvent } from '@/lib/assets/asset-registry';
import type { Invitation } from '@/lib/intake/types';

export const ALL_EDITOR_KEYS: readonly string[] = [
	'title',
	'description',
	'hero',
	'family',
	'location',
	'eventTiming',
	'countdown',
	'itinerary',
	'rsvp',
	'music',
	'gifts',
	'quote',
	'thankYou',
	'gallery',
	'envelope',
	'photoNotes',
	'sectionOrder',
	'sharing',
];

/** Subset of ALL_EDITOR_KEYS whose values are objects (not scalars/arrays),
 *  requiring field-by-field merging instead of simple priority replace.
 *  Derived from ALL_EDITOR_KEYS to keep both lists in sync. */
export const OBJECT_SECTION_KEYS: ReadonlySet<string> = new Set(
	ALL_EDITOR_KEYS.filter((key) => key !== 'sectionOrder'),
);

export function getAssetSlugFromContent(
	content: Record<string, unknown> | null | undefined,
): string | undefined {
	const value = content?._assetSlug;
	return typeof value === 'string' && value.trim() ? value : undefined;
}

export function resolveAssetSlug(
	invitation: Invitation,
	publishedContent?: Record<string, unknown> | null,
): string {
	const publishedSlug = getAssetSlugFromContent(publishedContent);
	if (publishedSlug) return publishedSlug;
	if (invitation.kind === 'client' && invitation.slug && isValidEvent(invitation.slug)) {
		return invitation.slug;
	}
	return invitation.snapshot.previewSlug;
}
