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

	it('surfaces PRODUCTION UNKNOWN without changing Preview-first promotion', () => {
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
		expect(row.uncertaintyNotes).toContain('PRODUCTION UNKNOWN');
		expect(row.action).toBe('PROMOTE_PREVIEW');
		expect(row.handoff.ownerApplyRequired).toBe(false);
	});

	it('marks Production promotions as OWNER APPLY with separate dry-run and apply commands', () => {
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
		expect(row.handoff.dryRunStepType).toBe('Verify');
		expect(row.handoff.applyStepType).toBe('Apply');
		expect(row.handoff.ownerApplyRequired).toBe(true);
		expect(row.handoff.dryRunCommand).toContain('--targets production --dry-run');
		expect(row.handoff.applyCommand).toContain('--targets production --apply');
		expect(row.handoff.steps).toEqual(['Verify dry-run', 'OWNER APPLY in TTY', 'Verify match']);
	});

	it('does not treat unknown as a promotion path', () => {
		expect(uncertaintyNotesForEnvironments({
			local: 'match',
			preview: 'match',
			production: 'unknown',
		})).toEqual(['PRODUCTION UNKNOWN']);
	});

	it('attaches existing diagnostic commands to BLOCKED and UNKNOWN handoffs without self-loops', () => {
		const identity = presentPromotionRow({
			slug: 'demo',
			title: 'Demo',
			eventType: 'boda',
			action: 'BLOCKED',
			reasonCode: 'IDENTITY_CONFLICT',
			environments: { local: 'conflict', preview: 'match', production: 'match' },
			envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'LIVE' },
		});
		expect(identity.handoff.dryRunStepType).toBe('Diagnose');
		expect(identity.handoff.dryRunCommand).toBe(
			'pnpm invitation:diagnose-identity -- --target local',
		);
		expect(identity.handoff.steps).toEqual(['Diagnose identity conflict', 'Do not promote']);

		const unknownUnprobed = presentPromotionRow({
			slug: 'demo',
			title: 'Demo',
			eventType: 'boda',
			action: 'UNKNOWN',
			reasonCode: 'EVIDENCE_INCOMPLETE',
			environments: { local: 'unknown', preview: 'match', production: 'match' },
			envEvidence: { local: 'UNVERIFIED', preview: 'LIVE', production: 'LIVE' },
		});
		expect(unknownUnprobed.handoff.dryRunStepType).toBe('Diagnose');
		expect(unknownUnprobed.handoff.dryRunCommand).toBe('pnpm dbs');
		expect(unknownUnprobed.handoff.dryRunCommand).not.toContain('db:availability:verify');
		expect(unknownUnprobed.handoff.optionalDiagnosticCommand).toBeNull();
		expect(unknownUnprobed.handoff.applyCommand).toBeNull();

		const unknownLiveFingerprint = presentPromotionRow({
			slug: 'demo',
			title: 'Demo',
			eventType: 'boda',
			action: 'UNKNOWN',
			reasonCode: 'EVIDENCE_INCOMPLETE',
			environments: { local: 'unknown', preview: 'match', production: 'match' },
			envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'LIVE' },
		});
		expect(unknownLiveFingerprint.handoff.dryRunCommand).toBeNull();
		expect(unknownLiveFingerprint.handoff.optionalDiagnosticCommand).toBe(
			'pnpm dbs --diagnostics',
		);
		expect(unknownLiveFingerprint.handoff.applyCommand).toBeNull();

		const canonicalUnavailable = presentPromotionRow({
			slug: 'demo',
			title: 'Demo',
			eventType: 'boda',
			action: 'UNKNOWN',
			reasonCode: 'CANONICAL_UNAVAILABLE',
			environments: { local: 'match', preview: 'match', production: 'match' },
			envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'LIVE' },
		});
		expect(canonicalUnavailable.handoff.dryRunStepType).toBe('Manual/HITL');
		expect(canonicalUnavailable.handoff.dryRunCommand).toBeNull();
		expect(canonicalUnavailable.handoff.applyCommand).toBeNull();
	});
});
