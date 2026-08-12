/**
 * UI/CLI presentation must follow decidePromotionAction — no parallel rules.
 */
import { describe, expect, it } from '@jest/globals';
import { decidePromotionAction } from '@/lib/status/decision';
import {
	derivePromotionRoute,
	presentPromotionRow,
	uncertaintyNotesForEnvironments,
} from '@/lib/status/presentation';
import type { EnvironmentPromotionState } from '@/lib/status/types';

const STATES: EnvironmentPromotionState[] = [
	'match',
	'behind',
	'absent',
	'diverged',
	'conflict',
	'unknown',
];

describe('presentation parity with decidePromotionAction', () => {
	it('maps every decision to the same action and a matching source/destination', () => {
		for (const local of STATES) {
			for (const preview of STATES) {
				for (const production of STATES) {
					const decision = decidePromotionAction({
						canonicalAvailable: true,
						local,
						preview,
						production,
					});
					const route = derivePromotionRoute(decision.action, decision.reasonCode);
					if (decision.action === 'PROMOTE_PREVIEW') {
						expect(route).toEqual({ source: 'canonical', destination: 'preview' });
					} else if (decision.action === 'PROMOTE_PRODUCTION') {
						expect(route).toEqual({ source: 'preview', destination: 'production' });
					} else if (
						decision.action === 'BLOCKED' &&
						decision.reasonCode === 'LOCAL_BEHIND_PREVIEW_ALIGNED'
					) {
						expect(route).toEqual({ source: 'canonical', destination: 'local' });
					} else {
						expect(route.source).toBeNull();
						expect(route.destination).toBeNull();
					}
				}
			}
		}
	});

	it('keeps BLOCKED reason codes instead of collapsing them', () => {
		expect(
			decidePromotionAction({
				canonicalAvailable: true,
				local: 'match',
				preview: 'behind',
				production: 'match',
			}).reasonCode,
		).toBe('PRODUCTION_AHEAD_OF_PREVIEW');
		expect(
			decidePromotionAction({
				canonicalAvailable: true,
				local: 'match',
				preview: 'diverged',
				production: 'behind',
			}).reasonCode,
		).toBe('MANAGED_DIVERGENCE');
	});

	it('surfaces PRODUCTION UNVERIFIED without changing Preview-first promotion', () => {
		const decision = decidePromotionAction({
			canonicalAvailable: true,
			local: 'match',
			preview: 'behind',
			production: 'unknown',
		});
		expect(decision).toEqual({
			action: 'PROMOTE_PREVIEW',
			reasonCode: 'PREVIEW_BEHIND_CANONICAL',
		});
		const row = presentPromotionRow({
			slug: 'alba-rosa-quinonez',
			title: 'Alba',
			eventType: 'cumple',
			action: 'PROMOTE_PREVIEW',
			reasonCode: 'PREVIEW_BEHIND_CANONICAL',
			environments: { local: 'match', preview: 'behind', production: 'unknown' },
			envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'LIVE' },
		});
		expect(row.uncertaintyNotes).toContain('PRODUCTION UNVERIFIED');
		expect(row.action).toBe('PROMOTE_PREVIEW');
		expect(row.handoff.ownerApplyRequired).toBe(false);
	});

	it('marks Production promotions as OWNER APPLY', () => {
		const decision = decidePromotionAction({
			canonicalAvailable: true,
			local: 'match',
			preview: 'match',
			production: 'behind',
		});
		expect(decision.action).toBe('PROMOTE_PRODUCTION');
		const row = presentPromotionRow({
			slug: 'victoria-y-roberto',
			title: 'Victoria',
			eventType: 'boda',
			action: 'PROMOTE_PRODUCTION',
			reasonCode: 'PREVIEW_ALIGNED_PRODUCTION_BEHIND',
			environments: { local: 'match', preview: 'match', production: 'behind' },
			envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'LIVE' },
		});
		expect(row.action).toBe('PROMOTE_PRODUCTION');
		expect(row.handoff.ownerApplyRequired).toBe(true);
		expect(row.handoff.applyCommand).toContain('--targets production --apply');
		expect(row.handoff.steps).toEqual(['Dry-run', 'OWNER APPLY', 'Verify']);
	});

	it('does not treat unknown as a promotion path', () => {
		expect(uncertaintyNotesForEnvironments({
			local: 'match',
			preview: 'match',
			production: 'unknown',
		})).toEqual(['PRODUCTION UNVERIFIED']);
	});
});
