export const XARENI_ASSET_SLUG = 'xv-xareni-iyarit';

export const XARENI_SEAL_COLORS = ['roseGold', 'champagne', 'blush', 'mauve', 'deepMauve'] as const;

export type XareniSealColor = (typeof XARENI_SEAL_COLORS)[number];

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
