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
import { getValidatedMigrationFiles } from '../db/apply-migrations.ts';
import {
	getSecretFromEnvOrFiles,
	PREVIEW_SECRET_FILES,
	getProdDbUrl,
} from '../db/db-workflow-lib.ts';
import { LOCAL_DB_URL } from '../db/db-guard.ts';
import {
	fetchDetailedRemoteMigrationHistory,
	type MigrationHistoryRecordDetail,
} from '../status-core/migration-history-reader.ts';
import type {
	CanonicalDiagnostic,
	CanonicalEnvSummary,
	CanonicalStatusView,
	DisposableProofStatus,
	EvidenceState,
	RecentMigrationRecord,
	SchemaLifecycleState,
	SchemaOperationReadiness,
} from '../../src/lib/status/types.ts';



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

	const verifiedAt = new Date().toISOString();
	const migrationFilesMap = new Map(
		getValidatedMigrationFiles().map((f) => [f.version, f.filename]),
	);

	const localHistory = fetchDetailedRemoteMigrationHistory(LOCAL_DB_URL);
	const localMap = new Map<string, MigrationHistoryRecordDetail>(
		localHistory.map((m: MigrationHistoryRecordDetail) => [m.version, m]),
	);

	let previewMap = new Map<string, MigrationHistoryRecordDetail>();
	let prodMap = new Map<string, MigrationHistoryRecordDetail>();

	try {
		const previewUrl = getSecretFromEnvOrFiles('PREVIEW_SUPABASE_DB_URL', PREVIEW_SECRET_FILES);
		if (previewUrl) {
			const previewHistory = fetchDetailedRemoteMigrationHistory(previewUrl);
			previewMap = new Map<string, MigrationHistoryRecordDetail>(
				previewHistory.map((m: MigrationHistoryRecordDetail) => [m.version, m]),
			);
		}
	} catch {}

	try {
		const prodUrl = getProdDbUrl();
		if (prodUrl?.url) {
			const prodHistory = fetchDetailedRemoteMigrationHistory(prodUrl.url);
			prodMap = new Map<string, MigrationHistoryRecordDetail>(
				prodHistory.map((m: MigrationHistoryRecordDetail) => [m.version, m]),
			);
		}
	} catch {}

	const recentVersions = expectedVersions.slice(-5).reverse();
	const recentMigrations: RecentMigrationRecord[] = recentVersions.map((version) => {
		const localRec = localMap.get(version);
		const previewRec = previewMap.get(version);
		const prodRec = prodMap.get(version);
		const name = migrationFilesMap.get(version) ?? localRec?.name ?? null;

		return {
			version,
			name,
			applied: {
				local: Boolean(localRec),
				preview: Boolean(previewRec),
				production: Boolean(prodRec),
			},
			appliedAt: {
				local: localRec?.insertedAt ?? null,
				preview: previewRec?.insertedAt ?? null,
				production: prodRec?.insertedAt ?? null,
			},
			verifiedAt,
		};
	});

	const overallEvidence = combineEvidence(
		(['local', 'preview', 'production'] as const).map((env) => environments[env].evidence),
	);

	const view: CanonicalStatusView = {
		schemaVersion: 1,
		generatedAt: verifiedAt,
		evidence: overallEvidence,
		freshnessMeta: {
			status: 'LIVE',
			lastVerifiedAt: verifiedAt,
		},
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
		recentMigrations,
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
