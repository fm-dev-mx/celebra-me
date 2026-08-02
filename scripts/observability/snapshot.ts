/** Snapshot v3 assembly: read-only evidence collection plus deterministic aggregation. */
import type { InvitationLifecycle } from '../provision/invitations/invitation-definition.ts';
import type { EnvironmentDatabaseProjection, MigrationProjection } from './database-projection.ts';
import { collectSnapshotEvidence } from './snapshot-evidence.ts';
import {
	directlyAlignedDelivery,
	reconcileInvitationDelivery,
	type CanonicalDeliveryInput,
	type DeliveryReconciliationResult,
} from './delivery-reconciliation.ts';
import {
	proveDirectCurrentAlignment,
	type CurrentStateCanonical,
} from './current-state-alignment.ts';
import { evaluateAssetSignals } from './asset-signals.ts';
import {
	aggregateDeliveryStatus,
	aggregateOperationalStatus,
	comparisonToDeliveryStatus,
} from './overall-status.ts';
import { finalizeObservabilitySnapshot } from './public-snapshot.ts';
import { buildReportingEvidence } from './reporting-parity.ts';
import type {
	ComparisonSummary,
	DeliveryStatus,
	EnvironmentCoverage,
	EnvironmentSummary,
	InvitationSummary,
	ObservabilityEnvironment,
	ObservabilityNextStep,
	ObservabilityReasonCode,
	ObservabilitySignal,
	ObservabilitySnapshot,
	ObservabilitySummaryPayload,
	OperationalStatus,
} from './types.ts';
export type ObservabilityProbeScope = 'local' | 'all';
const ENVIRONMENTS: readonly ObservabilityEnvironment[] = ['local', 'preview', 'production'];
const REFRESH_TTL_MS = 60_000;
export interface CanonicalObservation extends CanonicalDeliveryInput, CurrentStateCanonical {}
export interface SnapshotEvidence {
	generatedAt: string;
	probeScope: ObservabilityProbeScope;
	canonical: CanonicalObservation[];
	canonicalFailures: Array<{ slug: string; lifecycle: InvitationLifecycle }>;
	legacy: Array<{ slug: string; remoteParity: 'required' | 'excluded' }>;
	projections: Record<ObservabilityEnvironment, EnvironmentDatabaseProjection>;
	migrations: Record<ObservabilityEnvironment, MigrationProjection>;
}
function emptyComparison(
	environment: ObservabilityEnvironment,
	outcome: ComparisonSummary['outcome'] = 'UNVERIFIED',
): ComparisonSummary {
	return {
		environment,
		outcome,
		detailStatus: outcome === 'UNVERIFIED' ? 'DETAIL_UNAVAILABLE' : 'AVAILABLE',
		affectedFieldCount: 0,
		affectedSectionCount: 0,
		semanticPaths: [],
	};
}
function signal(input: {
	impact: ObservabilitySignal['impact'];
	reasonCode: ObservabilityReasonCode;
	nextStep: ObservabilityNextStep;
	operationalStatus?: OperationalStatus;
	deliveryStatus?: DeliveryStatus;
	environment?: ObservabilityEnvironment;
	slug?: string;
	lifecycle?: InvitationLifecycle;
	comparison?: ComparisonSummary;
}): ObservabilitySignal {
	return {
		impact: input.impact,
		reasonCode: input.reasonCode,
		nextStep: input.nextStep,
		operationalStatus: input.operationalStatus ?? 'HEALTHY',
		deliveryStatus: input.deliveryStatus ?? 'ALIGNED',
		detailStatus: input.comparison?.detailStatus ?? 'AVAILABLE',
		affectedFieldCount: input.comparison?.affectedFieldCount ?? 0,
		affectedSectionCount: input.comparison?.affectedSectionCount ?? 0,
		semanticPaths: input.comparison?.semanticPaths ?? [],
		...(input.environment ? { environment: input.environment } : {}),
		...(input.slug ? { slug: input.slug } : {}),
		...(input.lifecycle ? { lifecycle: input.lifecycle } : {}),
		...(input.comparison ? { comparisonOutcome: input.comparison.outcome } : {}),
	};
}
function expectedTarget(environment: ObservabilityEnvironment): string {
	return environment === 'local' ? 'persistent-local' : environment;
}
function coverageFor(
	environment: ObservabilityEnvironment,
	probeScope: ObservabilityProbeScope,
	projection: EnvironmentDatabaseProjection,
	migration: MigrationProjection,
): EnvironmentCoverage {
	if (probeScope === 'local' && environment !== 'local') {
		return {
			environment,
			status: 'NOT_PROBED',
			reasonCode: 'ENVIRONMENT_UNAVAILABLE',
		};
	}
	if (!projection.reachable) {
		return { environment, status: 'UNAVAILABLE', reasonCode: 'ENVIRONMENT_UNAVAILABLE' };
	}
	if (!migration.available) {
		return { environment, status: 'UNAVAILABLE', reasonCode: 'SCHEMA_UNAVAILABLE' };
	}
	return { environment, status: 'AVAILABLE' };
}
function signalFromReconciliation(input: {
	result: DeliveryReconciliationResult;
	environment: ObservabilityEnvironment;
	slug: string;
	lifecycle: InvitationLifecycle;
	work: boolean;
}): ObservabilitySignal | null {
	const reasonCode = input.work ? input.result.workReasonCode : input.result.issueReasonCode;
	if (!reasonCode) return null;
	return signal({
		impact:
			reasonCode === 'DRAFT_INVALID' || reasonCode === 'INVITATION_IDENTITY_CONFLICT'
				? 'OPERATIONAL'
				: 'DELIVERY',
		reasonCode,
		nextStep: input.result.nextStep,
		operationalStatus: input.result.operationalStatus,
		deliveryStatus: input.result.deliveryStatus,
		environment: input.environment,
		slug: input.slug,
		lifecycle: input.lifecycle,
		comparison: input.result.comparison,
	});
}
function environmentBaseSignals(
	evidence: SnapshotEvidence,
	coverage: readonly EnvironmentCoverage[],
): ObservabilitySignal[] {
	const issues: ObservabilitySignal[] = [];
	for (const environment of ENVIRONMENTS) {
		const coverageRow = coverage.find((item) => item.environment === environment)!;
		if (coverageRow.status === 'NOT_PROBED') continue;
		const projection = evidence.projections[environment];
		const migration = evidence.migrations[environment];
		if (coverageRow.status === 'UNAVAILABLE') {
			issues.push(
				signal({
					impact: 'OPERATIONAL',
					reasonCode: coverageRow.reasonCode!,
					nextStep:
						coverageRow.reasonCode === 'SCHEMA_UNAVAILABLE'
							? 'AUDIT_SCHEMA'
							: 'RETRY_PROBE',
					operationalStatus: 'UNVERIFIED',
					deliveryStatus: 'UNVERIFIED',
					environment,
				}),
			);
		}
		if (
			projection.reachable &&
			projection.targetClassification !== expectedTarget(environment)
		) {
			issues.push(
				signal({
					impact: 'OPERATIONAL',
					reasonCode: 'ENVIRONMENT_IDENTITY_CONFLICT',
					nextStep: 'RESOLVE_IDENTITY',
					operationalStatus: 'BLOCKED',
					deliveryStatus: 'UNVERIFIED',
					environment,
				}),
			);
		}
		if (projection.identityConflictsCount > 0) {
			issues.push(
				signal({
					impact: 'OPERATIONAL',
					reasonCode: 'AUTHORITATIVE_COUNT_MISMATCH',
					nextStep: 'RESOLVE_IDENTITY',
					operationalStatus: 'BLOCKED',
					deliveryStatus: 'UNVERIFIED',
					environment,
				}),
			);
		}
		if (migration.available && migration.schemaLifecycle !== 'CURRENT') {
			const reasonCode =
				migration.schemaLifecycle === 'SCHEMA_DRIFT' ? 'SCHEMA_DRIFT' : 'SCHEMA_BEHIND';
			issues.push(
				signal({
					impact: 'OPERATIONAL',
					reasonCode,
					nextStep: 'AUDIT_SCHEMA',
					operationalStatus: reasonCode === 'SCHEMA_DRIFT' ? 'BLOCKED' : 'ATTENTION',
					environment,
				}),
			);
		}
	}
	return issues;
}
function rowsFor(
	projection: EnvironmentDatabaseProjection,
	slug: string,
): EnvironmentDatabaseProjection['rows'] {
	return projection.rows.filter((row) => row.slug === slug);
}
interface CanonicalEvaluationState {
	issues: ObservabilitySignal[];
	workItems: ObservabilitySignal[];
	comparisons: ComparisonSummary[];
	operationalStatuses: OperationalStatus[];
	deliveryStatuses: DeliveryStatus[];
}
function appendPresenceSignals(input: {
	canonical: CanonicalObservation;
	coverage: readonly EnvironmentCoverage[];
	rowsByEnvironment: ReadonlyMap<ObservabilityEnvironment, EnvironmentDatabaseProjection['rows']>;
	state: CanonicalEvaluationState;
}): void {
	const allCovered = input.coverage.every((item) => item.status === 'AVAILABLE');
	const absentEverywhere =
		allCovered &&
		ENVIRONMENTS.every(
			(environment) => (input.rowsByEnvironment.get(environment) ?? []).length === 0,
		);
	if (absentEverywhere) {
		input.state.comparisons.length = 0;
		input.state.operationalStatuses.length = 0;
		input.state.deliveryStatuses.length = 0;
		if (input.canonical.lifecycle === 'in_progress') {
			for (const environment of ENVIRONMENTS) {
				input.state.comparisons.push(emptyComparison(environment, 'APPLY'));
				input.state.deliveryStatuses.push('IN_PROGRESS');
			}
			input.state.operationalStatuses.push('HEALTHY');
			input.state.workItems.push(
				signal({
					impact: 'DELIVERY',
					reasonCode: 'VALID_DRAFT_PENDING',
					nextStep: 'APPLY_LOCAL',
					deliveryStatus: 'IN_PROGRESS',
					slug: input.canonical.slug,
					lifecycle: input.canonical.lifecycle,
				}),
			);
			return;
		}
		for (const environment of ENVIRONMENTS) {
			input.state.comparisons.push(emptyComparison(environment));
		}
		input.state.operationalStatuses.push('BLOCKED');
		input.state.deliveryStatuses.push('UNVERIFIED');
		input.state.issues.push(
			signal({
				impact: 'OPERATIONAL',
				reasonCode: 'INVITATION_MISSING',
				nextStep: 'VERIFY_BASELINE',
				operationalStatus: 'BLOCKED',
				deliveryStatus: 'UNVERIFIED',
				slug: input.canonical.slug,
				lifecycle: input.canonical.lifecycle,
			}),
		);
		return;
	}

	for (const environment of ENVIRONMENTS) {
		const coverageRow = input.coverage.find((item) => item.environment === environment)!;
		if (coverageRow.status !== 'AVAILABLE') continue;
		if ((input.rowsByEnvironment.get(environment) ?? []).length > 0) continue;
		const inProgress = input.canonical.lifecycle === 'in_progress';
		const comparison = emptyComparison(environment, inProgress ? 'APPLY' : 'UNVERIFIED');
		input.state.comparisons.push(comparison);
		if (inProgress) {
			input.state.deliveryStatuses.push('IN_PROGRESS');
			continue;
		}
		input.state.operationalStatuses.push('BLOCKED');
		input.state.deliveryStatuses.push('UNVERIFIED');
		input.state.issues.push(
			signal({
				impact: 'OPERATIONAL',
				reasonCode: 'INVITATION_MISSING',
				nextStep: 'VERIFY_BASELINE',
				operationalStatus: 'BLOCKED',
				deliveryStatus: 'UNVERIFIED',
				environment,
				slug: input.canonical.slug,
				lifecycle: input.canonical.lifecycle,
				comparison,
			}),
		);
	}
}
function resolveDeliveryReasonCode(
	hasValidDraftPending: boolean,
	state: CanonicalEvaluationState,
): ObservabilityReasonCode {
	if (hasValidDraftPending) return 'VALID_DRAFT_PENDING';
	const isPartial =
		state.comparisons.some((c) => c.outcome === 'ALREADY_APPLIED') &&
		state.comparisons.some((c) => c.outcome === 'APPLY');
	return isPartial ? 'PARTIAL_PROMOTION' : 'CANONICAL_CHANGE_PENDING';
}

