import type { CompletenessEvaluation } from '@/lib/invitation-preparation/event-completeness';
import type { ImageQualityState } from '@/lib/invitation-preparation/image-optimization';
import type { InfoClassification } from '@/lib/invitation-preparation/classification';
import {
	type PlaceholderRecord,
	validatePlaceholderRecords,
} from '@/lib/invitation-preparation/placeholders';

export const PREPARATION_READINESS_STATES = [
	'NOT_READY',
	'READY_WITH_PLACEHOLDERS',
	'READY_FOR_IMPLEMENTATION',
] as const;

export type PreparationReadiness = (typeof PREPARATION_READINESS_STATES)[number];

export function isPreparationReadiness(value: string): value is PreparationReadiness {
	return (PREPARATION_READINESS_STATES as readonly string[]).includes(value);
}

export interface AssetPreparationSummary {
	sourcePathProvided: boolean;
	inventoried: boolean;
	hasAssignableImages: boolean;
	/** True when every assigned production role still relies on provisional/unusable material. */
	onlyNonProductionImages: boolean;
	blockingIssues: string[];
}

export interface DesignDecisionSummary {
	demoClassification: InfoClassification;
	/** Unresolved design items that must block readiness (e.g. palette, layout forks). */
	blockingUnresolvedDecisions: string[];
}

export interface PreparationReadinessInput {
	completeness: CompletenessEvaluation;
	placeholders: readonly PlaceholderRecord[];
	assets: AssetPreparationSummary;
	design: DesignDecisionSummary;
}

export interface PreparationReadinessResult {
	readiness: PreparationReadiness;
	reasons: string[];
	allowsImplementation: boolean;
	blockingPlaceholderTokens: string[];
	nonBlockingPlaceholderTokens: string[];
}

function designBlocksImplementation(design: DesignDecisionSummary): string[] {
	const issues: string[] = [...design.blockingUnresolvedDecisions];
	if (
		design.demoClassification === 'missing' ||
		design.demoClassification === 'ambiguous' ||
		design.demoClassification === 'requires_owner_decision'
	) {
		issues.push(`Demo/design selection is ${design.demoClassification}`);
	}
	return issues;
}

function collectAssetReasons(assets: AssetPreparationSummary): string[] {
	const reasons: string[] = [];
	if (!assets.sourcePathProvided) {
		reasons.push('Source asset path is required before photograph analysis.');
		return reasons;
	}
	if (!assets.inventoried) {
		reasons.push('Source asset path has not been inventoried.');
	} else if (!assets.hasAssignableImages) {
		reasons.push('No assignable source photographs were found.');
	}
	reasons.push(...assets.blockingIssues);
	if (assets.onlyNonProductionImages) {
		reasons.push(
			'Only provisional/non-production photographs are available; document replacements or obtain originals before READY_FOR_IMPLEMENTATION.',
		);
	}
	return reasons;
}

function hasBlockingConditions(input: {
	completeness: CompletenessEvaluation;
	assets: AssetPreparationSummary;
	designIssues: string[];
	blockingPlaceholders: readonly PlaceholderRecord[];
	placeholderValidationOk: boolean;
}): boolean {
	return (
		!input.completeness.sufficientToPrepare ||
		!input.assets.sourcePathProvided ||
		!input.assets.inventoried ||
		!input.assets.hasAssignableImages ||
		input.assets.blockingIssues.length > 0 ||
		input.designIssues.length > 0 ||
		input.blockingPlaceholders.length > 0 ||
		!input.placeholderValidationOk
	);
}

/**
 * Preparation readiness is independent from technical Local/Preview/Production readiness.
 */
export function evaluatePreparationReadiness(
	input: PreparationReadinessInput,
): PreparationReadinessResult {
	const placeholderValidation = validatePlaceholderRecords(input.placeholders);
	const blockingPlaceholders = input.placeholders.filter((item) => item.blocking);
	const nonBlockingPlaceholders = input.placeholders.filter((item) => !item.blocking);
	const designIssues = designBlocksImplementation(input.design);

	const reasons: string[] = [];
	if (!placeholderValidation.ok) {
		reasons.push(...placeholderValidation.reasons);
	}
	if (!input.completeness.sufficientToPrepare) {
		for (const gap of input.completeness.blockingGaps) {
			reasons.push(`Blocking completeness gap: ${gap.fieldId} (${gap.status})`);
		}
	}
	reasons.push(...collectAssetReasons(input.assets));
	reasons.push(...designIssues);
	for (const placeholder of blockingPlaceholders) {
		reasons.push(`Blocking placeholder present: ${placeholder.token}`);
	}

	const tokens = {
		blockingPlaceholderTokens: blockingPlaceholders.map((item) => item.token),
		nonBlockingPlaceholderTokens: nonBlockingPlaceholders.map((item) => item.token),
	};

	if (
		hasBlockingConditions({
			completeness: input.completeness,
			assets: input.assets,
			designIssues,
			blockingPlaceholders,
			placeholderValidationOk: placeholderValidation.ok,
		})
	) {
		return {
			readiness: 'NOT_READY',
			reasons,
			allowsImplementation: false,
			...tokens,
		};
	}

	if (nonBlockingPlaceholders.length > 0 || input.assets.onlyNonProductionImages) {
		const readyReasons = [
			'Structural decisions are resolved.',
			'Only documented non-blocking placeholders and/or provisional asset replacements remain.',
		];
		if (input.assets.onlyNonProductionImages) {
			readyReasons.push(
				'Implementation may proceed only with explicitly documented provisional assets and replacement requirements.',
			);
		}
		return {
			readiness: 'READY_WITH_PLACEHOLDERS',
			reasons: readyReasons,
			allowsImplementation: true,
			blockingPlaceholderTokens: [],
			nonBlockingPlaceholderTokens: tokens.nonBlockingPlaceholderTokens,
		};
	}

	return {
		readiness: 'READY_FOR_IMPLEMENTATION',
		reasons: [
			'Required information is verified or validly resolved.',
			'Required assets are inventoried and production-ready.',
			'Material demo/design decisions are resolved.',
			'No blocking or non-blocking placeholders remain.',
		],
		allowsImplementation: true,
		blockingPlaceholderTokens: [],
		nonBlockingPlaceholderTokens: [],
	};
}

export function canBeginImplementation(readiness: PreparationReadiness): boolean {
	return readiness === 'READY_WITH_PLACEHOLDERS' || readiness === 'READY_FOR_IMPLEMENTATION';
}

export function assertImplementationAllowed(readiness: PreparationReadiness): void {
	if (!canBeginImplementation(readiness)) {
		throw new Error(
			'Implementation of payloads, invitation-specific SCSS, or equivalent client-specific production work must not begin while preparation is NOT_READY.',
		);
	}
}

/** Heuristic: treat WhatsApp-compressed inventory as non-production authoritative. */
export function summarizeAssetQuality(
	states: readonly ImageQualityState[],
): Pick<AssetPreparationSummary, 'hasAssignableImages' | 'onlyNonProductionImages'> {
	const usable = states.filter((state) => state !== 'missing' && state !== 'unusable');
	const production = usable.filter((state) => state === 'production-ready');
	return {
		hasAssignableImages: usable.length > 0,
		onlyNonProductionImages: usable.length > 0 && production.length === 0,
	};
}
