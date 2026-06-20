export const XARENI_ASSET_SLUG = 'xv-xareni-iyarit';

export const XARENI_SEAL_COLORS = ['roseGold', 'champagne', 'blush', 'mauve', 'deepMauve'] as const;

export const FAMILY_PRESENTATIONS = ['with-photo', 'text-only'] as const;
export const LOCATION_PRESENTATIONS = ['simple', 'with-map', 'with-photo'] as const;

export type XareniSealColor = (typeof XARENI_SEAL_COLORS)[number];
export type FamilyPresentation = (typeof FAMILY_PRESENTATIONS)[number];
export type LocationPresentation = (typeof LOCATION_PRESENTATIONS)[number];
export type LocationMediaMode = 'none' | 'map' | 'image';

export const XARENI_SEAL_COLOR_LABELS: Record<XareniSealColor, string> = {
	roseGold: 'Oro rosado',
	champagne: 'Champagne',
	blush: 'Rosa blush',
	mauve: 'Malva',
	deepMauve: 'Malva profundo',
};

const XARENI_SEAL_COLOR_CSS: Record<XareniSealColor, string> = {
	roseGold: 'var(--xareni-rose-gold)',
	champagne: 'var(--xareni-champagne)',
	blush: 'var(--xareni-blush)',
	mauve: 'var(--xareni-mauve)',
	deepMauve: 'var(--xareni-deep-mauve)',
};

export function isXareniSealColor(value: unknown): value is XareniSealColor {
	return typeof value === 'string' && (XARENI_SEAL_COLORS as readonly string[]).includes(value);
}

export function resolveXareniSealColor(value: unknown): string | undefined {
	return isXareniSealColor(value) ? XARENI_SEAL_COLOR_CSS[value] : undefined;
}

export function supportsXareniPresentationOptions(context: { assetLookupSlug?: string }): boolean {
	return context.assetLookupSlug === XARENI_ASSET_SLUG;
}

export function shouldRenderFamilyMedia(
	presentation: FamilyPresentation | undefined,
	hasFeaturedImage: boolean,
): boolean {
	return presentation !== 'text-only' && hasFeaturedImage;
}

export function resolveLocationMediaMode(
	presentation: LocationPresentation | undefined,
	media: { hasCoordinates: boolean; hasImage: boolean },
): LocationMediaMode {
	if (presentation === 'simple') return 'none';
	if (presentation === 'with-map') {
		if (media.hasCoordinates) return 'map';
		return media.hasImage ? 'image' : 'none';
	}
	if (presentation === 'with-photo') {
		if (media.hasImage) return 'image';
		return media.hasCoordinates ? 'map' : 'none';
	}
	if (media.hasCoordinates) return 'map';
	return media.hasImage ? 'image' : 'none';
}
