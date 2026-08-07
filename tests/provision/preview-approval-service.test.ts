import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
	approvePreviewArtifactFromLiveVerification,
	createPendingPreviewApprovalArtifact,
	PREVIEW_APPROVAL_SCHEMA_VERSION,
	verifyPreviewApprovalArtifact,
	writePendingApprovalEvidenceScaffold,
	type PreviewApprovalArtifact,
} from '../../scripts/provision/preview-approval-service.ts';
import type { PreviewLiveVerificationResult } from '../../scripts/provision/preview-live-verification.ts';
import {
	createMemoryPreviewApprovalStore,
	setDefaultPreviewApprovalStoreForTests,
} from '../../scripts/provision/preview-approval-store.ts';

const PACKAGE_HASH = 'a'.repeat(64);
const SOURCE_HASH = 'b'.repeat(64);
const METADATA_HASH = 'c'.repeat(64);
const CANONICAL_PROJECTION_HASH = 'd'.repeat(32);
const MATERIALIZED_PROJECTION_HASH = 'e'.repeat(32);
const ASSET_MANIFEST_HASH = 'f'.repeat(64);
const ASSET_HASH = '1'.repeat(64);
const ASSET_PATH = 'managed/test/hero.webp';
const PLAN_ID = 'preview-plan-1234';
const PREVIEW_PROJECT_REF = 'iwipdvisoyerfdytuhwi';
const REVIEWED_AT = '2026-08-06T12:00:00.000Z';

beforeEach(() => {
	setDefaultPreviewApprovalStoreForTests(createMemoryPreviewApprovalStore());
});

afterEach(() => {
	setDefaultPreviewApprovalStoreForTests(null);
});

function createPending(expectedAssetHashes?: Record<string, string>): PreviewApprovalArtifact {
	return createPendingPreviewApprovalArtifact({
		packageHash: PACKAGE_HASH,
		sourceHash: SOURCE_HASH,
		metadataHash: METADATA_HASH,
		assetManifestHash: ASSET_MANIFEST_HASH,
		planId: PLAN_ID,
		slug: 'test-invitation',
		previewProjectRef: PREVIEW_PROJECT_REF,
		route: '/xv/test-invitation',
		canonicalProjectionHash: CANONICAL_PROJECTION_HASH,
		materializedProjectionHash: MATERIALIZED_PROJECTION_HASH,
		expectedAssetHashes: expectedAssetHashes ?? { [ASSET_PATH]: ASSET_HASH },
	});
}

function liveVerification(
	overrides: Partial<PreviewLiveVerificationResult> = {},
): PreviewLiveVerificationResult {
	return {
		ok: true,
		checklistResults: {
			project: true,
			route: true,
			publication: true,
			provenance: true,
			projection: true,
			storage: true,
		},
		storageHashVerification: { [ASSET_PATH]: ASSET_HASH },
		details: {
			packageHash: PACKAGE_HASH,
			slug: 'test-invitation',
			route: '/xv/test-invitation',
			previewProjectRef: PREVIEW_PROJECT_REF,
			expectedPreviewProjectRef: PREVIEW_PROJECT_REF,
			publicationPresent: true,
			provenancePackageHash: PACKAGE_HASH,
			provenanceProjectionHash: MATERIALIZED_PROJECTION_HASH,
			assetFailures: {},
			errors: [],
		},
		projectionHash: MATERIALIZED_PROJECTION_HASH,
		reviewedAt: REVIEWED_AT,
		...overrides,
	};
}

function approve(live = liveVerification()): PreviewApprovalArtifact {
	return approvePreviewArtifactFromLiveVerification({
		packageHash: PACKAGE_HASH,
		reviewedBy: 'owner@celebra.me',
		live,
	});
}

function productionIdentity(overrides: Record<string, string> = {}) {
	return {
		packageHash: PACKAGE_HASH,
		sourceHash: SOURCE_HASH,
		metadataHash: METADATA_HASH,
		projectionHash: CANONICAL_PROJECTION_HASH,
		assetManifestHash: ASSET_MANIFEST_HASH,
		slug: 'test-invitation',
		route: '/xv/test-invitation',
		...overrides,
	};
}

