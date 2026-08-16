import type { CanonicalPromotionRow, InvitationLifecycle } from './types';

export function isAuthoringLifecycle(lifecycle: InvitationLifecycle): boolean {
	return lifecycle === 'in_progress';
}

export function isAuthoringPromotion(row: { lifecycle: InvitationLifecycle }): boolean {
	return isAuthoringLifecycle(row.lifecycle);
}

export function releasePromotions<T extends { lifecycle: InvitationLifecycle }>(
	promotions: readonly T[],
): T[] {
	return promotions.filter((row) => !isAuthoringPromotion(row));
}

export function authoringPromotions<T extends { lifecycle: InvitationLifecycle }>(
	promotions: readonly T[],
): T[] {
	return promotions.filter(isAuthoringPromotion);
}

export function authoringSlugSet(
	items: Iterable<{ slug: string; lifecycle: InvitationLifecycle }>,
): Set<string> {
	const slugs = new Set<string>();
	for (const item of items) {
		if (isAuthoringLifecycle(item.lifecycle)) slugs.add(item.slug);
	}
	return slugs;
}

export function partitionPromotions(promotions: readonly CanonicalPromotionRow[]): {
	release: CanonicalPromotionRow[];
	authoring: CanonicalPromotionRow[];
} {
	return {
		release: releasePromotions(promotions),
		authoring: authoringPromotions(promotions),
	};
}
