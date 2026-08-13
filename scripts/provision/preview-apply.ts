import type { InvitationPackageData } from './invitation-package.ts';
import {
	runImportEngine,
	type ImportEngineOptions,
	type ImportEngineResult,
} from './invitation-import-engine.ts';
import { assertEngineResult } from './invitation-engine-result.ts';
import type { OperationalPlan } from './invitation-update-plan.ts';
import { createPendingPreviewApprovalArtifact } from './preview-approval-service.ts';

import type { AssetPolicy } from './asset-reconciliation.ts';
import type { ConflictResolutions, UpdateScope } from './semantic-delta.ts';

export async function runPreviewApply(input: {
	packageData: InvitationPackageData;
	targetDbUrl: string;
	plan: OperationalPlan;
	assetPolicy?: AssetPolicy;
	pruneAssets?: boolean;
	updateScope?: UpdateScope;
	conflictResolutions?: ConflictResolutions;
	acknowledgeDiscardUnpublishedDraft?: boolean;
	rekeyFrom?: string;
	ownerUserId?: string;
	runEngine?: (options: ImportEngineOptions) => Promise<ImportEngineResult>;
	createPendingApproval?: typeof createPendingPreviewApprovalArtifact;
}): Promise<ImportEngineResult & { plan: OperationalPlan }> {
	const result = await (input.runEngine ?? runImportEngine)({
		packageData: input.packageData,
		target: 'preview',
		targetDbUrl: input.targetDbUrl,
		dryRun: false,
		plan: input.plan,
		assetPolicy: input.assetPolicy,
		pruneAssets: input.pruneAssets,
		updateScope: input.updateScope,
		conflictResolutions: input.conflictResolutions,
		acknowledgeDiscardUnpublishedDraft: input.acknowledgeDiscardUnpublishedDraft,
		rekeyFrom: input.rekeyFrom,
		ownerUserId: input.ownerUserId,
	});
	assertEngineResult(result, input.plan.planId, 'Preview', true);
	(input.createPendingApproval ?? createPendingPreviewApprovalArtifact)({
		packageHash: result.packageHash,
		sourceHash: input.packageData.sourceHash,
		metadataHash: input.packageData.metadataHash,
		assetManifestHash: input.packageData.assetManifestHash,
		planId: result.plan.planId,
		slug: result.slug,
		previewProjectRef: result.projectRef,
		route: result.route,
		canonicalProjectionHash: input.packageData.projectionHash,
		materializedProjectionHash: result.projectionHash,
		expectedAssetHashes: result.verifiedAssetHashes,
	});
	return result;
}
