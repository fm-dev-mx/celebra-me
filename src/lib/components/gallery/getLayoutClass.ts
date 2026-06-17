export type LayoutClass =
	| 'gallery-grid__item--feature'
	| 'gallery-grid__item--wide'
	| 'gallery-grid__item--standard';

const FEATURE = 'gallery-grid__item--feature';
const WIDE = 'gallery-grid__item--wide';
const STANDARD = 'gallery-grid__item--standard';

type Strategy = {
	featureIndices: number[];
	wideIndices: number[];
};

const strategies: Record<string, Strategy | ((index: number) => LayoutClass)> = {
	'luxury-hacienda': {
		featureIndices: [0],
		wideIndices: [1, 2, 7],
	},
	'celestial-blue': {
		featureIndices: [0, 5, 6],
		wideIndices: [2, 3, 8, 9],
	},
	'enchanted-rose': {
		featureIndices: [0, 5],
		wideIndices: [1, 4],
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

export function getLayoutClass(index: number, variant?: string): LayoutClass {
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
