/**
 * Pure promotion destination decision. No I/O, approvals, schema, or timestamps.
 * SSOT consumed by CLI, dashboard, and tests.
 */
import type {
	EnvironmentPromotionState,
	PromotionAction,
	PromotionReasonCode,
} from './types';

export interface PromotionDecision {
	action: PromotionAction;
	reasonCode: PromotionReasonCode;
}

function evaluateBlockedGuards(
	local: EnvironmentPromotionState,
	preview: EnvironmentPromotionState,
	production: EnvironmentPromotionState,
): PromotionDecision | null {
	if (local === 'conflict' || preview === 'conflict' || production === 'conflict') {
		return { action: 'BLOCKED', reasonCode: 'IDENTITY_CONFLICT' };
	}
	if (local === 'diverged' || preview === 'diverged' || production === 'diverged') {
		return { action: 'BLOCKED', reasonCode: 'MANAGED_DIVERGENCE' };
	}
	if (production === 'match' && (preview === 'behind' || preview === 'absent')) {
		return { action: 'BLOCKED', reasonCode: 'PRODUCTION_AHEAD_OF_PREVIEW' };
	}
	return null;
}

function evaluatePreviewMatch(
	local: EnvironmentPromotionState,
	production: EnvironmentPromotionState,
): PromotionDecision {
	if (production === 'behind' || production === 'absent') {
		return { action: 'PROMOTE_PRODUCTION', reasonCode: 'PREVIEW_ALIGNED_PRODUCTION_BEHIND' };
	}
	if (production === 'match' && (local === 'behind' || local === 'absent')) {
		return { action: 'BLOCKED', reasonCode: 'LOCAL_BEHIND_PREVIEW_ALIGNED' };
	}
	return { action: 'UNKNOWN', reasonCode: 'EVIDENCE_INCOMPLETE' };
}

export function decidePromotionAction(input: {
	canonicalAvailable: boolean;
	local: EnvironmentPromotionState;
	preview: EnvironmentPromotionState;
	production: EnvironmentPromotionState;
}): PromotionDecision {
	if (!input.canonicalAvailable) {
		return { action: 'UNKNOWN', reasonCode: 'CANONICAL_UNAVAILABLE' };
	}

	const { local, preview, production } = input;
	const guard = evaluateBlockedGuards(local, preview, production);
	if (guard) return guard;

	if (local === 'match' && preview === 'match' && production === 'match') {
		return { action: 'NONE', reasonCode: 'IN_SYNC' };
	}

	if (preview === 'match') {
		return evaluatePreviewMatch(local, production);
	}

	if (preview === 'behind' || preview === 'absent') {
		return { action: 'PROMOTE_PREVIEW', reasonCode: 'PREVIEW_BEHIND_CANONICAL' };
	}

	return { action: 'UNKNOWN', reasonCode: 'EVIDENCE_INCOMPLETE' };
}
