/**
 * Shared schema-migration orchestrator.
 * Sequence: preflight → (apply: reviewed → beforeWrite → rebuild+drift → authorize → execute → afterWrite).
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
import { formatPlanReview, formatPlanReviewCompact } from './migrate-plan-format.ts';
import {
	labelTarget,
	operatorSymbol,
	writeHuman,
	OperatorError,
} from './operator-cli-ux.ts';

export { formatPlanReview, formatPlanReviewCompact };

const POLICIES: Record<MigrateTarget, MigrateEnvironmentPolicy> = {
	local: localMigratePolicy,
	preview: previewMigratePolicy,
	production: productionMigratePolicy,
	'disposable-test': disposableMigratePolicy,
};

/** Material fields that must remain stable between a reviewed plan and post-backup rebuild. */
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
	'planId',
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

function failPlanDrift(
	title: string,
	drifts: readonly string[],
	target: MigrateTarget,
): never {
	throw new OperatorError({
		title,
		cause: 'La evidencia en vivo ya no coincide con el plan revisado.',
		code: 'PLAN_DRIFT',
		remediation: [
			'Ejecute de nuevo el preflight de solo lectura.',
			'Revise el plan actualizado.',
			'Reintente el apply con el plan nuevo (no reutilice un plan anterior).',
		],
		retryCommand:
			target === 'production'
				? 'pnpm db:prod:migrate'
				: `pnpm db:migrate -- --target ${target}`,
		noChangesMessage:
			target === 'production'
				? undefined
				: `No se realizaron escrituras de schema en ${labelTarget(target)}.`,
		affected: {
			label: 'Campos con deriva',
			items: [...drifts],
		},
	});
}

function assertReviewDrift(
	reviewed: MigrationPlan,
	live: MigrationPlan,
	target: MigrateTarget,
): void {
	const explicit = detectPlanDrift(reviewed, live).filter((field) =>
		REVIEW_DRIFT_FIELDS.has(field),
	);
	if (explicit.length > 0) {
		failPlanDrift(
			'El plan revisado ya no coincide con la evidencia en vivo',
			explicit,
			target,
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
 * Full orchestration.
 * Apply: reviewed plan → beforeWrite (backup) → one rebuild → drift check → authorize → write.
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

	const reviewed = input.reviewedPlan ?? policy.buildPlan(ctx, 'apply');

	if (input.remindConcurrencyRisk !== false && input.target === 'production') {
		writeHuman(`${operatorSymbol('info')} ${MIGRATE_CONCURRENCY_RESIDUAL_RISK}`);
	}

	// Backup (and other beforeWrite hooks) precede final revalidation and owner authorization.
	policy.beforeWrite(reviewed, ctx);

	writeHuman(`${operatorSymbol('info')} Revalidando evidencia del plan…`);
	const plan = policy.buildPlan(ctx, 'apply');
	assertReviewDrift(reviewed, plan, input.target);
	writeHuman(`${operatorSymbol('ok')} Revalidación sin cambios materiales en el plan.`);

	await policy.authorize(plan, ctx);
	policy.execute(plan, ctx);
	policy.afterWrite(plan, ctx);

	return { plan, wrote: plan.pendingVersions.length > 0 };
}