function resolveNextStep(env: (typeof ENVIRONMENTS)[number]): ObservabilityNextStep {
	if (env === 'local') return 'APPLY_LOCAL';
	if (env === 'preview') return 'PROMOTE_PREVIEW';
	return 'PROMOTE_PRODUCTION';
}

function appendPreviewVerificationSignal(
	canonical: CanonicalObservation,
	state: CanonicalEvaluationState,
	coverage: readonly EnvironmentCoverage[],
	byEnvironment: ReadonlyMap<ObservabilityEnvironment, ComparisonSummary>,
	previewOutcome: ComparisonSummary['outcome'] | undefined,
): boolean {
	const previewCoverage = coverage.find((item) => item.environment === 'preview');
	if (
		previewCoverage?.status === 'NOT_PROBED' ||
		(previewCoverage?.status === 'AVAILABLE' && previewOutcome !== 'UNVERIFIED')
	) {
		return false;
	}
	for (let i = state.workItems.length - 1; i >= 0; i--) {
		if (
			[
				'CANONICAL_CHANGE_PENDING',
				'PARTIAL_PROMOTION',
				'VALID_DRAFT_PENDING',
				'PREVIEW_VERIFICATION_REQUIRED',
			].includes(state.workItems[i]!.reasonCode)
		) {
			state.workItems.splice(i, 1);
		}
	}
	state.workItems.push(
		signal({
			impact: 'DELIVERY',
			reasonCode: 'PREVIEW_VERIFICATION_REQUIRED',
			nextStep: 'VERIFY_PREVIEW',
			deliveryStatus: 'UNVERIFIED',
			environment: 'preview',
			slug: canonical.slug,
			lifecycle: canonical.lifecycle,
			comparison: byEnvironment.get('preview'),
		}),
	);
	state.deliveryStatuses.push('UNVERIFIED');
	return true;
}

