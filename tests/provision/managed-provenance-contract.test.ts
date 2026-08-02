/**
 * managed-provenance-contract.test.ts — Centralized Managed Release Provenance Contract Unit Tests.
 *
 * Verifies that the single shared Phase 2 managed release provenance contract
 * (isVerifiedManagedReleaseProvenance / resolveVerifiedManagedBaseline) rejects invalid,
 * incomplete, or un-receipted provenance evidence, and accepts only complete, receipted provenance.
 */

import {
	isVerifiedManagedReleaseProvenance,
	resolveVerifiedManagedBaseline,
	type ManagedMergeBaselineInput,
	type ManagedBaselineReceiptEvidence,
} from '../../scripts/provision/managed-merge-baseline.ts';
import { RELEASE_SCHEMA_VERSION } from '../../scripts/provision/normalized-invitation-release.ts';

describe('Centralized Managed Release Provenance Contract', () => {
	const validReceipt: ManagedBaselineReceiptEvidence = {
		operationId: '11111111-1111-4111-8111-111111111111',
		status: 'applied',
		commandKind: 'managed_invitation_apply',
		origin: 'managed_cli_hosted',
		completedSteps: ['target_verified', 'provenance_recorded'],
	};

	const validProvenanceInput: ManagedMergeBaselineInput = {
		releaseSchemaVersion: RELEASE_SCHEMA_VERSION,
		managedProjection: { title: 'Alba' },
		appliedDraftUpdatedAt: '2026-08-01T00:00:00.000Z',
		appliedOperationId: '11111111-1111-4111-8111-111111111111',
		appliedPublishedVersion: 1,
		appliedPublishedProjectionHash: 'b'.repeat(64),
		appliedReceipt: validReceipt,
		latestMutationReceipt: validReceipt,
	};

	it('accepts complete valid provenance with matching applied receipt and provenance_recorded step', () => {
		expect(isVerifiedManagedReleaseProvenance(validProvenanceInput)).toBe(true);

		const result = resolveVerifiedManagedBaseline(
			validProvenanceInput,
			RELEASE_SCHEMA_VERSION,
			{ requireProjection: false },
		);
		expect(result).toEqual({ normalizationVersion: RELEASE_SCHEMA_VERSION });
	});

	it('rejects missing provenance (null or empty fields)', () => {
		const emptyInput: ManagedMergeBaselineInput = {
			releaseSchemaVersion: null,
			managedProjection: null,
			appliedDraftUpdatedAt: null,
			appliedOperationId: null,
			appliedPublishedVersion: null,
			appliedPublishedProjectionHash: null,
			appliedReceipt: null,
		};

		expect(isVerifiedManagedReleaseProvenance(emptyInput)).toBe(false);
		expect(() =>
			resolveVerifiedManagedBaseline(emptyInput, RELEASE_SCHEMA_VERSION, {
				requireProjection: false,
			}),
		).toThrow('missing_provenance');
	});

	it('rejects incomplete identity (missing appliedOperationId or appliedPublishedVersion)', () => {
		const incompleteInput: ManagedMergeBaselineInput = {
			...validProvenanceInput,
			appliedOperationId: null,
		};

		expect(isVerifiedManagedReleaseProvenance(incompleteInput)).toBe(false);
		expect(() =>
			resolveVerifiedManagedBaseline(incompleteInput, RELEASE_SCHEMA_VERSION, {
				requireProjection: false,
			}),
		).toThrow('legacy_provenance');
	});

	it('rejects wrong or outdated release schema version', () => {
		const wrongVersionInput: ManagedMergeBaselineInput = {
			...validProvenanceInput,
			releaseSchemaVersion: '2025-01-01.v0',
		};

		expect(isVerifiedManagedReleaseProvenance(wrongVersionInput)).toBe(false);
		expect(() =>
			resolveVerifiedManagedBaseline(wrongVersionInput, RELEASE_SCHEMA_VERSION, {
				requireProjection: false,
			}),
		).toThrow('incompatible_normalization_version');
	});

	it('rejects missing receipt for applied operation', () => {
		const missingReceiptInput: ManagedMergeBaselineInput = {
			...validProvenanceInput,
			appliedReceipt: null,
		};

		expect(isVerifiedManagedReleaseProvenance(missingReceiptInput)).toBe(false);
		expect(() =>
			resolveVerifiedManagedBaseline(missingReceiptInput, RELEASE_SCHEMA_VERSION, {
				requireProjection: false,
			}),
		).toThrow('missing_receipt');
	});

	it('rejects receipt missing the provenance_recorded completed step', () => {
		const missingStepReceiptInput: ManagedMergeBaselineInput = {
			...validProvenanceInput,
			appliedReceipt: {
				...validReceipt,
				completedSteps: ['target_verified'], // missing 'provenance_recorded'
			},
		};

		expect(isVerifiedManagedReleaseProvenance(missingStepReceiptInput)).toBe(false);
		expect(() =>
			resolveVerifiedManagedBaseline(missingStepReceiptInput, RELEASE_SCHEMA_VERSION, {
				requireProjection: false,
			}),
		).toThrow('stale_provenance');
	});

	it('rejects receipt with non-applied status (status = not_applied)', () => {
		const unappliedReceiptInput: ManagedMergeBaselineInput = {
			...validProvenanceInput,
			appliedReceipt: {
				...validReceipt,
				status: 'not_applied',
			},
		};

		expect(isVerifiedManagedReleaseProvenance(unappliedReceiptInput)).toBe(false);
		expect(() =>
			resolveVerifiedManagedBaseline(unappliedReceiptInput, RELEASE_SCHEMA_VERSION, {
				requireProjection: false,
			}),
		).toThrow('stale_provenance');
	});
});
