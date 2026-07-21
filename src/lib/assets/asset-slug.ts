import { isValidEvent } from '@/lib/assets/asset-registry';
import type { Invitation } from '@/lib/intake/types';

export function getAssetSlugFromContent(
	content: Record<string, unknown> | null | undefined,
): string | undefined {
	const value = content?._assetSlug;
	return typeof value === 'string' && value.trim() ? value : undefined;
}

export function resolveAssetSlug(
	invitation: Invitation,
	publishedContent?: Record<string, unknown> | null,
	visualConfiguration?: Record<string, unknown> | null,
): string {
	const publishedSlug = getAssetSlugFromContent(publishedContent);
	if (publishedSlug) return publishedSlug;

	if (invitation.kind === 'client' && invitation.slug) {
		if (isValidEvent(invitation.slug)) {
			return invitation.slug;
		}
		if (invitation.eventType) {
			const derived = `${invitation.slug}-${invitation.eventType}`;
			if (isValidEvent(derived)) {
				return derived;
			}
		}
	}

	// A demo's route/content slug can intentionally differ from the asset-registry
	// namespace while it reuses a curated media set. Keep this after a real
	// invitation's own asset namespace, but before the legacy previewSlug fallback.
	const configuredSlug = getAssetSlugFromContent(visualConfiguration);
	if (configuredSlug) return configuredSlug;

	return invitation.snapshot.previewSlug;
}
