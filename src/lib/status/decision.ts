/**
 * Pure promotion destination decision. No I/O, approvals, schema, or timestamps.
 * SSOT consumed by CLI, dashboard, and tests.
 */
import type { EnvironmentPromotionState, PromotionAction, PromotionReasonCode } from './types';

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

function decideSelectedTargets(
	input: Record<'local' | 'preview' | 'production', EnvironmentPromotionState>,
	selected: readonly ('local' | 'preview' | 'production')[],
): PromotionDecision {
	const { local, preview, production } = input;
	const states = selected.map((target) => input[target]);
	if (states.includes('conflict')) return { action: 'BLOCKED', reasonCode: 'IDENTITY_CONFLICT' };
	if (states.includes('diverged')) return { action: 'BLOCKED', reasonCode: 'MANAGED_DIVERGENCE' };
	if (states.includes('unknown')) return { action: 'UNKNOWN', reasonCode: 'EVIDENCE_INCOMPLETE' };
	if (states.every((state) => state === 'match'))
		return { action: 'NONE', reasonCode: 'IN_SYNC' };
	if (selected.includes('local') && local !== 'match')
		return { action: 'BLOCKED', reasonCode: 'LOCAL_BEHIND_CANONICAL' };
	if (selected.includes('preview') && preview !== 'match') {
		return selected.includes('production') && production === 'match'
			? { action: 'BLOCKED', reasonCode: 'PRODUCTION_AHEAD_OF_PREVIEW' }
			: { action: 'PROMOTE_PREVIEW', reasonCode: 'PREVIEW_BEHIND_CANONICAL' };
	}
	return selected.includes('preview') && selected.includes('production')
		? { action: 'PROMOTE_PRODUCTION', reasonCode: 'PREVIEW_ALIGNED_PRODUCTION_BEHIND' }
		: { action: 'UNKNOWN', reasonCode: 'EVIDENCE_INCOMPLETE' };
}

export function decidePromotionAction(input: {
	canonicalAvailable: boolean;
	local: EnvironmentPromotionState;
	preview: EnvironmentPromotionState;
	production: EnvironmentPromotionState;
	selectedTargets?: readonly ('local' | 'preview' | 'production')[];
}): PromotionDecision {
	if (!input.canonicalAvailable) {
		return { action: 'UNKNOWN', reasonCode: 'CANONICAL_UNAVAILABLE' };
	}

	const { local, preview, production } = input;
	const selected = input.selectedTargets;
	if (selected?.length === 0) return { action: 'UNKNOWN', reasonCode: 'EVIDENCE_INCOMPLETE' };
	if (selected && selected.length < 3) return decideSelectedTargets(input, selected);
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
