/**
 * Hosted migration compatibility evaluation for plan building.
 * Fail-closed helpers wrap the SSOT in migration-deployment-compatibility.ts.
 */

import {
	assertCompatibilityOrFail,
	evaluateAppDatabaseReadiness,
	evaluateMigrationDeploymentCompatibility,
	isHostedMigrateTarget,
	listMigrationVersionsAtGitSha,
	loadMigrationRolloutRegistry,
	resolveHostedMigrationIdentity,
	type CompatibilityEvaluationResult,
	type CompatibilityStatus,
	type DbMigrateTarget,
} from './migration-deployment-compatibility.ts';
import type { PlanRolloutPhase } from './migration-plan.ts';

export interface HostedCompatibilityPlanInput {
	target: DbMigrateTarget;
	candidateVersions: readonly string[];
	dbAppliedVersions: readonly string[];
	env?: NodeJS.ProcessEnv;
	/** Production: override with clean HEAD. */
	targetReleaseShaOverride?: string | null;
}

export interface HostedCompatibilityPlanResult {
	compatibility: CompatibilityEvaluationResult;
	readiness: CompatibilityEvaluationResult;
	targetReleaseSha: string | null;
	deployedAppSha: string | null;
	deployedAppCapabilities: string[];
	phaseByVersion: Record<string, PlanRolloutPhase>;
}

export function evaluateHostedCompatibilityForPlan(
	options: HostedCompatibilityPlanInput,
): HostedCompatibilityPlanResult {
	if (!isHostedMigrateTarget(options.target)) {
		return {
			compatibility: {
				status: 'allow',
				reasons: ['Local/disposable target is not gated by hosted deployment identity.'],
				phaseByVersion: {},
			},
			readiness: {
				status: 'allow',
				reasons: ['Local/disposable target skips app/database readiness gate.'],
				phaseByVersion: {},
			},
			targetReleaseSha: null,
			deployedAppSha: null,
			deployedAppCapabilities: [],
			phaseByVersion: Object.fromEntries(
				options.candidateVersions.map((v) => [v, 'unspecified' as PlanRolloutPhase]),
			),
		};
	}

	const env = options.env ?? process.env;
	const identity = resolveHostedMigrationIdentity(env);
	if (options.targetReleaseShaOverride !== undefined) {
		identity.targetReleaseSha = options.targetReleaseShaOverride?.trim() || null;
	}
	const registry = loadMigrationRolloutRegistry();

	if (!identity.targetReleaseSha) {
		const reason =
			options.target === 'production'
				? 'Production migration requires a clean Git HEAD release identity.'
				: 'Hosted migration requires CELEBRA_TARGET_RELEASE_SHA (authorized target release Git identity). Branch name, worktree path, UI banner, and credential presence alone cannot authorize hosted mutation.';
		return {
			compatibility: { status: 'block', reasons: [reason], phaseByVersion: {} },
			readiness: { status: 'allow', reasons: [], phaseByVersion: {} },
			targetReleaseSha: null,
			deployedAppSha: identity.deployedAppSha,
			deployedAppCapabilities: identity.deployedAppCapabilities,
			phaseByVersion: {},
		};
	}

	let targetReleaseMigrationVersions: string[];
	try {
		targetReleaseMigrationVersions = listMigrationVersionsAtGitSha(identity.targetReleaseSha);
	} catch (error: unknown) {
		return {
			compatibility: {
				status: 'block',
				reasons: [
					`Unable to resolve target-release migration membership for ${identity.targetReleaseSha}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				],
				phaseByVersion: {},
			},
			readiness: { status: 'allow', reasons: [], phaseByVersion: {} },
			targetReleaseSha: identity.targetReleaseSha,
			deployedAppSha: identity.deployedAppSha,
			deployedAppCapabilities: identity.deployedAppCapabilities,
			phaseByVersion: {},
		};
	}

	const compatibility = evaluateMigrationDeploymentCompatibility({
		target: options.target,
		targetReleaseSha: identity.targetReleaseSha,
		deployedAppSha: identity.deployedAppSha,
		deployedAppCapabilities: identity.deployedAppCapabilities,
		dbAppliedVersions: options.dbAppliedVersions,
		candidateVersions: options.candidateVersions,
		targetReleaseMigrationVersions,
		registry,
	});
	const readiness = evaluateAppDatabaseReadiness({
		deployedAppCapabilities: identity.deployedAppCapabilities,
		dbAppliedVersions: options.dbAppliedVersions,
		candidateVersions: options.candidateVersions,
		registry,
	});

	return {
		compatibility,
		readiness,
		targetReleaseSha: identity.targetReleaseSha,
		deployedAppSha: identity.deployedAppSha,
		deployedAppCapabilities: identity.deployedAppCapabilities,
		phaseByVersion: compatibility.phaseByVersion as Record<string, PlanRolloutPhase>,
	};
}

export function assertHostedCompatibilityOrFail(
	result: HostedCompatibilityPlanResult,
	failFn: (message: string) => never,
): void {
	assertCompatibilityOrFail(result.compatibility, failFn);
	assertCompatibilityOrFail(result.readiness, failFn);
}

/** Merge compatibility + readiness into MigrationPlan status fields. */
export function toPlanCompatibility(result: HostedCompatibilityPlanResult): {
	compatibilityStatus: CompatibilityStatus;
	compatibilityReasons: string[];
} {
	return {
		compatibilityStatus:
			result.compatibility.status === 'allow' && result.readiness.status === 'allow'
				? 'allow'
				: result.readiness.status === 'environment_not_ready'
					? 'environment_not_ready'
					: 'block',
		compatibilityReasons: [...result.compatibility.reasons, ...result.readiness.reasons],
	};
}

/** Log compatibility details (stderr-friendly via console.info). */
export function logHostedCompatibility(result: HostedCompatibilityPlanResult): void {
	console.info('✅ Migration / deployment compatibility contract passed.');
	if (result.targetReleaseSha) {
		console.info(`   Target release: ${result.targetReleaseSha}`);
	}
	if (result.deployedAppSha) {
		console.info(`   Deployed app: ${result.deployedAppSha}`);
	}
	if (result.deployedAppCapabilities.length > 0) {
		console.info(`   Deployed capabilities: ${result.deployedAppCapabilities.join(', ')}`);
	}
	for (const [version, phase] of Object.entries(result.phaseByVersion)) {
		console.info(`   Candidate ${version}: phase=${phase}`);
	}
}
