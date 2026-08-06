/**
 * Production schema migration policy.
 *
 * Owns: audit handling, release-check evidence validation, critical pre/post backups,
 * owner TTY confirmation, post-apply history + mutation contract verification.
 *
 * Gate-before-write ordering is intentional and covered by production-authorization tests.
 */

import {
	fail,
	getProdDbUrl,
	assertProductionDbUrl,
	redactDbUrl,
	runCommand,
} from './db-workflow-lib.ts';
import {
	assertHostedCompatibilityOrFail,
	evaluateHostedCompatibilityForPlan,
	logHostedCompatibility,
	toPlanCompatibility,
} from './migrate-compatibility.ts';
import {
	executeSupabaseDryRun,
	readAppliedMigrationVersions,
	runMutationContractVerify,
	verifyVersionsInHistory,
} from './migrate-executors.ts';
import type { MigrateEnvironmentPolicy, MigratePolicySession } from './migrate-policy.ts';
import { buildMigrationPlan } from './migration-plan.ts';
import { comparePendingSetToExpected } from './migration-pending-set.ts';
import {
	formatPhaseSummary,
	labelAuthRequirement,
	labelBackupRequirement,
	labelCompatibility,
	operatorSymbol,
	shortSha,
	writeHuman,
} from './operator-cli-ux.ts';
import { requireOwnerProductionApply } from './owner-production-apply.ts';
import { assertValidReleaseCheckEvidence, readGitWorktreeState } from './release-check.ts';

export const PRODUCTION_MIGRATION_OPERATION_TYPE = 'production_migration';

function beginPlanBuild(session?: MigratePolicySession): number {
	const prior = session?.buildPlanCount ?? 0;
	if (session) {
		session.buildPlanCount = prior + 1;
	}
	return prior;
}

/** BEHIND with zero unexplained errors is the expected pre-apply Production state. */
export function isAllowlistedBehindAuditOutput(auditOutput: string, status: number): boolean {
	if (status === 0) return false;
	return (
		/Final schema lifecycle state:\s*BEHIND\b/.test(auditOutput) &&
		/Errors:\s*0\b/.test(auditOutput) &&
		!/Final schema lifecycle state:\s*SCHEMA_DRIFT\b/.test(auditOutput)
	);
}

function runProductionAudit(ctx: { session?: MigratePolicySession }, quiet: boolean): void {
	if (ctx.session?.productionAuditCompleted) {
		if (!quiet) {
			writeHuman(
				`${operatorSymbol('ok')} Auditoría de Production reutilizada en esta orquestación.`,
			);
		}
		return;
	}
	if (quiet) {
		writeHuman(`${operatorSymbol('info')} Revalidando auditoría…`);
	} else {
		writeHuman(`${operatorSymbol('info')} Ejecutando auditoría de solo lectura en Production…`);
	}
	const auditResult = runCommand(
		'npx',
		['tsx', 'scripts/db/audit-db.ts', '--target', 'production'],
		{ throwOnError: false },
	);
	const auditOutput = `${auditResult.stdout}\n${auditResult.stderr}`;
	const behindOnly = isAllowlistedBehindAuditOutput(auditOutput, auditResult.status ?? 1);
	if (auditResult.status !== 0 && !behindOnly) {
		fail(
			'Production database audit failed. Resolve schema drift or unverified history before migrating.',
		);
	}
	if (!quiet) {
		if (behindOnly) {
			writeHuman(
				`${operatorSymbol('warn')} Production está BEHIND (permitido antes de un apply con conjunto exacto).`,
			);
		} else {
			writeHuman(`${operatorSymbol('ok')} Auditoría de Production aprobada.`);
		}
		writeHuman();
	}
	if (ctx.session) ctx.session.productionAuditCompleted = true;
}

function runPreMigrationBackup(prodDbUrl: string): void {
	writeHuman(
		`${operatorSymbol('info')} Creando punto de recuperación crítico previo a la migración…`,
	);
	const backupResult = runCommand(
		'npx',
		['tsx', 'scripts/db/daily-critical-production-backup.ts'],
		{
			env: { ...process.env, PROD_DB_URL: prodDbUrl },
			redact: [prodDbUrl],
			throwOnError: false,
		},
	);
	if (backupResult.status !== 0) {
		fail(
			'PRE_MIGRATION_BACKUP_FAILED: Verified pre-migration backup is required before owner confirmation. No Production write was performed.',
		);
	}
	writeHuman(`${operatorSymbol('ok')} Respaldo crítico previo verificado.`);
	writeHuman();
}

