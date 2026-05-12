export type GalleryVariant = 'luxury-hacienda' | 'celestial-blue' | 'jewelry-box' | 'standard';

// Gallery layout strategies are a local subset of theme variants. Other presets intentionally
// fall back to the standard grid while still using their preset/section color tokens.

export type LayoutClass =
	| 'gallery-grid__item--feature'
	| 'gallery-grid__item--wide'
	| 'gallery-grid__item--standard';

type LayoutStrategy = (index: number) => LayoutClass;

const strategies: Record<GalleryVariant, LayoutStrategy> = {
	'luxury-hacienda': (index) => {
		if (index === 0) return 'gallery-grid__item--feature';
		if (index === 1 || index === 2 || index === 7) return 'gallery-grid__item--wide';
		return 'gallery-grid__item--standard';
	},
	'celestial-blue': (index) => {
		if (index === 0 || index === 5 || index === 6) return 'gallery-grid__item--feature';
		if (index === 2 || index === 3 || index === 8 || index === 9)
			return 'gallery-grid__item--wide';
		return 'gallery-grid__item--standard';
	},
	'jewelry-box': (index) => {
		if (index % 5 === 0) return 'gallery-grid__item--feature';
		if (index % 3 === 0) return 'gallery-grid__item--wide';
		return 'gallery-grid__item--standard';
	},
	standard: () => 'gallery-grid__item--standard',
};

export function getLayoutClass(index: number, variant?: string): string {
	const strategy = strategies[variant as GalleryVariant];
	return strategy ? strategy(index) : 'gallery-grid__item--standard';
}
