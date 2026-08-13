/**
 * Shared schema-migration orchestrator.
 * Sequence: preflight → (apply: prepareApply → beforeWrite → rebuild+drift → authorize → execute → afterWrite).
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
import { labelTarget, operatorSymbol, writeHuman, OperatorError } from './operator-cli-ux.ts';

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
	/** Disposable-only migration cutoff (baseline / truncated proof). */
	maxVersion?: string | null;
	env?: NodeJS.ProcessEnv;
	/** Prior preflight plan from interactive review; apply rejects drift against it. */
	reviewedPlan?: MigrationPlan | null;
	remindConcurrencyRisk?: boolean;
	readConfirmationLine?: () => string | Promise<string>;
	isInteractive?: boolean;
	/** Internal mixed-plan fingerprint; never a CLI flag. */
	authorizedPlanBindingHex?: string;
	/** Internal composite operation type; never a CLI flag. */
	authorizedPermitOperationType?: string;
}

export interface OrchestrateMigrateResult {
	plan: MigrationPlan;
	wrote: boolean;
	state: 'APPLIED_AND_VERIFIED';
}

export type MigrateApplyState =
	'NOT_APPLIED' | 'APPLIED_AND_VERIFIED' | 'APPLIED_VERIFICATION_FAILED';

/**
 * A failed apply with an explicit write state. Callers must never infer
 * NOT_APPLIED from a non-zero exit after the mutation boundary was crossed.
 */
export class MigrateApplyError extends OperatorError {
	readonly state: Exclude<MigrateApplyState, 'APPLIED_AND_VERIFIED'>;
	readonly plan: MigrationPlan;

	constructor(input: {
		state: Exclude<MigrateApplyState, 'APPLIED_AND_VERIFIED'>;
		plan: MigrationPlan;
		error: unknown;
	}) {
		const detail = input.error instanceof Error ? input.error.message : String(input.error);
		const mayHaveApplied = input.state === 'APPLIED_VERIFICATION_FAILED';
		super({
			title: mayHaveApplied
				? 'La migración se aplicó o pudo aplicarse, pero no quedó verificada'
				: 'La migración no se aplicó',
			cause: detail,
			code: input.state,
			remediation: mayHaveApplied
				? [
						'Ejecute de nuevo el preflight de solo lectura antes de considerar cualquier apply.',
						'Verifique historial y contrato; no reutilice la autorización ni el plan anterior.',
					]
				: [
						'Corrija la causa antes de generar un plan nuevo.',
						'Vuelva a ejecutar el preflight; no reutilice la autorización anterior.',
					],
			noChangesMessage: mayHaveApplied
				? 'El write pudo completarse. No se considera seguro reintentar sin evidencia viva.'
				: 'No se aplicaron migraciones.',
		});
		this.name = 'MigrateApplyError';
		this.state = input.state;
		this.plan = input.plan;
	}
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
		authorizedPlanBindingHex: input.authorizedPlanBindingHex ?? ctx.authorizedPlanBindingHex,
		authorizedPermitOperationType:
			input.authorizedPermitOperationType ?? ctx.authorizedPermitOperationType,
	};
}

function failPlanDrift(title: string, drifts: readonly string[], target: MigrateTarget): never {
	throw new OperatorError({
		title,
		cause: 'La evidencia en vivo ya no coincide con el plan revisado.',
		code: 'PLAN_DRIFT',
		remediation: [
			'Ejecute de nuevo el preflight de solo lectura.',
			'Revise el plan actualizado.',
			'Reintente el apply con el plan nuevo (no reutilice un plan anterior).',
		],
		retryCommand: `pnpm db:migrate -- --target ${target}`,
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
		failPlanDrift('El plan revisado ya no coincide con la evidencia en vivo', explicit, target);
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
			maxVersion: input.maxVersion,
		}),
		input,
	);
	return policy.buildPlan(ctx, 'preflight');
}

/**
 * Full orchestration.
 * Apply: prepareApply → reviewed plan → beforeWrite (backup) → one rebuild → drift → authorize → write.
 */
export async function orchestrateMigrate(
	input: OrchestrateMigrateInput,
): Promise<OrchestrateMigrateResult> {
	const policy = getMigratePolicy(input.target);
	const ctx = withSeams(
		policy.resolveContext({
			expectedPin: input.expectedPin,
			env: input.env,
			maxVersion: input.maxVersion,
		}),
		input,
	);

	if (input.mode !== 'apply') {
		fail(
			'orchestrateMigrate only supports mode=apply; use preflightMigrate for read-only planning.',
		);
	}

	if (input.remindConcurrencyRisk !== false && input.target === 'production') {
		writeHuman(`${operatorSymbol('info')} ${MIGRATE_CONCURRENCY_RESIDUAL_RISK}`);
	}

	// Release validation (Production) before backup coverage decisions.
	policy.prepareApply?.(ctx);

	const reviewed = input.reviewedPlan ?? policy.buildPlan(ctx, 'apply');

	// Backup / coverage precede final plan rebuild and owner authorization.
	policy.beforeWrite(reviewed, ctx);

	writeHuman(`${operatorSymbol('info')} Revalidación: evidencia material del plan…`);
	const plan = policy.buildPlan(ctx, 'apply');
	assertReviewDrift(reviewed, plan, input.target);
	writeHuman(`${operatorSymbol('ok')} Revalidación sin cambios materiales en el plan.`);

	await policy.authorize(plan, ctx);
	try {
		policy.execute(plan, ctx);
	} catch (error) {
		let state: Exclude<MigrateApplyState, 'APPLIED_AND_VERIFIED'> =
			'APPLIED_VERIFICATION_FAILED';
		try {
			const observed = policy.buildPlan(ctx, 'preflight');
			const attempted = plan.pendingVersions.filter((version) => version !== 'none');
			const remaining = new Set(
				observed.pendingVersions.filter((version) => version !== 'none'),
			);
			if (attempted.length > 0 && attempted.every((version) => remaining.has(version))) {
				state = 'NOT_APPLIED';
			}
		} catch {
			// Fail closed: an unreadable post-failure state may already contain the write.
		}
		throw new MigrateApplyError({ state, plan, error });
	}

	try {
		policy.afterWrite(plan, ctx);
	} catch (error) {
		throw new MigrateApplyError({
			state: 'APPLIED_VERIFICATION_FAILED',
			plan,
			error,
		});
	}

	return {
		plan,
		wrote: plan.pendingVersions.some((version) => version !== 'none'),
		state: 'APPLIED_AND_VERIFIED',
	};
}
