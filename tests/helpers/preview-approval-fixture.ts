import {
	PREVIEW_APPROVAL_SCHEMA_VERSION,
	type PreviewApprovalArtifact,
} from '../../scripts/provision/preview-approval-service.ts';
import {
	createMemoryPreviewApprovalStore,
	setDefaultPreviewApprovalStoreForTests,
} from '../../scripts/provision/preview-approval-store.ts';

export const packageHash = 'a'.repeat(64);
export const sourceHash = 'b'.repeat(64);
export const metadataHash = 'c'.repeat(64);
export const projectionHash = 'd'.repeat(32);
export const assetManifestHash = 'e'.repeat(64);
export const previewPlanId = 'preview-plan-executed';
export const productionProjectRef = 'productionproject';

/** Approved Preview artifact for the `/xv/fixture` package used by promotion tests. */
export function approval(
	overrides: Partial<PreviewApprovalArtifact> = {},
): PreviewApprovalArtifact {
	return {
		approvalState: 'approved',
		schemaVersion: PREVIEW_APPROVAL_SCHEMA_VERSION,
		packageHash,
		sourceHash,
		metadataHash,
		canonicalProjectionHash: projectionHash,
		materializedProjectionHash: 'e'.repeat(32),
		assetManifestHash,
		planId: previewPlanId,
		slug: 'fixture',
		previewProjectRef: 'iwipdvisoyerfdytuhwi',
		createdAt: '2026-07-23T11:00:00.000Z',
		approvedAt: '2026-07-23T11:30:00.000Z',
		approvedBy: 'qa@celebra-me.test',
		intendedProductionProjectRef: productionProjectRef,
		route: '/xv/fixture',
		expectedAssetHashes: {},
		hostedValidation: {
			packageHash,
			previewProjectRef: 'iwipdvisoyerfdytuhwi',
			route: '/xv/fixture',
			projectionHash: 'e'.repeat(32),
			planId: previewPlanId,
			reviewedAt: '2026-07-23T11:30:00.000Z',
			reviewedBy: 'qa@celebra-me.test',
			intendedProductionProjectRef: productionProjectRef,
			checklistResults: { route: true, database: true, storage: true },
			storageHashVerification: {},
		},
		...overrides,
	};
}

/** Installs an in-memory approval store holding `artifact` as the default store. */
export function writeApproval(artifact = approval()): void {
	setDefaultPreviewApprovalStoreForTests(createMemoryPreviewApprovalStore([artifact]));
}
