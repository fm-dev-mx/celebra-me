export const GIFTS_PRESENTATIONS = ['catalog', 'legend-only'] as const;

export type GiftsPresentation = (typeof GIFTS_PRESENTATIONS)[number];

export function resolveGiftsPresentation(
	presentation: GiftsPresentation | undefined,
): GiftsPresentation {
	return presentation ?? 'catalog';
}