function appendLifecycleSignals(
	canonical: CanonicalObservation,
	state: CanonicalEvaluationState,
	coverage: readonly EnvironmentCoverage[],
): void {
	const byEnvironment = new Map(
		state.comparisons.map((comparison) => [comparison.environment, comparison]),
	);
	const localOutcome = byEnvironment.get('local')?.outcome;
	const previewOutcome = byEnvironment.get('preview')?.outcome;
	const productionOutcome = byEnvironment.get('production')?.outcome;
	const previewAligned = previewOutcome === 'ALREADY_APPLIED';
	const productionAligned = productionOutcome === 'ALREADY_APPLIED';
	const previewAheadOfLocal = previewAligned && localOutcome === 'APPLY';
	const productionAheadOfPreview = productionAligned && previewOutcome === 'APPLY';
	if (previewAheadOfLocal || productionAheadOfPreview) {
		state.issues.push(
			signal({
				impact: 'DELIVERY',
				reasonCode: 'LIFECYCLE_SEQUENCE_INVALID',
				nextStep: 'RECONCILE_MANAGED_CONTENT',
				deliveryStatus: 'ACTION_REQUIRED',
				environment: previewAheadOfLocal ? 'preview' : 'production',
				slug: canonical.slug,
				lifecycle: canonical.lifecycle,
			}),
		);
		state.deliveryStatuses.push('ACTION_REQUIRED');
		return;
	}

	if (appendPreviewVerificationSignal(canonical, state, coverage, byEnvironment, previewOutcome))
		return;

	const hasValidDraftPending = state.workItems.some(
		(w) => w.reasonCode === 'VALID_DRAFT_PENDING',
	);

	const deliveryWorkIndices: number[] = [];
	for (let i = 0; i < state.workItems.length; i++) {
		const item = state.workItems[i]!;
		if (
			item.reasonCode === 'CANONICAL_CHANGE_PENDING' ||
			item.reasonCode === 'PARTIAL_PROMOTION' ||
			item.reasonCode === 'VALID_DRAFT_PENDING'
		) {
			deliveryWorkIndices.push(i);
		}
	}
	for (let i = deliveryWorkIndices.length - 1; i >= 0; i--) {
		state.workItems.splice(deliveryWorkIndices[i]!, 1);
	}

	const actionableEnv = ENVIRONMENTS.find((env) => {
		const outcome = byEnvironment.get(env)?.outcome;
		return outcome === 'APPLY' || outcome === 'DRIFT';
	});

	if (actionableEnv) {
		const reasonCode = resolveDeliveryReasonCode(hasValidDraftPending, state);
		const nextStep = resolveNextStep(actionableEnv);
		state.workItems.push(
			signal({
				impact: 'DELIVERY',
				reasonCode,
				nextStep,
				deliveryStatus: 'IN_PROGRESS',
				environment: actionableEnv,
				slug: canonical.slug,
				lifecycle: canonical.lifecycle,
				comparison: byEnvironment.get(actionableEnv),
			}),
		);
	}

	if (canonical.lifecycle !== 'in_progress' || !productionAligned) return;
	state.issues.push(
		signal({
			impact: 'DELIVERY',
			reasonCode: 'LIFECYCLE_METADATA_STALE',
			nextStep: 'UPDATE_LIFECYCLE_METADATA',
			deliveryStatus: 'ACTION_REQUIRED',
			slug: canonical.slug,
			lifecycle: canonical.lifecycle,
		}),
	);
	state.deliveryStatuses.push('ACTION_REQUIRED');
}
function evaluateCanonicalInvitation(
	canonical: CanonicalObservation,
	evidence: SnapshotEvidence,
	coverage: readonly EnvironmentCoverage[],
): {
	summary: InvitationSummary;
	issues: ObservabilitySignal[];
	workItems: ObservabilitySignal[];
} {
	const issues: ObservabilitySignal[] = [];
	const workItems: ObservabilitySignal[] = [];
	const comparisons: ComparisonSummary[] = [];
	const operationalStatuses: OperationalStatus[] = [];
	const deliveryStatuses: DeliveryStatus[] = [];
	const state: CanonicalEvaluationState = {
		issues,
		workItems,
		comparisons,
		operationalStatuses,
		deliveryStatuses,
	};
	const rowsByEnvironment = new Map<
		ObservabilityEnvironment,
		EnvironmentDatabaseProjection['rows']
	>();
	for (const environment of ENVIRONMENTS) {
		rowsByEnvironment.set(
			environment,
			rowsFor(evidence.projections[environment], canonical.slug),
		);
	}
	const directRows = ENVIRONMENTS.flatMap(
		(environment) => rowsByEnvironment.get(environment) ?? [],
	);
	const directlyAligned =
		coverage.every((item) => item.status === 'AVAILABLE') &&
		directRows.length === ENVIRONMENTS.length &&
		ENVIRONMENTS.every(
			(environment) => (rowsByEnvironment.get(environment) ?? []).length === 1,
		) &&
		proveDirectCurrentAlignment({ canonical, rows: directRows });

	for (const environment of ENVIRONMENTS) {
		const coverageRow = coverage.find((item) => item.environment === environment)!;
		if (coverageRow.status === 'NOT_PROBED') continue;
		const rows = rowsByEnvironment.get(environment) ?? [];
		if (coverageRow.status !== 'AVAILABLE') {
			comparisons.push(emptyComparison(environment));
			operationalStatuses.push('UNVERIFIED');
			deliveryStatuses.push('UNVERIFIED');
			continue;
		}
		if (rows.length > 1) {
			const comparison = emptyComparison(environment);
			comparisons.push(comparison);
			operationalStatuses.push('BLOCKED');
			deliveryStatuses.push('UNVERIFIED');
			issues.push(
				signal({
					impact: 'OPERATIONAL',
					reasonCode: 'INVITATION_IDENTITY_CONFLICT',
					nextStep: 'RESOLVE_IDENTITY',
					operationalStatus: 'BLOCKED',
					deliveryStatus: 'UNVERIFIED',
					environment,
					slug: canonical.slug,
					lifecycle: canonical.lifecycle,
					comparison,
				}),
			);
			continue;
		}
		if (rows.length === 0) continue;

		const result = directlyAligned
			? directlyAlignedDelivery(environment)
			: reconcileInvitationDelivery({
					environment,
					canonical,
					row: rows[0]!,
				});
		comparisons.push(result.comparison);
		operationalStatuses.push(result.operationalStatus);
		deliveryStatuses.push(result.deliveryStatus);
		const issue = signalFromReconciliation({
			result,
			environment,
			slug: canonical.slug,
			lifecycle: canonical.lifecycle,
			work: false,
		});
		if (issue) issues.push(issue);
		const work = signalFromReconciliation({
			result,
			environment,
			slug: canonical.slug,
			lifecycle: canonical.lifecycle,
			work: true,
		});
		if (work) workItems.push(work);

		const assetSignals = evaluateAssetSignals({ canonical, environment, row: rows[0]! });
		issues.push(...assetSignals.issues);
		workItems.push(...assetSignals.workItems);
		operationalStatuses.push(...assetSignals.operationalStatuses);
		deliveryStatuses.push(...assetSignals.deliveryStatuses);
	}

	appendPresenceSignals({ canonical, coverage, rowsByEnvironment, state });
	appendLifecycleSignals(canonical, state, coverage);

	return {
		summary: {
			slug: canonical.slug,
			lifecycle: canonical.lifecycle,
			operationalStatus: aggregateOperationalStatus(operationalStatuses),
			deliveryStatus: aggregateDeliveryStatus(deliveryStatuses),
			comparisons,
		},
		issues,
		workItems,
	};
}

