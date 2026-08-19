import type { InvitationPackageData } from './invitation-package.ts';
import {
	runImportEngine,
	type ImportEngineOptions,
	type ImportEngineResult,
} from './invitation-import-engine.ts';
import { assertEngineResult } from './invitation-engine-result.ts';
import {
	verifyPreviewApprovalArtifact,
	type PreviewApprovalArtifact,
} from './preview-approval-service.ts';
import type { PreviewLiveVerificationResult } from './preview-live-verification.ts';
import { findPlaceholderTokensInValue } from '../../src/lib/invitation-preparation/placeholders.ts';
import type { AssetPolicy } from './asset-reconciliation.ts';
import type { ConflictResolutions, UpdateScope } from './semantic-delta.ts';

export type ProductionPreflightErrorCode =
	'MISSING_PREVIEW_APPROVAL' | 'PRODUCTION_CREDENTIALS_UNAVAILABLE' | 'PRODUCTION_PLAN_BLOCKED';

export class ProductionPreflightError extends Error {
	constructor(
		public readonly code: ProductionPreflightErrorCode,
		public readonly safeReason: string,
		public readonly technicalCause: unknown,
	) {
		super(safeReason, { cause: technicalCause });
		this.name = 'ProductionPreflightError';
	}
}

export interface ProductionPreflightResult {
	approval?: PreviewApprovalArtifact;
	engineResult: ImportEngineResult & { plan: NonNullable<ImportEngineResult['plan']> };
	targetDbUrl: string;
}

/**
 * Production is the first managed-release boundary where published content is
 * externally visible. Draft and Local/Preview preparation may retain documented
 * placeholders, but Production must reject them generically.
 */
export function assertNoPendingPublishedPlaceholders(
	content: Record<string, unknown> | undefined,
): void {
	const tokens = findPlaceholderTokensInValue(content);
	if (tokens.length === 0) return;
	throw new ProductionPreflightError(
		'PRODUCTION_PLAN_BLOCKED',
		'La release de Producción contiene datos pendientes de confirmación. Reemplace los placeholders antes de continuar.',
		{ reason: 'published_content_placeholders', tokens },
	);
}

export async function runProductionPreflight(input: {
	packageData: InvitationPackageData;
	ownerUserId?: string;
	approvalsDirs?: string[];
	now?: Date;
	assetPolicy?: AssetPolicy;
	pruneAssets?: boolean;
	updateScope?: UpdateScope;
	conflictResolutions?: ConflictResolutions;
	/** When rebuilding after backup, bind the reviewed plan so create IDs stay stable. */
	plan?: ImportEngineOptions['plan'];
	getProductionDbUrl: () => { url: string };
	runEngine?: (options: ImportEngineOptions) => Promise<ImportEngineResult>;
	liveRecheck?: PreviewLiveVerificationResult;
	/** When true, an unpublished draft whose content diverges from the package is silently
	 *  discarded in favour of the incoming package content. */
	acknowledgeDiscardUnpublishedDraft?: boolean;
}): Promise<ProductionPreflightResult> {
	assertNoPendingPublishedPlaceholders(input.packageData.publishedContent?.content);

	const identity = {
		packageHash: input.packageData.packageHash,
		sourceHash: input.packageData.sourceHash,
		metadataHash: input.packageData.metadataHash,
		projectionHash: input.packageData.projectionHash,
		assetManifestHash: input.packageData.assetManifestHash,
		slug: input.packageData.invitation.slug,
		route: `/${input.packageData.invitation.eventType}/${input.packageData.invitation.slug}`,
	};

	let initialApproval: PreviewApprovalArtifact | undefined;
	try {
		initialApproval = verifyPreviewApprovalArtifact(
			identity,
			input.liveRecheck
				? { now: input.now, liveRecheck: input.liveRecheck }
				: input.approvalsDirs,
			input.liveRecheck ? undefined : input.now,
		);
	} catch {
		initialApproval = undefined;
	}

	let targetDbUrl: string;
	try {
		targetDbUrl = input.getProductionDbUrl().url;
	} catch (error) {
		throw new ProductionPreflightError(
			'PRODUCTION_CREDENTIALS_UNAVAILABLE',
			'Credenciales de Producción no configuradas. Configure el acceso de solo lectura y vuelva a ejecutar el preflight.',
			error,
		);
	}

	try {
		const engineResult = await (input.runEngine ?? runImportEngine)({
			packageData: input.packageData,
			target: 'production',
			targetDbUrl,
			ownerUserId: input.ownerUserId,
			dryRun: true,
			plan: input.plan,
			assetPolicy: input.assetPolicy,
			pruneAssets: input.pruneAssets,
			updateScope: input.updateScope,
			conflictResolutions: input.conflictResolutions,
			acknowledgeDiscardUnpublishedDraft: input.acknowledgeDiscardUnpublishedDraft,
		});
		assertEngineResult(engineResult, undefined, 'Producción', false);
		let finalApproval: PreviewApprovalArtifact | undefined;
		if (initialApproval) {
			try {
				finalApproval = verifyPreviewApprovalArtifact(
					{ ...identity, intendedProductionProjectRef: engineResult.projectRef },
					input.liveRecheck
						? { now: input.now, liveRecheck: input.liveRecheck }
						: input.approvalsDirs,
					input.liveRecheck ? undefined : input.now,
				);
			} catch {
				finalApproval = undefined;
			}
		}
		return { approval: finalApproval, engineResult, targetDbUrl };
	} catch (error) {
		if (error instanceof ProductionPreflightError) throw error;
		const msg = error instanceof Error ? error.message : String(error);
		const safeReason = /bloquead|ausente|derivacio?n|politica|conflict/i.test(msg)
			? msg
			: 'No fue posible verificar de forma segura el proyecto y el estado de Producción. Revise las credenciales, la identidad de Database y Storage, y vuelva a ejecutar el preflight.';
		throw new ProductionPreflightError('PRODUCTION_PLAN_BLOCKED', safeReason, error);
	}
}
