export type GalleryVariant =
	| 'luxury-hacienda'
	| 'celestial-blue'
	| 'jewelry-box'
	| 'organic'
	| 'standard';

export function getLayoutClass(index: number, variant?: GalleryVariant): string {
	if (variant === 'luxury-hacienda') {
		if (index === 0) return 'gallery-grid__item--feature';
		if (index === 1 || index === 2 || index === 7) return 'gallery-grid__item--wide';
		return 'gallery-grid__item--standard';
	}

	if (variant === 'celestial-blue') {
		if (index === 0 || index === 5) return 'gallery-grid__item--feature';
		if (index === 2 || index === 3 || index === 8) return 'gallery-grid__item--wide';
		return 'gallery-grid__item--standard';
	}

	if (variant === 'jewelry-box' || variant === 'organic') {
		if (index % 5 === 0) return 'gallery-grid__item--feature';
		if (index % 3 === 0) return 'gallery-grid__item--wide';
		return 'gallery-grid__item--standard';
	}

	return 'gallery-grid__item--standard';
}