function evaluateLegacyInvitations(
	evidence: SnapshotEvidence,
	coverage: readonly EnvironmentCoverage[],
): { summaries: InvitationSummary[]; issues: ObservabilitySignal[] } {
	const summaries: InvitationSummary[] = [];
	const issues: ObservabilitySignal[] = [];
	for (const entry of evidence.legacy) {
		const operationalStatuses: OperationalStatus[] = [];
		for (const environment of ENVIRONMENTS) {
			if (entry.remoteParity === 'excluded' && environment !== 'local') continue;
			const coverageRow = coverage.find((item) => item.environment === environment)!;
			if (coverageRow.status !== 'AVAILABLE') continue;
			const rows = rowsFor(evidence.projections[environment], entry.slug);
			if (rows.length === 1) {
				operationalStatuses.push('HEALTHY');
				continue;
			}
			const identityConflict = rows.length > 1;
			operationalStatuses.push('BLOCKED');
			issues.push(
				signal({
					impact: 'OPERATIONAL',
					reasonCode: identityConflict
						? 'INVITATION_IDENTITY_CONFLICT'
						: 'INVITATION_MISSING',
					nextStep: identityConflict ? 'RESOLVE_IDENTITY' : 'VERIFY_BASELINE',
					operationalStatus: 'BLOCKED',
					environment,
					slug: entry.slug,
					lifecycle: 'published',
				}),
			);
		}
		summaries.push({
			slug: entry.slug,
			lifecycle: 'published',
			operationalStatus: aggregateOperationalStatus(operationalStatuses),
			deliveryStatus: 'ALIGNED',
			comparisons: [],
		});
	}
	return { summaries, issues };
}