describe('Preview approval artifact (shared store)', () => {
	it('approves directly from complete live verification without evidence files', () => {
		createPending();
		const approved = approve();
		expect(approved).toMatchObject({
			approvalState: 'approved',
			approvedAt: REVIEWED_AT,
			approvedBy: 'owner@celebra.me',
			hostedValidation: {
				projectionHash: MATERIALIZED_PROJECTION_HASH,
				storageHashVerification: { [ASSET_PATH]: ASSET_HASH },
			},
		});
	});

	it('keeps canonical and Preview-materialized projection hashes distinct', () => {
		const pending = createPending();
		expect(pending.schemaVersion).toBe(PREVIEW_APPROVAL_SCHEMA_VERSION);
		expect(pending.canonicalProjectionHash).toBe(CANONICAL_PROJECTION_HASH);
		expect(pending.materializedProjectionHash).toBe(MATERIALIZED_PROJECTION_HASH);
		expect(pending.canonicalProjectionHash).not.toBe(pending.materializedProjectionHash);

		const approved = approve();
		expect(approved.hostedValidation?.projectionHash).toBe(MATERIALIZED_PROJECTION_HASH);
		expect(
			verifyPreviewApprovalArtifact(productionIdentity(), {
				now: new Date(REVIEWED_AT),
			}).canonicalProjectionHash,
		).toBe(CANONICAL_PROJECTION_HASH);
	});

	it('rejects failed or incomplete live checklists', () => {
		createPending();
		expect(() =>
			approve(
				liveVerification({
					ok: false,
					checklistResults: {
						project: true,
						route: true,
						publication: true,
						provenance: true,
						projection: false,
						storage: true,
					},
				}),
			),
		).toThrow(/incomplete or failed/i);
	});

	it('rejects live results bound to another materialized projection', () => {
		createPending();
		expect(() =>
			approve(liveVerification({ projectionHash: CANONICAL_PROJECTION_HASH })),
		).toThrow(/does not match/i);
	});

	it('rejects incomplete downloaded asset hashes', () => {
		createPending();
		expect(() => approve(liveVerification({ storageHashVerification: {} }))).toThrow(
			/storage verification failed/i,
		);
	});

	it('allows approval when no expected assets exist', () => {
		createPending({});
		const approved = approve(liveVerification({ storageHashVerification: {} }));
		expect(approved.approvalState).toBe('approved');
	});

	it('disables the evidence scaffold happy path', () => {
		createPending();
		expect(() =>
			writePendingApprovalEvidenceScaffold({
				packageHash: PACKAGE_HASH,
				outputPath: 'ignored.json',
			}),
		).toThrow(/EVIDENCE_SCAFFOLD_REMOVED/);
	});

	it('keeps seven-day freshness as fallback when no live recheck is available', () => {
		createPending();
		const approved = approve();
		setDefaultPreviewApprovalStoreForTests(
			createMemoryPreviewApprovalStore([
				{ ...approved, approvedAt: '2026-06-01T00:00:00.000Z' },
			]),
		);
		expect(() =>
			verifyPreviewApprovalArtifact(productionIdentity(), {
				now: new Date('2026-07-23T00:00:00.000Z'),
			}),
		).toThrow(/stale/i);
	});

	it('prefers a successful live recheck over the fallback age limit', () => {
		createPending();
		const approved = approve();
		setDefaultPreviewApprovalStoreForTests(
			createMemoryPreviewApprovalStore([
				{ ...approved, approvedAt: '2026-06-01T00:00:00.000Z' },
			]),
		);
		expect(
			verifyPreviewApprovalArtifact(productionIdentity(), {
				now: new Date(REVIEWED_AT),
				liveRecheck: liveVerification(),
			}).approvalState,
		).toBe('approved');
	});

	it('rejects Production identity intended for another project', () => {
		createPending();
		approve();
		expect(() =>
			verifyPreviewApprovalArtifact(
				{
					...productionIdentity(),
					intendedProductionProjectRef: 'anotherproject',
				},
				{ now: new Date(REVIEWED_AT) },
			),
		).toThrow(/exact release hashes/i);
	});
});
