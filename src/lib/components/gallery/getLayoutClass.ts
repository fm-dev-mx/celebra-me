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

/** Gallery variants whose item roles follow a position pattern; every other variant is uniform. */
const strategies: Record<string, Strategy> = {
	'magazine-spread': {
		featureIndices: [0, 4],
		wideIndices: [3, 7],
	},
	'feature-mosaic': {
		featureIndices: [0],
		wideIndices: [1, 2, 7],
	},
	'feature-stack': {
		featureIndices: [0],
		wideIndices: [],
	},
	'index-choreography': {
		featureIndices: [0, 5, 6],
		wideIndices: [2, 3, 7],
	},
};

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

	const strategy = variant ? strategies[variant] : undefined;
	if (!strategy) return STANDARD;

	if (strategy.featureIndices.includes(index)) return FEATURE;
	if (strategy.wideIndices.includes(index)) return WIDE;
	return STANDARD;
}
