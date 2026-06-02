export type LayoutClass =
	| 'gallery-grid__item--feature'
	| 'gallery-grid__item--wide'
	| 'gallery-grid__item--standard';

// Strategies for gallery themes with explicit feature/wide/standard layout roles.
// Themes missing from this map (angelic-presence, sacred-keepsake, editorial,
// and base/unlisted) use uniform grids without role-based spans; the fallback
// to 'standard' is correct for them and should not be changed without a theme
// redesign.
const strategies = {
	'luxury-hacienda': (index: number): LayoutClass => {
		if (index === 0) return 'gallery-grid__item--feature';
		if (index === 1 || index === 2 || index === 7) return 'gallery-grid__item--wide';
		return 'gallery-grid__item--standard';
	},
	'celestial-blue': (index: number): LayoutClass => {
		if (index === 0 || index === 5 || index === 6) return 'gallery-grid__item--feature';
		if (index === 2 || index === 3 || index === 8 || index === 9)
			return 'gallery-grid__item--wide';
		return 'gallery-grid__item--standard';
	},
	'enchanted-rose': (): LayoutClass => 'gallery-grid__item--standard',
	'jewelry-box': (index: number): LayoutClass => {
		if (index % 5 === 0) return 'gallery-grid__item--feature';
		if (index % 3 === 0) return 'gallery-grid__item--wide';
		return 'gallery-grid__item--standard';
	},
};

export type GalleryVariant = keyof typeof strategies;

export function getLayoutClass(index: number, variant?: string): LayoutClass {
	const strategy = strategies[variant as GalleryVariant];
	return strategy ? strategy(index) : 'gallery-grid__item--standard';
}
