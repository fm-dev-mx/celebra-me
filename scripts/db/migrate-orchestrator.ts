/**
 * Shared schema-migration orchestrator.
 * Sequence: preflight → (apply: rebuild+drift) → beforeWrite → authorize → execute → afterWrite.
 *
 * After any failed apply, callers must obtain a newly validated plan — no cached resume.
 */

import { fail } from './db-workflow-lib.ts';
import {
	detectPlanDrift,
	type MigrationPlan,
	type MigrateMode,
	type MigrateTarget,
	type PlanDriftField,
} from './migration-plan.ts';
import {
	MIGRATE_CONCURRENCY_RESIDUAL_RISK,
	type MigrateEnvironmentPolicy,
	type MigratePolicyContext,
} from './migrate-policy.ts';
import { localMigratePolicy } from './migrate-policy-local.ts';
import { previewMigratePolicy } from './migrate-policy-preview.ts';
import { productionMigratePolicy } from './migrate-policy-production.ts';
import { disposableMigratePolicy } from './migrate-policy-disposable.ts';

const POLICIES: Record<MigrateTarget, MigrateEnvironmentPolicy> = {
	local: localMigratePolicy,
	preview: previewMigratePolicy,
	production: productionMigratePolicy,
	'disposable-test': disposableMigratePolicy,
};

/** Fields that must remain stable between a reviewed preflight plan and apply rebuild. */
const REVIEW_DRIFT_FIELDS: ReadonlySet<PlanDriftField> = new Set([
	'target',
	'sourceHead',
	'redactedTargetIdentity',
	'pendingVersions',
	'expectedPin',
	'phaseByVersion',
	'compatibilityStatus',
	'releaseIdentity',
	'deployedAppIdentity',
]);

export function getMigratePolicy(target: MigrateTarget): MigrateEnvironmentPolicy {
	return POLICIES[target];
}

export interface OrchestrateMigrateInput {
	target: MigrateTarget;
	mode: MigrateMode;
	expectedPin: readonly string[] | null;
	env?: NodeJS.ProcessEnv;
	/** Prior preflight plan from interactive review; apply rejects drift against it. */
	reviewedPlan?: MigrationPlan | null;
	remindConcurrencyRisk?: boolean;
	readConfirmationLine?: () => string | Promise<string>;
	isInteractive?: boolean;
}

export interface OrchestrateMigrateResult {
	plan: MigrationPlan;
	wrote: boolean;
}

function withSeams(
	ctx: MigratePolicyContext,
	input: OrchestrateMigrateInput,
): MigratePolicyContext {
	return {
		...ctx,
		session: ctx.session ?? {},
		readConfirmationLine: input.readConfirmationLine ?? ctx.readConfirmationLine,
		isInteractive: input.isInteractive ?? ctx.isInteractive,
	};
}

function assertNoDrift(left: MigrationPlan, right: MigrationPlan, label: string): void {
	const drifts = detectPlanDrift(left, right);
	if (drifts.length > 0) {
		fail(
			`PLAN_DRIFT: ${label} (${drifts.join(', ')}). ` +
				`Re-run preflight and obtain a newly validated plan. No write was performed.`,
		);
	}
}

function assertReviewDrift(reviewed: MigrationPlan, live: MigrationPlan): void {
	const explicit = detectPlanDrift(reviewed, live).filter((field) =>
		REVIEW_DRIFT_FIELDS.has(field),
	);
	if (explicit.length > 0) {
		fail(
			`PLAN_DRIFT: Reviewed plan no longer matches live evidence (${explicit.join(', ')}). ` +
				`Re-run preflight and obtain a newly validated plan. No write was performed.`,
		);
	}
}

/**
 * Build a read-only MigrationPlan (no writes, no authorization).
 */
export function preflightMigrate(input: OrchestrateMigrateInput): MigrationPlan {
	const policy = getMigratePolicy(input.target);
	const ctx = withSeams(
		policy.resolveContext({
			expectedPin: input.expectedPin,
			env: input.env,
		}),
		input,
	);
	return policy.buildPlan(ctx, 'preflight');
}

/**
 * Full orchestration. Apply rebuilds evidence and rejects plan drift before the first write.
 */
export async function orchestrateMigrate(
	input: OrchestrateMigrateInput,
): Promise<OrchestrateMigrateResult> {
	const policy = getMigratePolicy(input.target);
	const ctx = withSeams(
		policy.resolveContext({
			expectedPin: input.expectedPin,
			env: input.env,
		}),
		input,
	);

	if (input.mode !== 'apply') {
		fail('orchestrateMigrate only supports mode=apply; use preflightMigrate for read-only planning.');
	}

	// Apply: rebuild current evidence twice; reject instability before authorization or write.
	const first = policy.buildPlan(ctx, 'apply');
	if (input.reviewedPlan) {
		assertReviewDrift(input.reviewedPlan, first);
	}
	const plan = policy.buildPlan(ctx, 'apply');
	assertNoDrift(first, plan, 'Live migration evidence changed before write');

	if (input.remindConcurrencyRisk !== false) {
		console.info(`Note: ${MIGRATE_CONCURRENCY_RESIDUAL_RISK}`);
	}

	// Production: beforeWrite (critical backup) precedes authorize (owner TTY).
	policy.beforeWrite(plan, ctx);
	await policy.authorize(plan, ctx);
	policy.execute(plan, ctx);
	policy.afterWrite(plan, ctx);

	return { plan, wrote: plan.pendingVersions.length > 0 };
}

export function formatPlanReview(plan: MigrationPlan): string {
	const lines = [
		'------------------------------------------------------------',
		'Migration plan review',
		'------------------------------------------------------------',
		`Plan ID:          ${plan.planId}`,
		`Target:           ${plan.target}`,
		`Mode:             ${plan.mode}`,
		`Source HEAD:      ${plan.sourceHead}`,
		`Identity:         ${plan.redactedTargetIdentity}`,
		`Pending:          ${plan.pendingVersions.length === 0 ? '(none)' : plan.pendingVersions.join(', ')}`,
		`Expected pin:     ${plan.expectedPin ? plan.expectedPin.join(', ') : '(none — derived)'}`,
		`Phases:           ${
			Object.keys(plan.phaseByVersion).length === 0
				? '(none)'
				: Object.entries(plan.phaseByVersion)
						.map(([v, p]) => `${v}=${p}`)
						.join(', ')
		}`,
		`Compatibility:    ${plan.compatibilityStatus}`,
		`Release:          ${plan.releaseIdentity.kind}${plan.releaseIdentity.value ? `=${plan.releaseIdentity.value}` : ''}`,
		`Deployed app:     ${plan.deployedAppIdentity.sha ?? '(none)'}`,
		`Authorization:    ${plan.authRequirement}`,
		`Backups:          ${plan.backupRequirement}`,
		`Executor:         ${plan.executor}`,
		`Verification:     ${plan.verificationRequirement}`,
		`Release evidence: ${plan.releaseEvidenceSha ?? '(not required for this mode)'}`,
		'------------------------------------------------------------',
	];
	return lines.join('\n');
}
