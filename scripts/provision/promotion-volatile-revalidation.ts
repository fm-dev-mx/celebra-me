import { extractSupabaseProjectRef } from '../db/db-target-config.ts';
import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { OperatorError } from '../db/operator-cli-ux.ts';
import type { InvitationPackageData } from './invitation-package.ts';
import {
	evaluatePromotionSchemaGate,
	type PromotionPreflightReport,
	type PromotionSchemaGateResult,
} from './invitation-promote.ts';
import {
	verifyPreviewApprovalArtifact,
	type PreviewApprovalArtifact,
} from './preview-approval-service.ts';
import {
	verifyPreviewArtifactLive,
	type PreviewLiveVerificationResult,
} from './preview-live-verification.ts';
import { verifyPlanPreconditions } from './invitation-update-plan.ts';

const RETRY_COMMAND = 'pnpm invitation:release';

export interface PromotionVolatileTargetState {
	targetInvitationId: string;
	targetOwnerUserId: string;
	existingDraftUpdatedAt?: string;
	existingPublishedVersion?: number;
}

export interface RevalidatePromotionVolatilePreconditionsInput {
	reviewed: PromotionPreflightReport;
	packageData: InvitationPackageData;
	approvalsDirs?: string[];
	now?: Date;
	getProductionDbUrl?: () => { url: string };
	evaluateSchema?: (input: { dbUrl: string }) => PromotionSchemaGateResult;
	verifyApproval?: (input: {
		packageData: InvitationPackageData;
		planId?: string;
		productionProjectRef: string;
		approvalsDirs?: string[];
		now?: Date;
		liveRecheck: PreviewLiveVerificationResult;
	}) => PreviewApprovalArtifact;
	runLiveVerification?: (
		approval: PreviewApprovalArtifact,
	) => Promise<PreviewLiveVerificationResult>;
	readTargetState?: (input: {
		targetDbUrl: string;
		reviewed: PromotionPreflightReport;
		packageData: InvitationPackageData;
	}) => PromotionVolatileTargetState;
}

function planDrift(cause: string): OperatorError {
	return new OperatorError({
		title: 'El plan de promoción cambió',
		cause,
		code: 'PLAN_DRIFT',
		remediation: [
			'Vuelva a ejecutar pnpm invitation:release para obtener un plan nuevo.',
			'No confirme un plan cuya evidencia volátil ya no coincide.',
		],
		retryCommand: RETRY_COMMAND,
	});
}

function sameSchema(
	reviewed: PromotionSchemaGateResult,
	current: PromotionSchemaGateResult,
): boolean {
	return (
		reviewed.state === current.state &&
		reviewed.migrationHead === current.migrationHead &&
		JSON.stringify(reviewed.pendingMigrations) === JSON.stringify(current.pendingMigrations) &&
		JSON.stringify(reviewed.extraMigrations) === JSON.stringify(current.extraMigrations) &&
		current.compatible
	);
}

function approvalIdentity(approval: PreviewApprovalArtifact): string {
	return JSON.stringify({
		approvalState: approval.approvalState,
		packageHash: approval.packageHash,
		sourceHash: approval.sourceHash,
		metadataHash: approval.metadataHash,
		canonicalProjectionHash: approval.canonicalProjectionHash,
		materializedProjectionHash: approval.materializedProjectionHash,
		assetManifestHash: approval.assetManifestHash,
		planId: approval.planId,
		previewProjectRef: approval.previewProjectRef,
		intendedProductionProjectRef: approval.intendedProductionProjectRef,
		hostedPackageHash: approval.hostedValidation?.packageHash,
		hostedProjectionHash: approval.hostedValidation?.projectionHash,
		hostedPlanId: approval.hostedValidation?.planId,
		hostedPreviewProjectRef: approval.hostedValidation?.previewProjectRef,
		expectedAssetHashes: approval.expectedAssetHashes,
		hostedStorageHashVerification: approval.hostedValidation?.storageHashVerification,
	});
}

