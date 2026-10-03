import { isValidEvent } from '@/lib/assets/asset-registry';
import type { Invitation } from '@/lib/intake/types';

export function getAssetSlugFromContent(
	content: Record<string, unknown> | null | undefined,
): string | undefined {
	const value = content?._assetSlug;
	return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * The invitation's own versioned asset namespace: the published `_assetSlug`, or a
 * registry namespace named after the invitation. Undefined when the invitation only
 * uses uploaded assets.
 */
export function resolveAssetSlug(
	invitation: Pick<Invitation, 'slug' | 'eventType'>,
	publishedContent?: Record<string, unknown> | null,
): string | undefined {
	const publishedSlug = getAssetSlugFromContent(publishedContent);
	if (publishedSlug) return publishedSlug;
	if (!invitation.slug) return undefined;
	if (isValidEvent(invitation.slug)) return invitation.slug;
	const derived = `${invitation.slug}-${invitation.eventType}`;
	return isValidEvent(derived) ? derived : undefined;
}
