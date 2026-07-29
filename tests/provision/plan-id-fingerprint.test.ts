/**
 * planId fingerprint must include conflict resolutions so a retained plan
 * cannot be applied with a different resolution set.
 */

import { describe, expect, it } from '@jest/globals';
import { computePlanId } from '../../scripts/provision/invitation-update-plan.ts';

const baseParams = {
	slug: 'sample-slug',
	sourceHash: 'source-hash-1',
	targetEnvironment: 'local',
	projectRef: 'persistent-local',
	changes: [
		{
			section: 'envelope',
			entity: 'content',
			label: 'Sobre',
			operation: 'update' as const,
			field: 'tooltipText',
			previousValue: 'before',
			newValue: 'after',
			scope: 'database' as const,
			technicalWriteCount: 1,
		},
	],
	preconditions: {
		sourceHash: 'source-hash-1',
		existingDraftUpdatedAt: '2026-07-28T12:00:00.000Z',
		existingPublishedVersion: 2,
	},
};

describe('computePlanId conflictResolutions fingerprint', () => {
	it('produces distinct planIds for distinct conflictResolutions fingerprints', () => {
		const packagePlanId = computePlanId({
			...baseParams,
			operationFingerprint: JSON.stringify({ 'envelope.tooltipText': 'package' }),
		});
		const targetPlanId = computePlanId({
			...baseParams,
			operationFingerprint: JSON.stringify({ 'envelope.tooltipText': 'target' }),
		});
		const noResolutionsPlanId = computePlanId(baseParams);

		expect(packagePlanId).not.toBe(targetPlanId);
		expect(packagePlanId).not.toBe(noResolutionsPlanId);
		expect(targetPlanId).not.toBe(noResolutionsPlanId);
	});
});
