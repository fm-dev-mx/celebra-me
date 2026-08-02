/** Three-way delivery classification backed by the managed baseline and shared reconciler. */
import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';
import { isManagedInvitationPath } from '../../src/lib/intake/mutations/ownership.ts';
import {
	ManagedBaselineError,
	resolveVerifiedManagedBaseline,
	type ManagedMergeBaselineInput,
} from '../provision/managed-merge-baseline.ts';
import {
	RELEASE_SCHEMA_VERSION,
	semanticAssetRef,
} from '../provision/normalized-invitation-release.ts';
import { apply3WaySemanticPatch, type SemanticDelta } from '../provision/semantic-delta.ts';
import type {
	InvitationDeliveryScope,
	InvitationLifecycle,
} from '../provision/invitations/invitation-definition.ts';
import type { InvitationDatabaseProjection } from './database-projection.ts';
import {
	resolveCurrentAssetSlots,
	type CurrentSemanticAssetSlot,
} from './current-state-alignment.ts';
import { comparisonToDeliveryStatus } from './overall-status.ts';
import type {
	ComparisonSummary,
	DeliveryStatus,
	ObservabilityEnvironment,
	ObservabilityNextStep,
	ObservabilityReasonCode,
	OperationalStatus,
} from './types.ts';

export const OBSERVABILITY_MAX_SEMANTIC_PATHS = 50;

export interface CanonicalDeliveryInput {
	slug: string;
	lifecycle: InvitationLifecycle;
	deliveryScope: InvitationDeliveryScope;
	packageHash: string;
	managedContent: Record<string, unknown>;
	assets: CurrentSemanticAssetSlot[];
}

export interface DeliveryReconciliationResult {
	comparison: ComparisonSummary;
	operationalStatus: OperationalStatus;
	deliveryStatus: DeliveryStatus;
	issueReasonCode?: ObservabilityReasonCode;
	workReasonCode?: ObservabilityReasonCode;
	nextStep: ObservabilityNextStep;
}

export function summarizeManagedDeltas(
	environment: ObservabilityEnvironment,
	deltas: readonly SemanticDelta[],
): ComparisonSummary {
	const managedDeltas = deltas.filter((delta) => isManagedInvitationPath(delta.path));
	const paths = [...new Set(managedDeltas.map((delta) => delta.path))].sort();
	const sections = new Set(paths.map((path) => path.split(/[.[\]]/)[0]).filter(Boolean));
	const outcome = managedDeltas.some((delta) => delta.status === 'DRIFT')
		? 'DRIFT'
		: managedDeltas.some((delta) => delta.status === 'BLOCKED_BY_SCOPE')
			? 'DELIVERY_SCOPE_BLOCKED'
			: managedDeltas.some((delta) => delta.status === 'APPLY')
				? 'APPLY'
				: 'ALREADY_APPLIED';
	const detailAvailable = paths.length <= OBSERVABILITY_MAX_SEMANTIC_PATHS;
	return {
		environment,
		outcome,
		detailStatus: detailAvailable ? 'AVAILABLE' : 'DETAIL_UNAVAILABLE',
		affectedFieldCount: paths.length,
		affectedSectionCount: sections.size,
		semanticPaths: detailAvailable ? paths : [],
	};
}

function normalizeManagedAssetReferences(
	value: unknown,
	assetKeyById: ReadonlyMap<string, string>,
): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => normalizeManagedAssetReferences(item, assetKeyById));
	}
	if (!value || typeof value !== 'object') return value;
	const record = value as Record<string, unknown>;
	if (record.type === 'uploaded' && typeof record.assetId === 'string') {
		const key = assetKeyById.get(record.assetId);
		if (key) return semanticAssetRef(key);
	}
	return Object.fromEntries(
		Object.entries(record).map(([key, item]) => [
			key,
			normalizeManagedAssetReferences(item, assetKeyById),
		]),
	);
}

function unavailable(
	environment: ObservabilityEnvironment,
	reasonCode: ObservabilityReasonCode,
	nextStep: ObservabilityNextStep,
	detailStatus: ComparisonSummary['detailStatus'] = 'DETAIL_UNAVAILABLE',
): DeliveryReconciliationResult {
	return {
		comparison: {
			environment,
			outcome: 'UNVERIFIED',
			detailStatus,
			affectedFieldCount: 0,
			affectedSectionCount: 0,
			semanticPaths: [],
		},
		operationalStatus: reasonCode === 'DRAFT_INVALID' ? 'BLOCKED' : 'HEALTHY',
		deliveryStatus: 'UNVERIFIED',
		issueReasonCode: reasonCode,
		nextStep,
	};
}

function baselineReason(error: ManagedBaselineError): ObservabilityReasonCode {
	return error.classification === 'incompatible_normalization_version'
		? 'BASELINE_VERSION_INCOMPATIBLE'
		: 'BASELINE_UNAVAILABLE';
}

function applyNextStep(environment: ObservabilityEnvironment): ObservabilityNextStep {
	const steps: Record<ObservabilityEnvironment, ObservabilityNextStep> = {
		local: 'APPLY_LOCAL',
		preview: 'PROMOTE_PREVIEW',
		production: 'PROMOTE_PRODUCTION',
	};
	return steps[environment];
}

