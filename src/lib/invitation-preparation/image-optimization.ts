/**
 * Preparation-level WebP transfer-weight targets by visual role.
 * These are guidance targets for optimization plans — not hard publish limits.
 * Existing normalize/publish gates in asset-policy and publishing.service remain authoritative
 * for runtime enforcement.
 */

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
