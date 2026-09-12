export const IMAGE_SECTION_ROLES = [
	'hero',
	'portrait-family',
	'gallery-visible',
	'gallery-expanded',
	'interlude',
	'venue',
	'raster-map',
	'closing',
	'decorative',
] as const;

export type ImageSectionRole = (typeof IMAGE_SECTION_ROLES)[number];
export type ImageBudgetViewport = 'mobile' | 'desktop';

export interface ImageDeliveryBudget {
	maxBytes: Record<ImageBudgetViewport, number>;
	maxPreparedEdgePx: number;
	loading: 'eager' | 'lazy';
}

const kib = (value: number): number => value * 1024;

export const IMAGE_DELIVERY_BUDGETS: Readonly<Record<ImageSectionRole, ImageDeliveryBudget>> = {
	hero: {
		maxBytes: { mobile: kib(150), desktop: kib(250) },
		maxPreparedEdgePx: 2560,
		loading: 'eager',
	},
	'portrait-family': {
		maxBytes: { mobile: kib(180), desktop: kib(280) },
		maxPreparedEdgePx: 2560,
		loading: 'lazy',
	},
	'gallery-visible': {
		maxBytes: { mobile: kib(120), desktop: kib(200) },
		maxPreparedEdgePx: 2048,
		loading: 'lazy',
	},
	'gallery-expanded': {
		maxBytes: { mobile: kib(220), desktop: kib(300) },
		maxPreparedEdgePx: 2560,
		loading: 'lazy',
	},
	interlude: {
		maxBytes: { mobile: kib(160), desktop: kib(220) },
		maxPreparedEdgePx: 2048,
		loading: 'lazy',
	},
	venue: {
		maxBytes: { mobile: kib(160), desktop: kib(220) },
		maxPreparedEdgePx: 2048,
		loading: 'lazy',
	},
	'raster-map': {
		maxBytes: { mobile: kib(120), desktop: kib(160) },
		maxPreparedEdgePx: 1600,
		loading: 'lazy',
	},
	closing: {
		maxBytes: { mobile: kib(160), desktop: kib(220) },
		maxPreparedEdgePx: 2048,
		loading: 'lazy',
	},
	decorative: {
		maxBytes: { mobile: kib(80), desktop: kib(150) },
		maxPreparedEdgePx: 1600,
		loading: 'lazy',
	},
};

export const INITIAL_IMAGE_BUDGET_BYTES = kib(1536);
export const PRE_LCP_IMAGE_BUDGET_BYTES: Readonly<Record<ImageBudgetViewport, number>> = {
	mobile: kib(350),
	desktop: kib(600),
};

export function classifyImageSectionRole(pathOrKey: string): ImageSectionRole {
	const value = pathOrKey.toLowerCase();
	if (value.includes('portrait') || value.includes('family')) return 'portrait-family';
	if (value.includes('backgroundimagemobile') || value.includes('hero')) return 'hero';
	if (value.includes('map')) return 'raster-map';
	if (value.includes('venue') || value.includes('location')) return 'venue';
	if (value.includes('interlude')) return 'interlude';
	if (value.includes('thankyou') || value.includes('thank-you') || value.includes('closing'))
		return 'closing';
	if (value.includes('expanded') || value.includes('lightbox')) return 'gallery-expanded';
	if (value.includes('gallery')) return 'gallery-visible';
	return 'decorative';
}

export interface DeliveredImageMeasurement {
	identity: string;
	role: ImageSectionRole;
	bytes: number;
	preLcp?: boolean;
	initial?: boolean;
}

export function evaluateImageDeliveryBudget(
	measurement: DeliveredImageMeasurement,
	viewport: ImageBudgetViewport,
): string[] {
	const budget = IMAGE_DELIVERY_BUDGETS[measurement.role];
	return measurement.bytes > budget.maxBytes[viewport]
		? [
				measurement.identity +
					' exceeds ' +
					measurement.role +
					' ' +
					viewport +
					' budget: ' +
					measurement.bytes +
					' > ' +
					budget.maxBytes[viewport] +
					' bytes.',
			]
		: [];
}

export function evaluateAggregateImageBudgets(
	measurements: readonly DeliveredImageMeasurement[],
	viewport: ImageBudgetViewport,
): string[] {
	const unique = new Map<string, DeliveredImageMeasurement>();
	for (const measurement of measurements) {
		if (!unique.has(measurement.identity)) unique.set(measurement.identity, measurement);
	}
	const values = [...unique.values()];
	const failures = values.flatMap((measurement) =>
		evaluateImageDeliveryBudget(measurement, viewport),
	);
	const preLcpBytes = values
		.filter((measurement) => measurement.preLcp)
		.reduce((sum, measurement) => sum + measurement.bytes, 0);
	const initialBytes = values
		.filter((measurement) => measurement.initial)
		.reduce((sum, measurement) => sum + measurement.bytes, 0);
	if (preLcpBytes > PRE_LCP_IMAGE_BUDGET_BYTES[viewport]) {
		failures.push(
			'Pre-LCP image bytes exceed ' +
				viewport +
				' budget: ' +
				preLcpBytes +
				' > ' +
				PRE_LCP_IMAGE_BUDGET_BYTES[viewport] +
				' bytes.',
		);
	}
	if (initialBytes > INITIAL_IMAGE_BUDGET_BYTES) {
		failures.push(
			'Initial image bytes exceed budget: ' +
				initialBytes +
				' > ' +
				INITIAL_IMAGE_BUDGET_BYTES +
				' bytes.',
		);
	}
	return failures;
}