export function assembleSnapshotFromEvidence(evidence: SnapshotEvidence): ObservabilitySnapshot {
	const coverage = ENVIRONMENTS.map((environment) =>
		coverageFor(
			environment,
			evidence.probeScope,
			evidence.projections[environment],
			evidence.migrations[environment],
		),
	);
	const issues = environmentBaseSignals(evidence, coverage);
	const workItems: ObservabilitySignal[] = [];
	const invitationSummaries: InvitationSummary[] = [];

	for (const failure of evidence.canonicalFailures) {
		issues.push(
			signal({
				impact: 'OPERATIONAL',
				reasonCode: 'CANONICAL_INVALID',
				nextStep: 'FIX_CANONICAL_DEFINITION',
				operationalStatus: 'BLOCKED',
				deliveryStatus: 'UNVERIFIED',
				slug: failure.slug,
				lifecycle: failure.lifecycle,
			}),
		);
		invitationSummaries.push({
			slug: failure.slug,
			lifecycle: failure.lifecycle,
			operationalStatus: 'BLOCKED',
			deliveryStatus: 'UNVERIFIED',
			comparisons: [],
		});
	}

	for (const canonical of evidence.canonical) {
		const result = evaluateCanonicalInvitation(canonical, evidence, coverage);
		invitationSummaries.push(result.summary);
		issues.push(...result.issues);
		workItems.push(...result.workItems);
	}
	const legacy = evaluateLegacyInvitations(evidence, coverage);
	invitationSummaries.push(...legacy.summaries);
	issues.push(...legacy.issues);

	const environmentSummaries: EnvironmentSummary[] = ENVIRONMENTS.map((environment) => {
		const coverageRow = coverage.find((item) => item.environment === environment)!;
		const scopedIssues = issues.filter((item) => item.environment === environment);
		const scopedWork = workItems.filter((item) => item.environment === environment);
		const comparisonStatuses = invitationSummaries.flatMap((summary) =>
			summary.comparisons
				.filter((comparison) => comparison.environment === environment)
				.map((comparison) => comparisonToDeliveryStatus(comparison)),
		);
		return {
			environment,
			operationalStatus:
				coverageRow.status === 'NOT_PROBED'
					? 'UNVERIFIED'
					: aggregateOperationalStatus(
							scopedIssues.map((item) => item.operationalStatus),
						),
			deliveryStatus:
				coverageRow.status === 'NOT_PROBED'
					? 'UNVERIFIED'
					: aggregateDeliveryStatus([
							...comparisonStatuses,
							...scopedIssues.map((item) => item.deliveryStatus),
							...scopedWork.map((item) => item.deliveryStatus),
						]),
			coverage: coverageRow.status,
			counts: {
				invitations: evidence.projections[environment].activeInvitationRows,
				issues: scopedIssues.length,
				workItems: scopedWork.length,
			},
		};
	});

	const aggregateEnvironments = environmentSummaries.filter(
		(summary) => summary.coverage !== 'NOT_PROBED',
	);
	const operationalStatus = aggregateOperationalStatus([
		...aggregateEnvironments.map((summary) => summary.operationalStatus),
		...invitationSummaries.map((summary) => summary.operationalStatus),
		...issues.filter((item) => !item.environment).map((item) => item.operationalStatus),
	]);
	const deliveryStatus = aggregateDeliveryStatus([
		...aggregateEnvironments.map((summary) => summary.deliveryStatus),
		...invitationSummaries.map((summary) => summary.deliveryStatus),
		...issues.filter((item) => !item.environment).map((item) => item.deliveryStatus),
	]);
	const freshness = coverage.every((item) => item.status === 'AVAILABLE') ? 'FRESH' : 'PARTIAL';
	const reporting = buildReportingEvidence({
		generatedAt: evidence.generatedAt,
		probeScope: evidence.probeScope,
		invitations: invitationSummaries,
		issues,
		workItems,
	});

	return finalizeObservabilitySnapshot({
		generatedAt: evidence.generatedAt,
		freshness,
		operationalStatus,
		deliveryStatus,
		reporting,
		coverage,
		cache: {
			refreshAfter: new Date(
				new Date(evidence.generatedAt).getTime() + REFRESH_TTL_MS,
			).toISOString(),
		},
		issues,
		workItems,
		environmentSummaries,
		invitationSummaries,
	});
}

export async function buildObservabilitySnapshot(options?: {
	probeScope?: ObservabilityProbeScope;
}): Promise<ObservabilitySnapshot> {
	return assembleSnapshotFromEvidence(
		await collectSnapshotEvidence(options?.probeScope ?? 'all'),
	);
}

export async function buildObservabilitySummary(): Promise<ObservabilitySummaryPayload> {
	const snapshot = await buildObservabilitySnapshot({ probeScope: 'local' });
	return {
		schemaVersion: 3,
		generatedAt: snapshot.generatedAt,
		freshness: snapshot.freshness,
		operationalStatus: snapshot.operationalStatus,
		deliveryStatus: snapshot.deliveryStatus,
		reporting: snapshot.reporting,
		coverage: snapshot.coverage,
		counts: {
			invitations: snapshot.invitationSummaries.length,
			issues: snapshot.issues.length,
			workItems: snapshot.workItems.length,
		},
	};
}