function defaultVerifyApproval(input: {
	packageData: InvitationPackageData;
	planId?: string;
	productionProjectRef: string;
	approvalsDirs?: string[];
	now?: Date;
	liveRecheck: PreviewLiveVerificationResult;
}): PreviewApprovalArtifact {
	return verifyPreviewApprovalArtifact(
		{
			packageHash: input.packageData.packageHash,
			sourceHash: input.packageData.sourceHash,
			metadataHash: input.packageData.metadataHash,
			projectionHash: input.packageData.projectionHash,
			assetManifestHash: input.packageData.assetManifestHash,
			planId: input.planId,
			slug: input.packageData.invitation.slug,
			route: `/${input.packageData.invitation.eventType}/${input.packageData.invitation.slug}`,
			intendedProductionProjectRef: input.productionProjectRef,
		},
		{ now: input.now, liveRecheck: input.liveRecheck },
	);
}

function readJsonObject(stdout: string): Record<string, unknown> {
	const raw = stdout.trim();
	if (!raw) throw new Error('Production returned no volatile target state.');
	return JSON.parse(raw) as Record<string, unknown>;
}

function defaultReadTargetState(input: {
	targetDbUrl: string;
	reviewed: PromotionPreflightReport;
	packageData: InvitationPackageData;
}): PromotionVolatileTargetState {
	const plan = input.reviewed.engineResult!.plan;
	const expected = plan.targetPreconditions;
	const targetInvitationId = expected.targetInvitationId;
	const targetOwnerUserId = expected.targetOwnerUserId;
	if (!targetInvitationId || !targetOwnerUserId) {
		throw new Error('The reviewed plan is missing target invitation or owner identity.');
	}
	const plannedCreate = input.reviewed.engineResult!.actions.some(
		(action) => action.resource === 'invitation' && action.action === 'create',
	);
	const plannedOwnerCreate = input.reviewed.engineResult!.actions.some(
		(action) => action.resource === 'auth_host' && action.action === 'create',
	);
	const sql = `
select json_build_object(
  'matches', coalesce((
    select json_agg(t)
    from (
      select id::text, created_by::text, managed_identity_id::text, slug
      from public.invitations
      where archived_at is null
        and (
          id = ${sqlLiteral(targetInvitationId)}::uuid
          or slug = ${sqlLiteral(input.packageData.invitation.slug)}
          or managed_identity_id = ${sqlLiteral(input.packageData.invitation.managedIdentityId)}::uuid
        )
      order by id
    ) t
  ), '[]'::json),
  'draftUpdatedAt', (
    select updated_at::text
    from public.invitation_content_drafts
    where invitation_project_id = ${sqlLiteral(targetInvitationId)}::uuid
      and deleted_at is null
    order by updated_at desc
    limit 1
  ),
  'publishedVersion', (
    select version
    from public.published_invitation_content
    where invitation_project_id = ${sqlLiteral(targetInvitationId)}::uuid
      and deleted_at is null
    order by version desc
    limit 1
  ),
  'ownerExists', exists (
    select 1 from auth.users where id = ${sqlLiteral(targetOwnerUserId)}::uuid
  )
);`;
	const result = runPsql(sql, input.targetDbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	if (result.status !== 0) throw new Error('Production volatile target query failed.');
	const state = readJsonObject(result.stdout);
	const matches = Array.isArray(state.matches)
		? (state.matches as Array<Record<string, unknown>>)
		: [];
	if (plannedCreate) {
		if (matches.length !== 0) {
			throw new Error('A target identity appeared after the create plan was reviewed.');
		}
	} else if (
		matches.length !== 1 ||
		matches[0]?.id !== targetInvitationId ||
		matches[0]?.created_by !== targetOwnerUserId ||
		matches[0]?.managed_identity_id !== input.packageData.invitation.managedIdentityId ||
		matches[0]?.slug !== plan.invitationSlug
	) {
		throw new Error(
			'The active Production invitation identity no longer matches the reviewed plan.',
		);
	}
	if (Boolean(state.ownerExists) === plannedOwnerCreate) {
		throw new Error('The Production Auth owner state changed after review.');
	}
	return {
		targetInvitationId,
		targetOwnerUserId,
		existingDraftUpdatedAt:
			typeof state.draftUpdatedAt === 'string' ? state.draftUpdatedAt : undefined,
		existingPublishedVersion:
			typeof state.publishedVersion === 'number' ? state.publishedVersion : undefined,
	};
}

/**
 * Revalidates only authoritative volatile evidence retained by the reviewed plan.
 * Never rebuilds the package, semantic selection, or full promotion audit.
 *
 * Does not re-probe Storage HTTP fingerprints (`assetStateHash`): those are
 * diagnostic-only and non-deterministic across CDN edges. Asset integrity is
 * enforced by package `assetManifestHash` identity plus engine reconciliation
 * at apply — the same policy as {@link verifyPlanPreconditions}.
 */
// eslint-disable-next-line complexity -- Volatile evidence is checked as one fail-closed pre-authorization boundary.
export async function revalidatePromotionVolatilePreconditions(
	input: RevalidatePromotionVolatilePreconditionsInput,
): Promise<PromotionPreflightReport> {
	try {
		const plan = input.reviewed.engineResult?.plan;
		if (!plan || !input.reviewed.targetDbUrl || !input.reviewed.approval) {
			throw new Error('The reviewed promotion report is incomplete.');
		}
		if (
			input.reviewed.packageHash !== input.packageData.packageHash ||
			input.reviewed.sourceHash !== input.packageData.sourceHash ||
			input.reviewed.projectionHash !== input.packageData.projectionHash ||
			input.reviewed.assetManifestHash !== input.packageData.assetManifestHash ||
			plan.packageHash !== input.packageData.packageHash ||
			plan.sourceHash !== input.packageData.sourceHash
		) {
			throw new Error('The retained package identity changed after review.');
		}

		const targetDbUrl = input.getProductionDbUrl
			? input.getProductionDbUrl().url
			: input.reviewed.targetDbUrl;
		const productionProjectRef = extractSupabaseProjectRef(targetDbUrl);
		if (
			productionProjectRef !== input.reviewed.productionProjectRef ||
			productionProjectRef !== plan.verifiedProjectRef
		) {
			throw new Error('The resolved Production project identity changed after review.');
		}

		const currentSchema = (input.evaluateSchema ?? evaluatePromotionSchemaGate)({
			dbUrl: targetDbUrl,
		});
		if (!sameSchema(input.reviewed.schema, currentSchema)) {
			throw new Error(
				'Production migration history or schema lifecycle changed after review.',
			);
		}

		const liveRecheck = await (input.runLiveVerification ?? verifyPreviewArtifactLive)(
			input.reviewed.approval,
		);
		const currentApproval = (input.verifyApproval ?? defaultVerifyApproval)({
			packageData: input.packageData,
			planId: input.reviewed.approval.planId,
			productionProjectRef,
			approvalsDirs: input.approvalsDirs,
			now: input.now,
			liveRecheck,
		});
		if (approvalIdentity(currentApproval) !== approvalIdentity(input.reviewed.approval)) {
			throw new Error('Preview approval or hosted projection identity changed after review.');
		}

		const targetState = (input.readTargetState ?? defaultReadTargetState)({
			targetDbUrl,
			reviewed: input.reviewed,
			packageData: input.packageData,
		});
		const precondition = verifyPlanPreconditions(plan, {
			sourceHash: input.packageData.sourceHash,
			packageHash: input.packageData.packageHash,
			assetManifestHash: input.packageData.assetManifestHash,
			verifiedProjectRef: productionProjectRef,
			...targetState,
		});
		if (!precondition.ok) throw new Error(precondition.reason);

		return {
			...input.reviewed,
			approval: currentApproval,
			productionProjectRef,
			schema: currentSchema,
			targetDbUrl,
		};
	} catch (error) {
		if (error instanceof OperatorError && error.code === 'PLAN_DRIFT') throw error;
		throw planDrift(error instanceof Error ? error.message : String(error));
	}
}
