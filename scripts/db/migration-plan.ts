/**
 * Immutable MigrationPlan types, deterministic planId, and pure plan helpers.
 * No database I/O, credentials, or side effects.
 */

import { createHash } from 'node:crypto';
import type { CompatibilityStatus, RolloutPhase } from './migration-deployment-compatibility.ts';

export type MigrateTarget = 'local' | 'preview' | 'production' | 'disposable-test';
export type MigrateMode = 'preflight' | 'apply';
export type AuthRequirement = 'none' | 'preview_scope_or_tty' | 'production_owner_tty';
export type BackupRequirement = 'none' | 'prod_critical_pre_post';
export type ExecutorKind = 'supabase_cli_push' | 'psql_atomic';
export type VerificationRequirement = 'none' | 'history' | 'history_and_mutation_contract';

export type PlanRolloutPhase = RolloutPhase | 'unspecified';

/** Secret-free, deterministic plan identity payload. */
export interface MigrationPlanIdentity {
	target: MigrateTarget;
	mode: MigrateMode;
	sourceHead: string;
	/** Redacted target identity (never a raw URL or credential). */
	redactedTargetIdentity: string;
	pendingVersions: readonly string[];
	expectedPin: readonly string[] | null;
	phaseByVersion: Readonly<Record<string, PlanRolloutPhase>>;
	compatibilityStatus: CompatibilityStatus;
	compatibilityReasons: readonly string[];
	releaseIdentity: {
		kind: 'head' | 'target_sha' | 'none';
		value: string | null;
	};
	deployedAppIdentity: {
		sha: string | null;
		capabilities: readonly string[];
	};
	authRequirement: AuthRequirement;
	backupRequirement: BackupRequirement;
	executor: ExecutorKind;
	verificationRequirement: VerificationRequirement;
	/** Present when Production apply requires prior release-check evidence. */
	releaseEvidenceSha: string | null;
}

export interface MigrationPlan extends MigrationPlanIdentity {
	/** Deterministic hash of identity fields (no secrets/URLs/timestamps). */
	planId: string;
}

/**
 * Plan-id version 2 hashes only material mutation identity.
 * `mode` and `releaseEvidenceSha` stay on the plan for display/gates but must not
 * change the operator-facing planId between preflight and apply for the same change set.
 */
const PLAN_ID_VERSION = 2;

/** Canonical JSON used for planId — field order is fixed. */
export function serializePlanIdentityForHash(identity: MigrationPlanIdentity): string {
	return JSON.stringify({
		v: PLAN_ID_VERSION,
		target: identity.target,
		sourceHead: identity.sourceHead,
		redactedTargetIdentity: identity.redactedTargetIdentity,
		pendingVersions: [...identity.pendingVersions],
		expectedPin: identity.expectedPin ? [...identity.expectedPin] : null,
		phaseByVersion: Object.fromEntries(
			Object.keys(identity.phaseByVersion)
				.sort()
				.map((k) => [k, identity.phaseByVersion[k]]),
		),
		compatibilityStatus: identity.compatibilityStatus,
		compatibilityReasons: [...identity.compatibilityReasons],
		releaseIdentity: {
			kind: identity.releaseIdentity.kind,
			value: identity.releaseIdentity.value,
		},
		deployedAppIdentity: {
			sha: identity.deployedAppIdentity.sha,
			capabilities: [...identity.deployedAppIdentity.capabilities].sort(),
		},
		authRequirement: identity.authRequirement,
		backupRequirement: identity.backupRequirement,
		executor: identity.executor,
		verificationRequirement: identity.verificationRequirement,
	});
}

export function computePlanId(identity: MigrationPlanIdentity): string {
	return createHash('sha256')
		.update(serializePlanIdentityForHash(identity), 'utf8')
		.digest('hex');
}

export function buildMigrationPlan(identity: MigrationPlanIdentity): MigrationPlan {
	const planId = computePlanId(identity);
	return { ...identity, planId };
}

export type PlanDriftField =
	| 'target'
	| 'sourceHead'
	| 'redactedTargetIdentity'
	| 'pendingVersions'
	| 'expectedPin'
	| 'phaseByVersion'
	| 'compatibilityStatus'
	| 'releaseIdentity'
	| 'deployedAppIdentity'
	| 'releaseEvidenceSha'
	| 'planId'
	| 'authRequirement'
	| 'backupRequirement'
	| 'executor'
	| 'verificationRequirement';

export function detectPlanDrift(previous: MigrationPlan, current: MigrationPlan): PlanDriftField[] {
	const drifts: PlanDriftField[] = [];
	const check = <K extends PlanDriftField>(field: K, equal: boolean): void => {
		if (!equal) drifts.push(field);
	};
	check('target', previous.target === current.target);
	check('sourceHead', previous.sourceHead === current.sourceHead);
	check(
		'redactedTargetIdentity',
		previous.redactedTargetIdentity === current.redactedTargetIdentity,
	);
	check(
		'pendingVersions',
		JSON.stringify(previous.pendingVersions) === JSON.stringify(current.pendingVersions),
	);
	check(
		'expectedPin',
		JSON.stringify(previous.expectedPin) === JSON.stringify(current.expectedPin),
	);
	check(
		'phaseByVersion',
		JSON.stringify(previous.phaseByVersion) === JSON.stringify(current.phaseByVersion),
	);
	check('compatibilityStatus', previous.compatibilityStatus === current.compatibilityStatus);
	check(
		'releaseIdentity',
		JSON.stringify(previous.releaseIdentity) === JSON.stringify(current.releaseIdentity),
	);
	check(
		'deployedAppIdentity',
		JSON.stringify(previous.deployedAppIdentity) ===
			JSON.stringify(current.deployedAppIdentity),
	);
	check('releaseEvidenceSha', previous.releaseEvidenceSha === current.releaseEvidenceSha);
	check('authRequirement', previous.authRequirement === current.authRequirement);
	check('backupRequirement', previous.backupRequirement === current.backupRequirement);
	check('executor', previous.executor === current.executor);
	check(
		'verificationRequirement',
		previous.verificationRequirement === current.verificationRequirement,
	);
	check('planId', previous.planId === current.planId);
	return drifts;
}

/** Public JSON shape for --json (secret-free). */
export function planToJson(plan: MigrationPlan): Record<string, unknown> {
	return {
		planId: plan.planId,
		target: plan.target,
		mode: plan.mode,
		sourceHead: plan.sourceHead,
		redactedTargetIdentity: plan.redactedTargetIdentity,
		pendingVersions: [...plan.pendingVersions],
		expectedPin: plan.expectedPin ? [...plan.expectedPin] : null,
		phaseByVersion: { ...plan.phaseByVersion },
		compatibilityStatus: plan.compatibilityStatus,
		compatibilityReasons: [...plan.compatibilityReasons],
		releaseIdentity: { ...plan.releaseIdentity },
		deployedAppIdentity: {
			sha: plan.deployedAppIdentity.sha,
			capabilities: [...plan.deployedAppIdentity.capabilities],
		},
		authRequirement: plan.authRequirement,
		backupRequirement: plan.backupRequirement,
		executor: plan.executor,
		verificationRequirement: plan.verificationRequirement,
		releaseEvidenceSha: plan.releaseEvidenceSha,
	};
}
