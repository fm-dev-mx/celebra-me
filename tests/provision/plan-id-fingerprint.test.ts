/**
 * planId fingerprint must include conflict resolutions so a retained plan
 * cannot be applied with a different resolution set.
 */

import { describe, expect, it } from '@jest/globals';
import {
	computePlanId,
	formatPlanIdentityMismatch,
	planIdentityChangeKeys,
} from '../../scripts/provision/invitation-update-plan.ts';

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
	it('ignores storage-scope changes and equivalent draft timestamps', () => {
		const contentChange = baseParams.changes[0]!;
		const storageChange = {
			section: 'Storage',
			entity: 'hero',
			label: 'Subida: hero',
			operation: 'upload' as const,
			newValue: 'Upload binary to Cloudinary (120 KB WebP)',
			scope: 'storage' as const,
			technicalWriteCount: 1,
		};
		const postgresTimestamp = '2026-07-28 12:00:00+00';
		const withoutStorage = computePlanId(baseParams);
		const withStorage = computePlanId({
			...baseParams,
			changes: [contentChange, storageChange],
		});
		const postgresDraft = computePlanId({
			...baseParams,
			preconditions: {
				...baseParams.preconditions,
				existingDraftUpdatedAt: postgresTimestamp,
			},
		});
		expect(withStorage).toBe(withoutStorage);
		expect(postgresDraft).toBe(withoutStorage);
		expect(
			computePlanId({
				...baseParams,
				changes: [
					{
						...contentChange,
						newValue: 'changed',
					},
				],
			}),
		).toBe(withoutStorage);
		expect(
			computePlanId({
				...baseParams,
				changes: [
					{
						...contentChange,
						field: 'otherField',
					},
				],
			}),
		).not.toBe(withoutStorage);
	});

	it('treats matching content operation keys as the same plan identity', () => {
		expect(planIdentityChangeKeys(baseParams.changes)).toEqual([
			'database:update:tooltipText',
		]);
		expect(
			formatPlanIdentityMismatch(
				{ functionalChanges: baseParams.changes },
				{ functionalChanges: baseParams.changes },
			),
		).toContain('volatile technical fingerprint');
	});

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
