/**
 * Compose the canonical status view from existing classifiers.
 * Authorization integrity is a separate evidence class from schema lifecycle.
 */
import { assertCurrentDisposableMigrationProof } from '../db/disposable-migration-proof.ts';
import { evaluateProductionAuthorizationIntegrity } from '../db/production-authorization-integrity.ts';
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
import { combineEvidence, invitationAttentionCount } from '../../src/lib/status/presentation.ts';
import type {
	CanonicalDiagnostic,
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

function inferAppliedVersions(
	expectedVersions: readonly string[],
	pending: readonly string[],
	extra: readonly string[],
): string[] {
	const pendingSet = new Set(pending);
	return [...expectedVersions.filter((version) => !pendingSet.has(version)), ...extra];
}

function envSummary(
	status: EnvTargetStatus,
	expectedVersions: readonly string[],
	invitationAttentionCountValue: number,
): CanonicalEnvSummary {
	const reachableLive = status.reachable && status.freshness?.source === 'live';
	const evidence: EvidenceState = reachableLive ? 'LIVE' : 'UNVERIFIED';
	const targetClassification = status.targetClassification || 'unknown';
	const pending = status.pendingMigrations ?? [];
	const extra = status.extraMigrations ?? [];
	const appliedVersions = reachableLive
		? inferAppliedVersions(expectedVersions, pending, extra)
		: null;
	const authorization = evaluateProductionAuthorizationIntegrity({
		environment: status.environment,
		evidence,
		appliedVersions,
	});
	return {
		environment: status.environment,
		schemaLifecycle: (status.schemaLifecycle ?? 'UNVERIFIED') as SchemaLifecycleState,
		appliedCount: status.appliedMigrationCount ?? null,
		expectedCount: expectedVersions.length,
		migrationHead: status.migrationHead ?? null,
		pendingMigrations: pending,
		extraMigrations: extra,
		invitationAttentionCount: invitationAttentionCountValue,
		identityConflictsCount: status.identityConflictsCount,
		targetClassification,
		environmentIdentityOk:
			!status.reachable || targetClassification === expectedTargetClassification(status.environment),
		schemaOperationReadiness: (status.schemaOperationReadiness ??
			'UNVERIFIED') as SchemaOperationReadiness,
		schemaNextAction: status.schemaNextAction ?? null,
		authorizationIntegrity: authorization.status,
		authorizationMissingVersions: authorization.missingVersions,
		evidence,
		probedAt: status.freshness?.probedAt ?? null,
	};
}

function authorizationDiagnostic(production: CanonicalEnvSummary): CanonicalDiagnostic | null {
	if (production.authorizationIntegrity !== 'MISSING') return null;
	const missing = production.authorizationMissingVersions.slice(0, 8).join(', ');
	return {
		code: 'PRODUCTION_AUTHORIZATION_MISSING',
		environment: 'production',
		cause: missing
			? `Production history includes ${missing} without owner-apply evidence.`
			: 'Production history includes migrations without owner-apply evidence.',
		affectedFieldCount: production.authorizationMissingVersions.length,
		affectedSectionCount: 1,
		semanticPaths: production.authorizationMissingVersions.slice(0, 50),
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
			expectedVersions,
			invitationAttentionCount(envStateMap, 'local'),
		),
		preview: envSummary(
			general.environments.preview,
			expectedVersions,
			invitationAttentionCount(envStateMap, 'preview'),
		),
		production: envSummary(
			general.environments.production,
			expectedVersions,
			invitationAttentionCount(envStateMap, 'production'),
		),
	};

	const overallEvidence = combineEvidence(ENVS.map((env) => environments[env].evidence));

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
	const authFinding = authorizationDiagnostic(environments.production);
	if (authFinding) view.diagnostics = [authFinding, ...view.diagnostics];
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
		schemaNextAction: null,
		authorizationIntegrity: environment === 'production' ? 'UNVERIFIED' : 'NOT_APPLICABLE',
		authorizationMissingVersions: [],
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
