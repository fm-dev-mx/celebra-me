/**
 * promotion-decision.test.ts — Goal 1 promotion matrix
 */
import { describe, expect, it } from '@jest/globals';
import { decidePromotionAction } from '../../scripts/provision/promotion-decision.ts';
import type { EnvironmentPromotionState } from '../../scripts/provision/promotional-fingerprint.ts';

function decide(
	local: EnvironmentPromotionState,
	preview: EnvironmentPromotionState,
	production: EnvironmentPromotionState,
	canonicalAvailable = true,
) {
	return decidePromotionAction({ canonicalAvailable, local, preview, production });
}

describe('decidePromotionAction', () => {
	it('omits synchronized invitations', () => {
		expect(decide('match', 'match', 'match')).toEqual({
			action: 'NONE',
			reasonCode: 'IN_SYNC',
		});
	});

	it('promotes to Preview when Preview is absent or behind with valid ordering', () => {
		expect(decide('match', 'behind', 'behind')).toEqual({
			action: 'PROMOTE_PREVIEW',
			reasonCode: 'PREVIEW_BEHIND_CANONICAL',
		});
		expect(decide('behind', 'absent', 'absent')).toEqual({
			action: 'PROMOTE_PREVIEW',
			reasonCode: 'PREVIEW_BEHIND_CANONICAL',
		});
		expect(decide('match', 'behind', 'unknown')).toEqual({
			action: 'PROMOTE_PREVIEW',
			reasonCode: 'PREVIEW_BEHIND_CANONICAL',
		});
	});

	it('promotes to Production only when Preview matches', () => {
		expect(decide('match', 'match', 'behind')).toEqual({
			action: 'PROMOTE_PRODUCTION',
			reasonCode: 'PREVIEW_ALIGNED_PRODUCTION_BEHIND',
		});
		expect(decide('absent', 'match', 'absent')).toEqual({
			action: 'PROMOTE_PRODUCTION',
			reasonCode: 'PREVIEW_ALIGNED_PRODUCTION_BEHIND',
		});
		expect(decide('unknown', 'match', 'behind')).toEqual({
			action: 'PROMOTE_PRODUCTION',
			reasonCode: 'PREVIEW_ALIGNED_PRODUCTION_BEHIND',
		});
	});

	it('blocks Production aligned while Preview differs', () => {
		expect(decide('match', 'behind', 'match')).toEqual({
			action: 'BLOCKED',
			reasonCode: 'PRODUCTION_AHEAD_OF_PREVIEW',
		});
		expect(decide('behind', 'absent', 'match')).toEqual({
			action: 'BLOCKED',
			reasonCode: 'PRODUCTION_AHEAD_OF_PREVIEW',
		});
	});

	it('blocks Local behind while Preview and Production are aligned', () => {
		expect(decide('behind', 'match', 'match')).toEqual({
			action: 'BLOCKED',
			reasonCode: 'LOCAL_BEHIND_PREVIEW_ALIGNED',
		});
		expect(decide('absent', 'match', 'match')).toEqual({
			action: 'BLOCKED',
			reasonCode: 'LOCAL_BEHIND_PREVIEW_ALIGNED',
		});
	});

	it('blocks identity conflicts and draft divergence', () => {
		expect(decide('conflict', 'match', 'behind')).toEqual({
			action: 'BLOCKED',
			reasonCode: 'IDENTITY_CONFLICT',
		});
		expect(decide('match', 'diverged', 'behind')).toEqual({
			action: 'BLOCKED',
			reasonCode: 'MANAGED_DIVERGENCE',
		});
	});

	it('fails closed to UNKNOWN when authoritative evidence is incomplete', () => {
		expect(decide('match', 'unknown', 'behind')).toEqual({
			action: 'UNKNOWN',
			reasonCode: 'EVIDENCE_INCOMPLETE',
		});
		expect(decide('match', 'match', 'unknown')).toEqual({
			action: 'UNKNOWN',
			reasonCode: 'EVIDENCE_INCOMPLETE',
		});
		expect(decide('match', 'match', 'match', false)).toEqual({
			action: 'UNKNOWN',
			reasonCode: 'CANONICAL_UNAVAILABLE',
		});
	});

	it('never emits PROMOTE_PRODUCTION unless Preview matches', () => {
		const states: EnvironmentPromotionState[] = [
			'match',
			'behind',
			'absent',
			'diverged',
			'conflict',
			'unknown',
		];
		for (const local of states) {
			for (const preview of states) {
				for (const production of states) {
					const result = decide(local, preview, production);
					if (result.action === 'PROMOTE_PRODUCTION') {
						expect(preview).toBe('match');
					}
				}
			}
		}
	});
});
