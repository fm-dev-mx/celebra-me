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
import {
	formatKeyValueBlock,
	formatOperatorFailure,
	formatPhaseSummary,
	labelAuthRequirement,
	labelBackupRequirement,
	labelCompatibility,
	labelTarget,
	shortSha,
	writeHuman,
} from './operator-cli-ux.ts';

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

function failPlanDrift(
	title: string,
	drifts: readonly string[],
	target: MigrateTarget,
): never {
	process.stderr.write(
		formatOperatorFailure({
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
		}),
	);
	process.exit(1);
}

function assertNoDrift(
	left: MigrationPlan,
	right: MigrationPlan,
	label: string,
	target: MigrateTarget,
): void {
	const drifts = detectPlanDrift(left, right);
	if (drifts.length > 0) {
		failPlanDrift(label, drifts, target);
	}
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
		assertReviewDrift(input.reviewedPlan, first, input.target);
	}
	const plan = policy.buildPlan(ctx, 'apply');
	assertNoDrift(first, plan, 'Live migration evidence changed before write', input.target);

	if (input.remindConcurrencyRisk !== false) {
		writeHuman(`${MIGRATE_CONCURRENCY_RESIDUAL_RISK}`);
	}

	// Production: beforeWrite (critical backup) precedes authorize (owner TTY).
	policy.beforeWrite(plan, ctx);
	await policy.authorize(plan, ctx);
	policy.execute(plan, ctx);
	policy.afterWrite(plan, ctx);

	return { plan, wrote: plan.pendingVersions.length > 0 };
}

/** Full technical review — URLs stay redacted; hashes/executors/policy names included. */
export function formatPlanReview(plan: MigrationPlan): string {
	const pending =
		plan.pendingVersions.length === 0 ? '(ninguna)' : plan.pendingVersions.join(', ');
	const phases = formatPhaseSummary(plan.phaseByVersion, plan.pendingVersions);
	return formatKeyValueBlock('Revisión técnica del plan de migración', [
		['Entorno', labelTarget(plan.target)],
		['Modo', plan.mode],
		['Migraciones', pending],
		['Fases', phases],
		['Compatibilidad', `${plan.compatibilityStatus} (${labelCompatibility(plan.compatibilityStatus)})`],
		['Motivos', plan.compatibilityReasons.join('; ') || '(ninguno)'],
		['Respaldo', `${plan.backupRequirement}`],
		['Autorización', `${plan.authRequirement}`],
		['Ejecutor', plan.executor],
		['Verificación', plan.verificationRequirement],
		['Plan ID', plan.planId],
		['Source HEAD', plan.sourceHead],
		['Identidad', plan.redactedTargetIdentity],
		['Pin esperado', plan.expectedPin ? plan.expectedPin.join(', ') : '(derivado)'],
		[
			'Release',
			`${plan.releaseIdentity.kind}${plan.releaseIdentity.value ? `=${plan.releaseIdentity.value}` : ''}`,
		],
		['App desplegada', plan.deployedAppIdentity.sha ?? '(ninguna)'],
		['Evidencia release', plan.releaseEvidenceSha ?? '(no requerida en este modo)'],
	]);
}

/** Compact operator card — no URLs, full hashes, executors, or internal policy names. */
export function formatPlanReviewCompact(plan: MigrationPlan): string {
	const pending =
		plan.pendingVersions.length === 0 ? '(ninguna)' : plan.pendingVersions.join(', ');
	const phases = formatPhaseSummary(plan.phaseByVersion, plan.pendingVersions);
	return formatKeyValueBlock('Plan de migración', [
		['Entorno', labelTarget(plan.target)],
		['Migraciones', pending],
		['Fase / compat.', `${phases} · ${labelCompatibility(plan.compatibilityStatus)}`],
		['Respaldo', labelBackupRequirement(plan.backupRequirement)],
		['Autorización', labelAuthRequirement(plan.authRequirement)],
		['Plan', shortSha(plan.planId)],
	]);
}