function knownResult(comparison: ComparisonSummary): DeliveryReconciliationResult {
	const outcome = comparison.outcome;
	const result: DeliveryReconciliationResult = {
		comparison,
		operationalStatus: 'HEALTHY',
		deliveryStatus: comparisonToDeliveryStatus({ outcome }),
		nextStep: outcome === 'APPLY' ? applyNextStep(comparison.environment) : 'NONE',
	};
	if (outcome === 'APPLY') result.workReasonCode = 'CANONICAL_CHANGE_PENDING';
	if (outcome === 'DRIFT') {
		result.issueReasonCode = 'MANAGED_DRIFT';
		result.nextStep = 'RECONCILE_MANAGED_CONTENT';
	}
	if (outcome === 'DELIVERY_SCOPE_BLOCKED') {
		result.issueReasonCode = 'DELIVERY_SCOPE_BLOCKED';
		result.nextStep = 'RECONCILE_MANAGED_CONTENT';
	}
	return result;
}

/** A complete current-state proof makes historical baseline provenance unnecessary. */
export function directlyAlignedDelivery(
	environment: ObservabilityEnvironment,
): DeliveryReconciliationResult {
	return knownResult({
		environment,
		outcome: 'ALREADY_APPLIED',
		detailStatus: 'AVAILABLE',
		affectedFieldCount: 0,
		affectedSectionCount: 0,
		semanticPaths: [],
	});
}

function baselineInputFor(row: InvitationDatabaseProjection): ManagedMergeBaselineInput {
	return {
		managedProjection: row.provenance.managedProjection,
		hasManagedProjection: row.provenance.hasManagedProjection,
		releaseSchemaVersion: row.provenance.releaseSchemaVersion,
		appliedDraftUpdatedAt: row.provenance.appliedDraftUpdatedAt,
		appliedOperationId: row.provenance.appliedOperationId,
		appliedPublishedVersion: row.provenance.appliedPublishedVersion,
		appliedPublishedProjectionHash: row.provenance.appliedPublishedProjectionHash,
		appliedReceipt: row.provenance.appliedReceipt,
		latestMutationReceipt: row.provenance.latestReceipt,
	};
}

function detailedComparison(input: {
	environment: ObservabilityEnvironment;
	canonical: CanonicalDeliveryInput;
	row: InvitationDatabaseProjection;
	baseline: Record<string, unknown>;
}): ComparisonSummary {
	const slotResolution = resolveCurrentAssetSlots(
		input.canonical.assets,
		input.row.managedAssets,
	);
	const assetKeyById =
		slotResolution.missingKeys.length === 0 && slotResolution.ambiguousKeys.length === 0
			? slotResolution.keyById
			: new Map(
					input.row.managedAssets.flatMap((asset) =>
						asset.key ? [[asset.id, asset.key] as const] : [],
					),
				);
	const previousCanonical = normalizeManagedAssetReferences(
		input.baseline,
		assetKeyById,
	) as Record<string, unknown>;
	const currentTarget = normalizeManagedAssetReferences(
		input.row.draftContent,
		assetKeyById,
	) as Record<string, unknown>;
	const patch = apply3WaySemanticPatch({
		previousCanonical,
		currentCanonical: input.canonical.managedContent,
		currentTarget,
		scope: input.canonical.deliveryScope,
		targetName: `${input.environment}:${input.canonical.slug}`,
		detectTargetOnlyDrift: true,
	});
	return summarizeManagedDeltas(input.environment, patch.deltas);
}

export function reconcileInvitationDelivery(input: {
	environment: ObservabilityEnvironment;
	canonical: CanonicalDeliveryInput;
	row: InvitationDatabaseProjection;
}): DeliveryReconciliationResult {
	const { environment, canonical, row } = input;
	if (row.provenance.definitionSlug && row.provenance.definitionSlug !== canonical.slug) {
		return {
			...unavailable(environment, 'INVITATION_IDENTITY_CONFLICT', 'RESOLVE_IDENTITY'),
			operationalStatus: 'BLOCKED',
		};
	}

	const baselineInput = baselineInputFor(row);
	try {
		resolveVerifiedManagedBaseline(baselineInput, RELEASE_SCHEMA_VERSION, {
			requireProjection: row.detailRequired && !row.detailBudgetExceeded,
		});
	} catch (error) {
		return unavailable(
			environment,
			error instanceof ManagedBaselineError ? baselineReason(error) : 'BASELINE_UNAVAILABLE',
			'VERIFY_BASELINE',
		);
	}

	if (!row.detailRequired) {
		const outcome =
			row.provenance.packageHash === canonical.packageHash ? 'ALREADY_APPLIED' : 'APPLY';
		return knownResult({
			environment,
			outcome,
			detailStatus: 'AVAILABLE',
			affectedFieldCount: 0,
			affectedSectionCount: 0,
			semanticPaths: [],
		});
	}

	if (row.detailBudgetExceeded) {
		const outcome =
			row.provenance.packageHash === input.canonical.packageHash ? 'UNVERIFIED' : 'APPLY';
		const comparison: ComparisonSummary = {
			environment,
			outcome,
			detailStatus: 'DETAIL_UNAVAILABLE',
			affectedFieldCount: 0,
			affectedSectionCount: 0,
			semanticPaths: [],
		};
		return outcome === 'APPLY'
			? knownResult(comparison)
			: unavailable(environment, 'DETAIL_BUDGET_EXCEEDED', 'RECONCILE_MANAGED_CONTENT');
	}
	if (!row.draftContent || !row.provenance.managedProjection) {
		return unavailable(environment, 'DETAIL_BUDGET_EXCEEDED', 'RECONCILE_MANAGED_CONTENT');
	}
	if (!eventContentSchema.safeParse(row.draftContent).success) {
		return unavailable(environment, 'DRAFT_INVALID', 'FIX_CANONICAL_DEFINITION', 'AVAILABLE');
	}

	return knownResult(
		detailedComparison({
			environment,
			canonical,
			row,
			baseline: row.provenance.managedProjection,
		}),
	);
}
