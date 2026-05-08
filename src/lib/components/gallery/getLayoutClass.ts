export type GalleryVariant = 'luxury-hacienda' | 'celestial-blue' | 'jewelry-box' | 'standard';

export type LayoutClass =
	| 'gallery-grid__item--feature'
	| 'gallery-grid__item--wide'
	| 'gallery-grid__item--standard';

export interface GridPosition {
	column: string;
	row?: string;
	marginTop?: string;
	zIndex?: number;
}

export interface ImagePosition {
	x: string;
	y: string;
}

export interface GalleryLayoutConfig {
	positionDesktop: GridPosition[];
	imagePosition: ImagePosition[];
}

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

const sharedPositionConfig = (span: number) =>
	Array.from({ length: 10 }, () => ({ column: `span ${span}` }));

export const layoutConfigs: Record<GalleryVariant, GalleryLayoutConfig> = {
	'celestial-blue': {
		positionDesktop: [
			{ column: '1 / span 5', row: 'span 2' },
			{ column: '6 / span 3', marginTop: 'clamp(2rem, 4vw, 3.8rem)' },
			{ column: '9 / span 4' },
			{ column: '6 / span 7' },
			{ column: '1 / span 4', marginTop: 'clamp(1rem, 3vw, 2rem)' },
			{ column: '5 / span 4', row: 'span 2' },
			{
				column: '9 / span 4',
				marginTop: 'calc(var(--gallery-editorial-overlap) * -0.25)',
				zIndex: 4,
			},
			{
				column: '1 / span 4',
				marginTop: 'calc(var(--gallery-editorial-overlap) * 0.95)',
				zIndex: 2,
			},
			{
				column: '5 / span 5',
				marginTop: 'calc(var(--gallery-editorial-overlap) * -0.6)',
				zIndex: 5,
			},
			{
				column: '10 / span 3',
				marginTop: 'calc(var(--gallery-editorial-overlap) * 0.5)',
				zIndex: 3,
			},
		],
		imagePosition: [
			{ x: 'center', y: '34%' },
			{ x: 'center', y: '42%' },
			{ x: 'center', y: '26%' },
			{ x: 'center', y: '42%' },
			{ x: 'center', y: '42%' },
			{ x: 'center', y: '42%' },
			{ x: 'center', y: '38%' },
			{ x: 'center', y: '45%' },
			{ x: 'center', y: '45%' },
			{ x: 'center', y: '24%' },
		],
	},
	'luxury-hacienda': {
		positionDesktop: [
			{ column: '1 / span 6', row: 'span 2' },
			{ column: '7 / span 3' },
			{ column: '10 / span 3' },
			{ column: '1 / span 3' },
			{ column: '4 / span 3' },
			{ column: '7 / span 6', row: 'span 2' },
			{ column: '1 / span 4' },
			{ column: '5 / span 4' },
			{ column: '9 / span 4' },
			{ column: '1 / span 3' },
		],
		imagePosition: Array(10).fill({ x: 'center', y: 'center' }),
	},
	'jewelry-box': {
		positionDesktop: [
			{ column: '1 / span 4' },
			{ column: '5 / span 4' },
			{ column: '9 / span 4' },
			{ column: '1 / span 3' },
			{ column: '4 / span 3' },
			{ column: '7 / span 3' },
			{ column: '10 / span 3' },
			{ column: '1 / span 2' },
			{ column: '3 / span 2' },
			{ column: '5 / span 2' },
		],
		imagePosition: Array(10).fill({ x: 'center', y: 'center' }),
	},
	standard: {
		positionDesktop: sharedPositionConfig(4),
		imagePosition: Array(10).fill({ x: 'center', y: 'center' }),
	},
};

export function getLayoutClass(index: number, variant?: string): string {
	const strategy = strategies[variant as GalleryVariant];
	return strategy ? strategy(index) : 'gallery-grid__item--standard';
}

export function getLayoutData(index: number, variant?: string) {
	const config = layoutConfigs[variant as GalleryVariant];
	if (!config) return null;
	return {
		positionDesktop: config.positionDesktop[index] ?? null,
		imagePosition: config.imagePosition[index] ?? null,
	};
}
