import { describe, expect, it } from '@jest/globals';
import {
	diagnoseManagedBaseline,
	diagnoseManagedBaselineError,
	ManagedBaselineError,
	isRecoverableManagedPartial,
	resolveManagedMergeBaseline,
	type ManagedMergeBaselineInput,
} from '../../scripts/provision/managed-merge-baseline.ts';

const projection = { hero: { name: 'Managed' } };
const operationId = '11111111-1111-4111-8111-111111111111';

describe('managed partial resume evidence', () => {
	it('accepts only a matching managed package partial as recoverable', () => {
		const receipt = {
			operationId,
			status: 'partial' as const,
			commandKind: 'managed_invitation_apply',
			origin: 'managed_cli_local',
			inputHashes: { sourceHash: 'source', packageHash: 'package' },
		};
		expect(
			isRecoverableManagedPartial(receipt, {
				sourceHash: 'source',
				packageHash: 'package',
			}),
		).toBe(true);
		expect(
			isRecoverableManagedPartial(receipt, {
				sourceHash: 'source',
				packageHash: 'different',
			}),
		).toBe(false);
	});
});

const completeInput: ManagedMergeBaselineInput = {
	managedProjection: projection,
	releaseSchemaVersion: '2.0.0',
	appliedDraftUpdatedAt: '2026-07-29T15:00:00.000Z',
	appliedOperationId: operationId,
	appliedPublishedVersion: 4,
	appliedPublishedProjectionHash: 'a'.repeat(32),
	currentDraftUpdatedAt: '2026-07-29T15:00:00.000Z',
	currentPublishedVersion: 4,
	currentPublishedProjectionHash: 'a'.repeat(32),
	appliedReceipt: {
		operationId,
		status: 'applied',
		commandKind: 'managed_invitation_apply',
		origin: 'managed_cli_local',
		completedSteps: ['target_verified', 'published', 'provenance_recorded'],
	},
	latestMutationReceipt: {
		operationId,
		status: 'applied',
		commandKind: 'managed_invitation_apply',
		origin: 'managed_cli_local',
		completedSteps: ['target_verified', 'published', 'provenance_recorded'],
	},
};

function expectClassification(
	overrides: Partial<ManagedMergeBaselineInput>,
	classification: ManagedBaselineError['classification'],
): void {
	try {
		resolveManagedMergeBaseline({ ...completeInput, ...overrides });
		throw new Error('Expected managed baseline verification to fail.');
	} catch (error) {
		expect(error).toBeInstanceOf(ManagedBaselineError);
		expect((error as ManagedBaselineError).classification).toBe(classification);
	}
}

describe('resolveManagedMergeBaseline', () => {
	it('accepts a verified current managed baseline', () => {
		expect(resolveManagedMergeBaseline(completeInput)).toBe(projection);
	});

	it('fails closed for missing provenance', () => {
		expectClassification({ managedProjection: null }, 'missing_provenance');
	});

	it.each([{}, { hero: {} }, { hero: { title: '   ' }, sections: [] }])(
		'rejects structurally empty managed projections',
		(managedProjection) => {
			expectClassification({ managedProjection }, 'missing_provenance');
		},
	);

	it.each([
		['operation identity', { appliedOperationId: null }],
		['draft revision', { appliedDraftUpdatedAt: null }],
		['published version', { appliedPublishedVersion: null }],
		['published hash', { appliedPublishedProjectionHash: null }],
	] as const)('fails closed for legacy provenance missing %s', (_name, overrides) => {
		expectClassification(overrides, 'legacy_provenance');
	});

	it('rejects provenance without its exact receipt', () => {
		expectClassification({ appliedReceipt: null }, 'missing_receipt');
		expectClassification(
			{
				appliedReceipt: {
					...completeInput.appliedReceipt!,
					operationId: crypto.randomUUID(),
				},
			},
			'missing_receipt',
		);
	});

	it('rejects a partial previous managed operation', () => {
		expectClassification(
			{
				latestMutationReceipt: {
					operationId: crypto.randomUUID(),
					status: 'partial',
					commandKind: 'managed_invitation_apply',
					origin: 'managed_cli_hosted',
				},
			},
			'partial_previous_operation',
		);
	});

	it('classifies an Editor mutation after the baseline', () => {
		expectClassification(
			{
				currentDraftUpdatedAt: '2026-07-29T15:01:00.000Z',
				latestMutationReceipt: {
					operationId: crypto.randomUUID(),
					status: 'applied',
					commandKind: 'editor_section_update',
					origin: 'editor',
				},
			},
			'editor_mutation_after_baseline',
		);
	});

	it('classifies draft drift without Editor evidence as manual/unmanaged', () => {
		expectClassification(
			{ currentDraftUpdatedAt: '2026-07-29T15:01:00.000Z' },
			'manual_or_unmanaged_drift',
		);
	});

	it.each([
		['version', { currentPublishedVersion: 5 }],
		['projection', { currentPublishedProjectionHash: 'b'.repeat(32) }],
	] as const)('rejects a publication race by %s', (_name, overrides) => {
		expectClassification(overrides, 'publication_after_baseline');
	});

	it('rejects a newer non-final managed operation even when revisions happen to match', () => {
		expectClassification(
			{
				latestMutationReceipt: {
					operationId: crypto.randomUUID(),
					status: 'applied',
					commandKind: 'managed_invitation_apply',
					origin: 'managed_cli_local',
					completedSteps: ['published'],
				},
			},
			'stale_provenance',
		);
	});

	it('does not invalidate a valid baseline for a later not-applied attempt', () => {
		expect(
			resolveManagedMergeBaseline({
				...completeInput,
				latestMutationReceipt: {
					operationId: crypto.randomUUID(),
					status: 'not_applied',
					commandKind: 'managed_invitation_apply',
					origin: 'managed_cli_local',
				},
			}),
		).toBe(projection);
	});
});

describe('managed baseline diagnostics', () => {
	it.each([
		['missing provenance', { managedProjection: null }, 'missing_provenance', true],
		['legacy identity', { appliedOperationId: null }, 'legacy_provenance', true],
		['missing receipt', { appliedReceipt: null }, 'missing_receipt', false],
		['publication race', { currentPublishedVersion: 5 }, 'publication_after_baseline', false],
	] as const)(
		'classifies %s as %s with adoption eligibility %s',
		(_label, overrides, classification, adoptionEligible) => {
			const result = diagnoseManagedBaseline({ ...completeInput, ...overrides }, '2.0.0');
			expect(result.classification).toBe(classification);
			expect(result.adoptionEligible).toBe(adoptionEligible);
			expect(result.disposition).toBe(adoptionEligible ? 'adoptable' : 'blocked');
		},
	);

	it('returns verified for a complete baseline', () => {
		expect(diagnoseManagedBaseline(completeInput, '2.0.0')).toEqual({
			classification: 'verified_current',
			disposition: 'verified',
			adoptionEligible: false,
		});
	});

	it('fails closed for an unexpected error type', () => {
		expect(diagnoseManagedBaselineError(new Error('query failed'))).toEqual({
			classification: 'unknown',
			disposition: 'blocked',
			adoptionEligible: false,
		});
	});
});
