/**
 * Compose the canonical status view from existing classifiers. No new decision rules.
 */
import { assertCurrentDisposableMigrationProof } from '../db/disposable-migration-proof.ts';
import {
	evaluateGeneralStatus,
	getOrCreateStatusProbeSession,
	listExpectedMigrationVersions,
	resetStatusProbeSession,
	type EnvTargetStatus,
	type TargetEnv,
} from './dbs-status.ts';
import { evaluateManagedPromotionStatus } from './managed-promotion-status.ts';
import { enrichCanonicalDiagnostics } from './canonical-diagnostics.ts';
import { listInvitationDefinitions } from './invitations/registry.ts';
import { invitationAttentionCount } from '../../src/lib/status/presentation.ts';
import type {
	CanonicalEnvSummary,
	CanonicalStatusView,
	DisposableProofStatus,
	EvidenceState,
	SchemaLifecycleState,
	SchemaOperationReadiness,
} from '../../src/lib/status/types.ts';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

function disposableStatus(ok: boolean, hasProof: boolean): DisposableProofStatus {
	if (ok) return 'valid';
	return hasProof ? 'stale' : 'missing';
}

function expectedTargetClassification(environment: TargetEnv): string {
	return environment === 'local' ? 'persistent-local' : environment;
}

function envSummary(
	status: EnvTargetStatus,
	expectedCount: number,
	invitationAttentionCountValue: number,
): CanonicalEnvSummary {
	const reachableLive = status.reachable && status.freshness?.source === 'live';
	const evidence: EvidenceState = reachableLive ? 'LIVE' : 'UNVERIFIED';
	const targetClassification = status.targetClassification || 'unknown';
	return {
		environment: status.environment,
		schemaLifecycle: (status.schemaLifecycle ?? 'UNVERIFIED') as SchemaLifecycleState,
		appliedCount: status.appliedMigrationCount ?? null,
		expectedCount,
		migrationHead: status.migrationHead ?? null,
		pendingMigrations: status.pendingMigrations ?? [],
		extraMigrations: status.extraMigrations ?? [],
		invitationAttentionCount: invitationAttentionCountValue,
		identityConflictsCount: status.identityConflictsCount,
		targetClassification,
		environmentIdentityOk:
			!status.reachable || targetClassification === expectedTargetClassification(status.environment),
		schemaOperationReadiness: (status.schemaOperationReadiness ??
			'UNVERIFIED') as SchemaOperationReadiness,
		evidence,
		probedAt: status.freshness?.probedAt ?? null,
	};
}

export async function buildCanonicalStatusView(options?: {
	slugs?: readonly string[];
	environments?: readonly TargetEnv[];
	resetSession?: boolean;
	diagnostics?: boolean;
}): Promise<CanonicalStatusView> {
	if (options?.resetSession !== false) resetStatusProbeSession();
	const session = getOrCreateStatusProbeSession();
	const expectedVersions = listExpectedMigrationVersions();
	const disposable = assertCurrentDisposableMigrationProof();
	const general = await evaluateGeneralStatus({
		includeManagedCounts: true,
		concurrency: 3,
		session,
		environments: options?.environments,
	});
	const promotion = await evaluateManagedPromotionStatus({
		session,
		slugs: options?.slugs,
		environments: options?.environments,
		diagnostics: Boolean(options?.diagnostics),
	});
	const envStateMap = new Map(
		Object.entries(promotion.environmentsBySlug).map(([slug, states]) => [slug, states]),
	);

	const environments = {
		local: envSummary(
			general.environments.local,
			expectedVersions.length,
			invitationAttentionCount(envStateMap, 'local'),
		),
		preview: envSummary(
			general.environments.preview,
			expectedVersions.length,
			invitationAttentionCount(envStateMap, 'preview'),
		),
		production: envSummary(
			general.environments.production,
			expectedVersions.length,
			invitationAttentionCount(envStateMap, 'production'),
		),
	};

	const evidenceStates: EvidenceState[] = ENVS.map((env) => environments[env].evidence);
	const overallEvidence: EvidenceState = evidenceStates.every((state) => state === 'LIVE')
		? 'LIVE'
		: evidenceStates.some((state) => state === 'LIVE')
			? 'LIVE'
			: 'UNVERIFIED';

	const view: CanonicalStatusView = {
		schemaVersion: 1,
		generatedAt: new Date().toISOString(),
		evidence: overallEvidence,
		expectedMigrationHead: expectedVersions.at(-1) ?? null,
		expectedMigrationCount: expectedVersions.length,
		registryCount: general.totalDefinitionsCount,
		inSyncCount: promotion.inSyncSlugs.length,
		inSyncSlugs: promotion.inSyncSlugs,
		environments,
		disposableProof: {
			status: disposableStatus(disposable.ok, Boolean(disposable.proof)),
			reason: disposable.reason,
			evidence: 'LIVE',
		},
		promotions: promotion.promotions,
		activeRowCounts: {
			local: general.environments.local.activeManagedCount,
			preview: general.environments.preview.activeManagedCount,
			production: general.environments.production.activeManagedCount,
		},
		identityConflictCounts: {
			local: general.environments.local.identityConflictsCount,
			preview: general.environments.preview.identityConflictsCount,
			production: general.environments.production.identityConflictsCount,
		},
		diagnostics: [],
		debugCounters: session.debugCounters,
	};
	view.diagnostics = enrichCanonicalDiagnostics({
		view,
		definitions: listInvitationDefinitions().filter((definition) =>
			options?.slugs ? options.slugs.includes(definition.slug) : true,
		),
		rowsByEnv: promotion.rowsByEnv,
		includeSemanticDetail: Boolean(options?.diagnostics),
	});
	return view;
}

export function buildLocalCanonicalStatusView(): CanonicalStatusView {
	const expectedVersions = listExpectedMigrationVersions();
	const disposable = assertCurrentDisposableMigrationProof();
	const registryCount = listInvitationDefinitions().length;
	const unverifiedEnv = (environment: TargetEnv): CanonicalEnvSummary => ({
		environment,
		schemaLifecycle: 'UNVERIFIED',
		appliedCount: null,
		expectedCount: expectedVersions.length,
		migrationHead: null,
		pendingMigrations: [],
		extraMigrations: [],
		invitationAttentionCount: 0,
		identityConflictsCount: 0,
		targetClassification: 'unknown',
		environmentIdentityOk: true,
		schemaOperationReadiness: 'UNVERIFIED',
		evidence: 'UNVERIFIED',
		probedAt: null,
	});
	return {
		schemaVersion: 1,
		generatedAt: new Date().toISOString(),
		evidence: 'UNVERIFIED',
		expectedMigrationHead: expectedVersions.at(-1) ?? null,
		expectedMigrationCount: expectedVersions.length,
		registryCount,
		inSyncCount: 0,
		inSyncSlugs: [],
		environments: {
			local: unverifiedEnv('local'),
			preview: unverifiedEnv('preview'),
			production: unverifiedEnv('production'),
		},
		disposableProof: {
			status: disposableStatus(disposable.ok, Boolean(disposable.proof)),
			reason: disposable.reason,
			evidence: 'LIVE',
		},
		promotions: [],
		activeRowCounts: { local: 0, preview: 0, production: 0 },
		identityConflictCounts: { local: 0, preview: 0, production: 0 },
		diagnostics: [],
	};
}
