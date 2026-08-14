/** Canonical WebP delivery budgets by visual role. */

export const IMAGE_ROLE_WEIGHT_TARGETS = {
	'hero-desktop': { minKb: 250, maxKb: 500 },
	'hero-mobile': { minKb: 180, maxKb: 350 },
	'editorial-featured': { minKb: 150, maxKb: 300 },
	'standard-section': { minKb: 100, maxKb: 220 },
	gallery: { minKb: 80, maxKb: 180 },
	'small-card': { minKb: 40, maxKb: 100 },
	thumbnail: { minKb: 20, maxKb: 60 },
} as const;

export type ImageOptimizationRole = keyof typeof IMAGE_ROLE_WEIGHT_TARGETS;

/**
 * Dimension candidates are tried from largest to smallest before lowering quality.
 * Final aspect-specific minimums remain enforced by the publication validator.
 */
export const IMAGE_ROLE_MAX_DIMENSION_STEPS: Record<ImageOptimizationRole, readonly number[]> = {
	'hero-desktop': [2560, 2304, 2048, 1792, 1536, 1280],
	'hero-mobile': [1920, 1600, 1440, 1280],
	'editorial-featured': [2200, 1920, 1600, 1280, 1024, 960],
	'standard-section': [1920, 1600, 1440, 1280, 1024, 960, 800],
	gallery: [1800, 1600, 1440, 1280, 1120, 960, 800],
	'small-card': [1200, 1024, 960, 800],
	thumbnail: [800, 640, 480],
};

/** Quality floor for role-aware delivery. The generic legacy ladder remains unchanged. */
export const IMAGE_ENCODING_QUALITIES = [84, 80, 76, 72] as const;

export const IMAGE_QUALITY_STATES = [
	'production-ready',
	'provisional-whatsapp',
	'temporary-placeholder',
	'missing',
	'unusable',
] as const;

export type ImageQualityState = (typeof IMAGE_QUALITY_STATES)[number];

export function isImageQualityState(value: string): value is ImageQualityState {
	return (IMAGE_QUALITY_STATES as readonly string[]).includes(value);
}

/** Quality states that must never silently become production-authoritative assets. */
export const NON_PRODUCTION_IMAGE_STATES: readonly ImageQualityState[] = [
	'provisional-whatsapp',
	'temporary-placeholder',
	'missing',
	'unusable',
] as const;

export function isProductionAuthoritativeImage(state: ImageQualityState): boolean {
	return state === 'production-ready';
}

export function getWeightTargetKb(role: ImageOptimizationRole): { minKb: number; maxKb: number } {
	return IMAGE_ROLE_WEIGHT_TARGETS[role];
}

export function getWeightTargetBytes(role: ImageOptimizationRole): number {
	return Math.round(getWeightTargetKb(role).maxKb * 1024);
}

export function getImageDimensionCandidates(role: ImageOptimizationRole): readonly number[] {
	return IMAGE_ROLE_MAX_DIMENSION_STEPS[role];
}

/** Maps the canonical published-content path to the delivery budget for that visual role. */
export function getImageOptimizationRoleForPath(path: string): ImageOptimizationRole {
	if (path === 'hero.backgroundImageMobile') return 'hero-mobile';
	if (path.startsWith('hero.backgroundImage')) return 'hero-desktop';
	if (
		path === 'hero.portrait' ||
		path === 'family.featuredImage' ||
		path === 'thankYou.image' ||
		path.startsWith('interludes[')
	) {
		return 'editorial-featured';
	}
	if (path.startsWith('gallery.items[')) return 'gallery';
	return 'standard-section';
}

export function evaluateWeightAgainstTarget(
	fileSizeBytes: number,
	role: ImageOptimizationRole,
): 'below-target' | 'within-target' | 'above-target' {
	const kb = fileSizeBytes / 1024;
	const { minKb, maxKb } = IMAGE_ROLE_WEIGHT_TARGETS[role];
	if (kb < minKb) return 'below-target';
	if (kb > maxKb) return 'above-target';
	return 'within-target';
}

export interface ImageOptimizationPlanItem {
	sourceFilename: string;
	role: ImageOptimizationRole | 'unassigned';
	qualityState: ImageQualityState;
	preserveOriginal: true;
	generateDerivative: boolean;
	derivativeNotes?: string;
	weightTargetKb?: { minKb: number; maxKb: number };
	recompressRecommended: boolean;
	rationale: string;
}

/**
 * Do not recompress already suitable images solely to satisfy a generic process.
 * Provisional/WhatsApp material must be replaced, not promoted by recompression alone.
 */
export function planImageOptimization(input: {
	sourceFilename: string;
	role: ImageOptimizationRole | 'unassigned';
	qualityState: ImageQualityState;
	fileSizeBytes: number;
	needsCropOrDerivative: boolean;
}): ImageOptimizationPlanItem {
	const { sourceFilename, role, qualityState, fileSizeBytes, needsCropOrDerivative } = input;
	const weightTargetKb = role === 'unassigned' ? undefined : getWeightTargetKb(role);

	if (qualityState === 'provisional-whatsapp' || qualityState === 'temporary-placeholder') {
		return {
			sourceFilename,
			role,
			qualityState,
			preserveOriginal: true,
			generateDerivative: false,
			recompressRecommended: false,
			weightTargetKb,
			rationale:
				'Provisional or placeholder material must be replaced with originals; do not promote via recompression.',
		};
	}

	if (qualityState === 'unusable' || qualityState === 'missing') {
		return {
			sourceFilename,
			role,
			qualityState,
			preserveOriginal: true,
			generateDerivative: false,
			recompressRecommended: false,
			weightTargetKb,
			rationale: 'Asset is missing or unusable; acquire a replacement before optimization.',
		};
	}

	const weightStatus =
		role === 'unassigned'
			? 'within-target'
			: evaluateWeightAgainstTarget(fileSizeBytes, role);

	const generateDerivative = needsCropOrDerivative || weightStatus === 'above-target';
	const recompressRecommended = weightStatus === 'above-target';

	return {
		sourceFilename,
		role,
		qualityState,
		preserveOriginal: true,
		generateDerivative,
		derivativeNotes: needsCropOrDerivative
			? 'Generate role-specific crop/derivative while preserving the original binary.'
			: undefined,
		weightTargetKb,
		recompressRecommended,
		rationale:
			weightStatus === 'within-target' && !needsCropOrDerivative
				? 'Source is suitable for the assigned role; skip gratuitous recompression.'
				: weightStatus === 'above-target'
					? 'Source exceeds role transfer-weight target; plan a quality-preserving derivative.'
					: needsCropOrDerivative
						? 'Role or composition requires a crop/derivative; preserve the original.'
						: 'Source is below typical weight band; prefer quality over forced upsizing.',
	};
}
