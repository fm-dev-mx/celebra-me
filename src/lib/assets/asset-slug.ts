import { isValidEvent } from '@/lib/assets/asset-registry';
import type { Invitation } from '@/lib/intake/types';

export const ALL_EDITOR_KEYS: readonly string[] = [
	'title',
	'description',
	'hero',
	'family',
	'location',
	'countdown',
	'itinerary',
	'rsvp',
	'music',
	'gifts',
	'quote',
	'thankYou',
	'gallery',
	'photoNotes',
	'sectionOrder',
];

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
