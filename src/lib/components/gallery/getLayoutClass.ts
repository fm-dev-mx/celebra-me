import type { GalleryLayoutRole } from '@/lib/invitation/gallery-presentation';

export type LayoutClass =
	'gallery-grid__item--feature' | 'gallery-grid__item--wide' | 'gallery-grid__item--standard';

const FEATURE = 'gallery-grid__item--feature';
const WIDE = 'gallery-grid__item--wide';
const STANDARD = 'gallery-grid__item--standard';

type Strategy = {
	featureIndices: number[];
	wideIndices: number[];
};

const strategies: Record<string, Strategy | ((index: number) => LayoutClass)> = {
	'uniform-grid': {
		featureIndices: [],
		wideIndices: [],
	},
	'editorial-mosaic': {
		featureIndices: [],
		wideIndices: [],
	},
	'magazine-spread': {
		featureIndices: [0, 4],
		wideIndices: [3, 7],
	},
	'feature-mosaic': {
		featureIndices: [0],
		wideIndices: [1, 2, 7],
	},
	'index-choreography': {
		featureIndices: [0, 5, 6],
		wideIndices: [2, 3, 7],
	},
	'single-keepsake': {
		featureIndices: [],
		wideIndices: [],
	},
	'luxury-hacienda': {
		featureIndices: [0],
		wideIndices: [1, 2, 7],
	},
	'celestial-blue': {
		featureIndices: [0, 5, 6],
		wideIndices: [2, 3, 7],
	},
	'enchanted-rose': {
		featureIndices: [0, 5],
		wideIndices: [1, 4],
	},
	'editorial-magazine': {
		featureIndices: [0, 4],
		wideIndices: [3, 7],
	},
	single: {
		featureIndices: [],
		wideIndices: [],
	},
	'jewelry-box': (index: number): LayoutClass => {
		if (index % 5 === 0) return FEATURE;
		if (index % 3 === 0) return WIDE;
		return STANDARD;
	},
};

type LayoutVariant = keyof typeof strategies;

function layoutRoleToClass(role: GalleryLayoutRole | string | undefined): LayoutClass | null {
	if (role === 'feature') return FEATURE;
	if (role === 'wide') return WIDE;
	if (role === 'standard') return STANDARD;
	return null;
}

export function getLayoutClass(
	index: number,
	variant?: string,
	layoutRole?: GalleryLayoutRole | string,
): LayoutClass {
	const fromRole = layoutRoleToClass(layoutRole);
	if (fromRole) return fromRole;

	const strategy = strategies[variant as LayoutVariant];

	if (!strategy) {
		return STANDARD;
	}

	if (typeof strategy === 'function') {
		return strategy(index);
	}

	if (strategy.featureIndices.includes(index)) return FEATURE;
	if (strategy.wideIndices.includes(index)) return WIDE;
	return STANDARD;
}
