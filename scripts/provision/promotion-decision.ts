/**
 * Pure promotion destination decision. No I/O, approvals, schema, or timestamps.
 */
import type { EnvironmentPromotionState } from './promotional-fingerprint.ts';

export type PromotionAction =
	| 'PROMOTE_PREVIEW'
	| 'PROMOTE_PRODUCTION'
	| 'BLOCKED'
	| 'UNKNOWN'
	| 'NONE';

export type PromotionReasonCode =
	| 'IN_SYNC'
	| 'EVIDENCE_INCOMPLETE'
	| 'CANONICAL_UNAVAILABLE'
	| 'IDENTITY_CONFLICT'
	| 'MANAGED_DIVERGENCE'
	| 'PRODUCTION_AHEAD_OF_PREVIEW'
	| 'PREVIEW_ALIGNED_PRODUCTION_BEHIND'
	| 'LOCAL_BEHIND_PREVIEW_ALIGNED'
	| 'PREVIEW_BEHIND_CANONICAL';

export interface PromotionDecision {
	action: PromotionAction;
	reasonCode: PromotionReasonCode;
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
	if (local === 'conflict' || preview === 'conflict' || production === 'conflict') {
		return { action: 'BLOCKED', reasonCode: 'IDENTITY_CONFLICT' };
	}
	if (local === 'diverged' || preview === 'diverged' || production === 'diverged') {
		return { action: 'BLOCKED', reasonCode: 'MANAGED_DIVERGENCE' };
	}

	if (production === 'match' && (preview === 'behind' || preview === 'absent')) {
		return { action: 'BLOCKED', reasonCode: 'PRODUCTION_AHEAD_OF_PREVIEW' };
	}

	if (local === 'match' && preview === 'match' && production === 'match') {
		return { action: 'NONE', reasonCode: 'IN_SYNC' };
	}

	if (preview === 'match') {
		if (production === 'behind' || production === 'absent') {
			return { action: 'PROMOTE_PRODUCTION', reasonCode: 'PREVIEW_ALIGNED_PRODUCTION_BEHIND' };
		}
		if (production === 'match') {
			if (local === 'behind' || local === 'absent') {
				return { action: 'BLOCKED', reasonCode: 'LOCAL_BEHIND_PREVIEW_ALIGNED' };
			}
			return { action: 'UNKNOWN', reasonCode: 'EVIDENCE_INCOMPLETE' };
		}
		return { action: 'UNKNOWN', reasonCode: 'EVIDENCE_INCOMPLETE' };
	}

	if (preview === 'behind' || preview === 'absent') {
		return { action: 'PROMOTE_PREVIEW', reasonCode: 'PREVIEW_BEHIND_CANONICAL' };
	}

	return { action: 'UNKNOWN', reasonCode: 'EVIDENCE_INCOMPLETE' };
}
