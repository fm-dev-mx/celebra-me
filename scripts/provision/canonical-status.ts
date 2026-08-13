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
import {
	defaultRunProductionPreflight,
	evaluateManagedPromotionStatus,
	PRODUCTION_PREFLIGHT_TIMEOUT_MS,
	refineManagedPromotionsWithProductionPreflight,
} from './managed-promotion-status.ts';
import { resolveInvitationPackageInput } from './invitation-package-input.ts';
import type { EnvironmentPromotionState } from './promotional-fingerprint.ts';
import { enrichCanonicalDiagnostics } from './canonical-diagnostics.ts';
import { listInvitationDefinitions } from './invitations/registry.ts';
import {
	combineEvidence,
	invitationAttentionCount,
	migrationPresenceForEnv,
} from '../../src/lib/status/evidence.ts';
import { getValidatedMigrationFiles } from '../db/apply-migrations.ts';
import {
	buildUnverifiedManualPatchStatuses,
	readManualPatchStatuses,
} from './manual-patch-status.ts';
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
			!status.reachable ||
			targetClassification === expectedTargetClassification(status.environment),
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
		domain: 'schema',
		evidence: production.evidence,
		environment: 'production',
		cause: missing
			? `Production history includes ${missing} without owner-apply evidence.`
			: 'Production history includes migrations without owner-apply evidence.',
		affectedFieldCount: production.authorizationMissingVersions.length,
		affectedSectionCount: 1,
		semanticPaths: production.authorizationMissingVersions.slice(0, 50),
	};
}

const EMPTY_PROMOTION = {
	promotions: [],
	inSyncSlugs: [],
	environmentsBySlug: {},
	envEvidence: {
		local: 'UNVERIFIED' as const,
		preview: 'UNVERIFIED' as const,
		production: 'UNVERIFIED' as const,
	},
	canonicalAvailableBySlug: {},
	rowsByEnv: { local: [], preview: [], production: [] },
};

export async function buildCanonicalStatusView(options?: {
	slugs?: readonly string[];
	environments?: readonly TargetEnv[];
	resetSession?: boolean;
	diagnostics?: boolean;
	domain?: 'schema' | 'content' | 'patch';
	includeProductionPreflight?: boolean;
}): Promise<CanonicalStatusView> {
	if (options?.resetSession !== false) resetStatusProbeSession();
	const session = getOrCreateStatusProbeSession();
	const domain = options?.domain;
	if (domain === 'patch') {
		const generatedAt = new Date().toISOString();
		return {
			...buildLocalCanonicalStatusView(),
			generatedAt,
			freshnessMeta: {
				status: 'LIVE',
				lastVerifiedAt: generatedAt,
			},
			manualPatches: await readManualPatchStatuses({
				session,
				environments: options?.environments,
			}),
			debugCounters: session.debugCounters,
		};
	}
	const refreshContent = domain !== 'schema';
	const refreshPatch = domain !== 'content';
	const expectedVersions = listExpectedMigrationVersions();
	const disposable = assertCurrentDisposableMigrationProof();
	const includeProductionPreflight = options?.includeProductionPreflight === true;
	const [general, promotion, manualPatches] = await Promise.all([
		evaluateGeneralStatus({
			includeManagedCounts: true,
			concurrency: 3,
			session,
			environments: options?.environments,
		}),
		refreshContent
			? evaluateManagedPromotionStatus({
					session,
					slugs: options?.slugs,
					environments: options?.environments,
					diagnostics: Boolean(options?.diagnostics),
					includeProductionPreflight,
				})
			: Promise.resolve(EMPTY_PROMOTION),
		refreshPatch
			? readManualPatchStatuses({
					session,
					environments: options?.environments,
				})
			: Promise.resolve(buildUnverifiedManualPatchStatuses()),
	]);
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

	const migrationFilesMap = new Map(
		getValidatedMigrationFiles().map((file) => [file.version, file.filename]),
	);
	const recentVersions = expectedVersions.slice(-5).reverse();
	const recentMigrations: RecentMigrationRecord[] = recentVersions.map((version) => ({
		version,
		name: migrationFilesMap.get(version) ?? null,
		presence: {
			local: migrationPresenceForEnv(environments.local, version),
			preview: migrationPresenceForEnv(environments.preview, version),
			production: migrationPresenceForEnv(environments.production, version),
		},
		verifiedAt: {
			local: environments.local.probedAt,
			preview: environments.preview.probedAt,
			production: environments.production.probedAt,
		},
	}));

	const overallEvidence = combineEvidence(
		(['local', 'preview', 'production'] as const).map((env) => environments[env].evidence),
	);
	const generatedAt = new Date().toISOString();

	const view: CanonicalStatusView = {
		schemaVersion: 2,
		generatedAt,
		evidence: overallEvidence,
		freshnessMeta: {
			status: 'LIVE',
			lastVerifiedAt: generatedAt,
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
		manualPatches,
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
	annotateUnknownPublicationCauses(view);
	return view;
}

export async function refineCanonicalStatusViewPromotions(
	view: CanonicalStatusView,
	options?: {
		slugs?: readonly string[];
		resetSession?: boolean;
	},
): Promise<CanonicalStatusView> {
	if (options?.resetSession !== false) resetStatusProbeSession();
	const session = getOrCreateStatusProbeSession();
	const definitions = listInvitationDefinitions().filter((definition) =>
		options?.slugs ? options.slugs.includes(definition.slug) : true,
	);
	const environmentsBySlug: Record<
		string,
		Record<TargetEnv, EnvironmentPromotionState>
	> = Object.fromEntries(view.promotions.map((row) => [row.slug, { ...row.environments }]));
	for (const slug of view.inSyncSlugs) {
		if (!environmentsBySlug[slug]) {
			environmentsBySlug[slug] = {
				local: 'match',
				preview: 'match',
				production: 'match',
			};
		}
	}
	const envEvidence = {
		local: view.environments.local.evidence,
		preview: view.environments.preview.evidence,
		production: view.environments.production.evidence,
	};
	const refined = await refineManagedPromotionsWithProductionPreflight({
		promotions: view.promotions,
		inSyncSlugs: view.inSyncSlugs,
		definitions,
		environmentsBySlug,
		envEvidence,
		resolvePackage: async (slug) => (await resolveInvitationPackageInput({ slug })).packageData,
		runProductionPreflight: defaultRunProductionPreflight(definitions),
		timeoutMs: PRODUCTION_PREFLIGHT_TIMEOUT_MS,
	});
	const next: CanonicalStatusView = {
		...view,
		generatedAt: new Date().toISOString(),
		inSyncSlugs: refined.inSyncSlugs,
		inSyncCount: refined.inSyncSlugs.length,
		promotions: refined.promotions,
		debugCounters: session.debugCounters,
	};
	next.freshnessMeta = {
		status: 'LIVE',
		lastVerifiedAt: next.generatedAt,
	};
	annotateUnknownPublicationCauses(next);
	return next;
}

function annotateUnknownPublicationCauses(view: CanonicalStatusView): void {
	for (const row of view.promotions) {
		if (row.action !== 'UNKNOWN') continue;
		for (const item of view.diagnostics) {
			if (item.slug !== row.slug) continue;
			if (row.uncertaintyNotes.includes(item.code)) continue;
			if (row.uncertaintyNotes.length >= 8) break;
			row.uncertaintyNotes.push(item.code);
		}
	}
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
		schemaVersion: 2,
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
		manualPatches: buildUnverifiedManualPatchStatuses(),
		diagnostics: [],
	};
}