function runPostMigrationBackup(prodDbUrl: string): void {
	writeHuman(
		`${operatorSymbol('info')} Creando conjunto de recuperación crítico posterior a la migración…`,
	);
	runCommand('npx', ['tsx', 'scripts/db/backup-critical-production.ts'], {
		env: { ...process.env, PROD_DB_URL: prodDbUrl },
		redact: [prodDbUrl],
	});
	writeHuman(`${operatorSymbol('ok')} Respaldo crítico posterior verificado.`);
}

export const productionMigratePolicy: MigrateEnvironmentPolicy = {
	target: 'production',

	resolveContext(input) {
		const { url: prodDbUrl } = getProdDbUrl();
		assertProductionDbUrl(prodDbUrl);
		// Connection URLs stay hidden; failures from assertProductionDbUrl remain actionable.
		return {
			dbUrl: prodDbUrl,
			expectedPin: input.expectedPin,
			env: input.env ?? process.env,
			session: {},
		};
	},

	buildPlan(ctx, mode) {
		const priorBuilds = beginPlanBuild(ctx.session);
		// Apply rebuilds are revalidation: keep progress compact; preflight stays verbose.
		const quiet = mode === 'apply' || priorBuilds > 0;
		if (quiet) {
			writeHuman(
				priorBuilds === 0
					? `${operatorSymbol('info')} Revalidando evidencia del plan…`
					: `${operatorSymbol('info')} Confirmando estabilidad del plan…`,
			);
		}

		runProductionAudit(ctx, quiet);

		if (!quiet) {
			writeHuman(`${operatorSymbol('info')} Descubriendo migraciones pendientes (dry-run)…`);
		}
		const dryRun = executeSupabaseDryRun(ctx.dbUrl);
		const pendingVersions = dryRun.pendingVersions;

		if (ctx.expectedPin) {
			const compare = comparePendingSetToExpected(pendingVersions, ctx.expectedPin);
			if (!compare.ok) {
				for (const error of compare.errors) {
					writeHuman(`${operatorSymbol('fail')} ${error}`);
				}
				fail('Migration dry-run does not match --expected. Aborting.');
			}
			if (!quiet) {
				writeHuman(`${operatorSymbol('ok')} Dry-run coincide exactamente con --expected.`);
				writeHuman();
			}
		} else if (!quiet) {
			if (pendingVersions.length === 0) {
				writeHuman(`${operatorSymbol('info')} No hay migraciones pendientes.`);
			} else {
				writeHuman(
					`${operatorSymbol('info')} Pendientes: ${pendingVersions.join(', ')}`,
				);
			}
		}

		const worktree = readGitWorktreeState();
		const releaseSha = worktree.sha;
		if (!quiet) {
			writeHuman(
				`${operatorSymbol('info')} Evaluando compatibilidad de despliegue (release = HEAD)…`,
			);
		}
		const dbAppliedVersions = readAppliedMigrationVersions(ctx.dbUrl);
		const candidateVersions =
			pendingVersions.length > 0
				? pendingVersions
				: (ctx.expectedPin ?? []).filter((v) => v !== 'none');

		const compat = evaluateHostedCompatibilityForPlan({
			target: 'production',
			candidateVersions,
			dbAppliedVersions,
			env: ctx.env,
			targetReleaseShaOverride: releaseSha,
		});
		assertHostedCompatibilityOrFail(compat, fail);
		if (!quiet) {
			logHostedCompatibility(compat);
		}
		const planCompat = toPlanCompatibility(compat);

		let releaseEvidenceSha: string | null = null;
		if (mode === 'apply') {
			if (!quiet) {
				writeHuman(
					`${operatorSymbol('info')} Validando evidencia de release-check para HEAD limpio…`,
				);
			}
			const evidence = assertValidReleaseCheckEvidence({ worktree });
			releaseEvidenceSha = evidence.sha;
			if (!quiet) {
				writeHuman(
					`${operatorSymbol('ok')} Evidencia de release válida para HEAD ${shortSha(evidence.sha, 12)}.`,
				);
				writeHuman();
			}
		}

		const plan = buildMigrationPlan({
			target: 'production',
			mode,
			sourceHead: releaseSha,
			redactedTargetIdentity: `production:${redactDbUrl(ctx.dbUrl)}`,
			pendingVersions: candidateVersions,
			expectedPin: ctx.expectedPin ? [...ctx.expectedPin] : null,
			phaseByVersion: compat.phaseByVersion,
			compatibilityStatus: planCompat.compatibilityStatus,
			compatibilityReasons: planCompat.compatibilityReasons,
			releaseIdentity: { kind: 'head', value: releaseSha },
			deployedAppIdentity: {
				sha: compat.deployedAppSha,
				capabilities: compat.deployedAppCapabilities,
			},
			authRequirement: 'production_owner_tty',
			backupRequirement: 'prod_critical_pre_post',
			executor: 'supabase_cli_push',
			verificationRequirement: 'history_and_mutation_contract',
			releaseEvidenceSha,
		});

		if (quiet && ctx.session) {
			if (ctx.session.lastPlanId && ctx.session.lastPlanId !== plan.planId) {
				writeHuman(
					`${operatorSymbol('warn')} El plan cambió durante la revalidación (${shortSha(ctx.session.lastPlanId)} → ${shortSha(plan.planId)}). Se requiere una nueva revisión.`,
				);
			} else if (priorBuilds > 0) {
				writeHuman(`${operatorSymbol('ok')} Revalidación sin cambios materiales en el plan.`);
			}
		}
		if (ctx.session) ctx.session.lastPlanId = plan.planId;
		return plan;
	},

	beforeWrite(_plan, ctx) {
		// Mandatory verified critical backup before owner confirmation (gate-before-write).
		runPreMigrationBackup(ctx.dbUrl);
	},

	async authorize(plan, ctx) {
		const pendingLabel =
			plan.pendingVersions.length === 0 ? '(ninguna)' : plan.pendingVersions.join(', ');
		const phaseLabel = formatPhaseSummary(plan.phaseByVersion, plan.pendingVersions);
		const releaseSha = plan.releaseEvidenceSha ?? plan.sourceHead;
		await requireOwnerProductionApply({
			apply: true,
			dbUrl: ctx.dbUrl,
			operationType: PRODUCTION_MIGRATION_OPERATION_TYPE,
			operationVerb: 'MIGRATE',
			bindingHex: plan.planId,
			applyActionLabel: 'Aplicar',
			summaryTitle: 'Migración de schema — Production',
			summary: [
				['Migraciones', pendingLabel],
				[
					'Fase / compat.',
					`${phaseLabel} · ${labelCompatibility(plan.compatibilityStatus)}`,
				],
				['Respaldo', labelBackupRequirement(plan.backupRequirement)],
				['Autorización', labelAuthRequirement(plan.authRequirement)],
			],
			technicalReview: [
				['Impacto', 'Aplica migraciones de schema pendientes en Production'],
				['Migraciones', pendingLabel],
				['Fases', phaseLabel],
				['Compatibilidad', `${plan.compatibilityStatus}`],
				...(plan.compatibilityReasons.length > 0
					? ([['Motivos', plan.compatibilityReasons.join('; ')]] as const)
					: []),
				['Respaldo (política)', plan.backupRequirement],
				['Autorización (política)', plan.authRequirement],
				['Ejecutor', plan.executor],
				['Verificación', plan.verificationRequirement],
				['Tipo interno', PRODUCTION_MIGRATION_OPERATION_TYPE],
				['Plan ID', plan.planId],
				['Release SHA', releaseSha],
				['Destino', redactDbUrl(ctx.dbUrl)],
				['Pin esperado', plan.expectedPin ? plan.expectedPin.join(',') : '(derivado del dry-run)'],
				['Controles', 'TTY · agente bloqueado · release-check · backup obligatorio · sin token'],
			],
			env: ctx.env,
			readConfirmationLine: ctx.readConfirmationLine
				? () => String(ctx.readConfirmationLine!())
				: undefined,
		});
	},

	execute(_plan, ctx) {
		writeHuman(`${operatorSymbol('info')} Aplicando migraciones en Production…`);
		runCommand('supabase', ['db', 'push', '--db-url', ctx.dbUrl, '--yes'], {
			redact: [ctx.dbUrl],
		});
		writeHuman(`${operatorSymbol('ok')} Migraciones aplicadas.`);
		writeHuman();
	},

	afterWrite(plan, ctx) {
		writeHuman(`${operatorSymbol('info')} Verificación posterior a la migración…`);
		verifyVersionsInHistory(ctx.dbUrl, plan.pendingVersions);
		runMutationContractVerify('production');
		writeHuman(
			`${operatorSymbol('ok')} Verificación posterior aprobada. Schema y contrato de mutación activos.`,
		);
		runPostMigrationBackup(ctx.dbUrl);
		writeHuman(`${operatorSymbol('ok')} Flujo de migración de Production completado.`);
	},
};
