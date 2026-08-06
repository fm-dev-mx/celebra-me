/**
 * Production schema migration policy.
 *
 * Owns: perimeter identity, audit handling, release-check evidence, critical pre/post
 * backups, owner TTY confirmation, post-apply history + mutation contract verification.
 *
 * Gate-before-write ordering is intentional and covered by production-authorization tests.
 */

import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { parseSchemaAuditVerdictFromOutput } from './audit-db.ts';
import {
	assertProductionUnchangedSinceBackup,
	evaluateCriticalBackupReuse,
} from './critical-backup-reuse.ts';
import { classifyDbTarget, guardProduction } from './db-guard.ts';
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
import { buildMigrationTechnicalReview } from './migrate-plan-format.ts';
import { buildMigrationPlan, type MigrationPlan } from './migration-plan.ts';
import { comparePendingSetToExpected } from './migration-pending-set.ts';
import {
	OperatorError,
	operatorSymbol,
	shortSha,
	writeHuman,
} from './operator-cli-ux.ts';
import { requireOwnerProductionApply } from './owner-production-apply.ts';
import {
	ensureValidReleaseCheckEvidence,
	readGitWorktreeState,
} from './release-check.ts';

export const PRODUCTION_MIGRATION_OPERATION_TYPE = 'production_migration';

function beginPlanBuild(session?: MigratePolicySession): number {
	const prior = session?.buildPlanCount ?? 0;
	if (session) {
		session.buildPlanCount = prior + 1;
	}
	return prior;
}

/**
 * BEHIND with zero unexplained errors is the expected pre-apply Production state.
 * Kept for tests; prefer parseSchemaAuditVerdictFromOutput for new code.
 */
export function isAllowlistedBehindAuditOutput(auditOutput: string, status: number): boolean {
	const verdict = parseSchemaAuditVerdictFromOutput(auditOutput, status);
	// Standalone audit exits non-zero for BEHIND; status 0 is not an allowlisted pre-apply signal.
	return status !== 0 && verdict.readyForMigrate && verdict.lifecycle === 'BEHIND';
}

function assertProductionMigratePerimeter(dbUrl: string): void {
	const classification = classifyDbTarget(dbUrl);
	if (classification.target !== 'production') {
		throw new OperatorError({
			title: 'Destino distinto de Production',
			cause: `Se solicitó Production pero la URL se clasifica como "${classification.target}" (${classification.reason}).`,
			code: 'PRODUCTION_TARGET_MISMATCH',
			remediation: [
				'Confirme PROD_DB_URL del proyecto Production configurado.',
				'Reintente pnpm db:prod:migrate.',
			],
		});
	}
	const guard = guardProduction(classification, 'migrate');
	if (!guard.ok) {
		throw new OperatorError({
			title: 'Perímetro de Production bloqueado',
			cause: guard.errors.join('; ') || 'guardProduction rechazó la operación migrate.',
			code: 'PRODUCTION_GUARD_BLOCKED',
			remediation: [
				'Use únicamente pnpm db:prod:migrate para mutaciones de schema en Production.',
				'No intente bypasses de db-guard ni supabase db push directo.',
			],
		});
	}
}

function runProductionAudit(ctx: { session?: MigratePolicySession }, quiet: boolean): void {
	if (ctx.session?.productionAuditCompleted) {
		return;
	}
	if (!quiet) {
		writeHuman(`${operatorSymbol('info')} Preflight: auditoría de solo lectura…`);
	}
	const auditResult = runCommand(
		'npx',
		['tsx', 'scripts/db/audit-db.ts', '--target', 'production'],
		{ throwOnError: false },
	);
	const auditOutput = `${auditResult.stdout}\n${auditResult.stderr}`;
	const verdict = parseSchemaAuditVerdictFromOutput(auditOutput, auditResult.status ?? 1);
	if (!verdict.readyForMigrate) {
		throw new OperatorError({
			title: 'Auditoría de Production bloqueada',
			cause: `Estado ${verdict.lifecycle} con ${verdict.errorCount} error(es). Resuelva drift o historial no verificado antes de migrar.`,
			code: 'PRODUCTION_AUDIT_FAILED',
			remediation: [
				'Ejecute pnpm db:prod:audit y revise el informe.',
				'Corrija SCHEMA_DRIFT o errores de objetos antes de reintentar.',
			],
			retryCommand: 'pnpm db:prod:migrate',
		});
	}
	if (!quiet) {
		if (verdict.lifecycle === 'BEHIND') {
			writeHuman(
				`${operatorSymbol('warn')} Production está BEHIND (listo para migrar pendientes).`,
			);
		} else {
			writeHuman(`${operatorSymbol('ok')} Auditoría de Production aprobada.`);
		}
	}
	if (ctx.session) ctx.session.productionAuditCompleted = true;
}

function tryReusePreMigrationBackup(
	prodDbUrl: string,
	session?: MigratePolicySession,
): boolean {
	writeHuman(
		`${operatorSymbol('info')} Comprobando si un respaldo crítico existente aún cubre Production…`,
	);
	const evaluation = evaluateCriticalBackupReuse({
		prodDbUrl,
		projectRef: SUPABASE_PROJECT_REFS.production,
	});
	if (!evaluation.reusable || !evaluation.manifestPath || !evaluation.liveIntegrity) {
		writeHuman(
			`${operatorSymbol('info')} Se requiere un respaldo crítico nuevo (${evaluation.reason}).`,
		);
		return false;
	}
	if (session) {
		session.preBackupReused = true;
		session.preBackupManifestPath = evaluation.manifestPath;
		session.preBackupIntegrity = evaluation.liveIntegrity;
	}
	writeHuman(
		`${operatorSymbol('ok')} Respaldo crítico existente reutilizado; Production no cambió.`,
	);
	writeHuman(`${operatorSymbol('info')} Manifest: ${evaluation.manifestPath}`);
	return true;
}

function runCriticalBackup(
	prodDbUrl: string,
	phase: 'pre' | 'post',
	plan?: MigrationPlan,
	session?: MigratePolicySession,
): void {
	if (phase === 'pre' && tryReusePreMigrationBackup(prodDbUrl, session)) {
		return;
	}

	const label =
		phase === 'pre'
			? 'Creando respaldo crítico previo…'
			: 'Creando respaldo crítico posterior…';
	writeHuman(`${operatorSymbol('info')} ${label}`);
	const backupEnv: NodeJS.ProcessEnv = {
		...process.env,
		PROD_DB_URL: prodDbUrl,
		CELEBRA_CRITICAL_BACKUP_PURPOSE: phase === 'pre' ? 'migrate-pre' : 'migrate-post',
	};
	if (plan) {
		backupEnv.CELEBRA_CRITICAL_BACKUP_PLAN_ID = plan.planId;
		backupEnv.CELEBRA_CRITICAL_BACKUP_PENDING = plan.pendingVersions.join(',');
	}
	const backupResult = runCommand(
		'npx',
		['tsx', 'scripts/db/backup-critical-production.ts'],
		{
			env: backupEnv,
			redact: [prodDbUrl],
			throwOnError: false,
		},
	);
	if (backupResult.status !== 0) {
		throw new OperatorError({
			title:
				phase === 'pre'
					? 'Respaldo crítico previo fallido'
					: 'Respaldo crítico posterior fallido',
			cause:
				phase === 'pre'
					? 'El respaldo verificado es obligatorio antes de la confirmación del propietario.'
					: 'El respaldo posterior a la migración no se completó.',
			code: phase === 'pre' ? 'PRE_MIGRATION_BACKUP_FAILED' : 'POST_MIGRATION_BACKUP_FAILED',
			remediation: [
				'Revise credenciales PROD_DB_URL / PROD_SUPABASE_* del operador.',
				'Reintente el flujo completo de migración.',
			],
			retryCommand: 'pnpm db:prod:migrate -- --apply',
			noChangesMessage:
				phase === 'pre' ? undefined : 'La migración pudo haberse aplicado; verifique el estado.',
		});
	}
	if (phase === 'pre' && session) {
		session.preBackupReused = false;
		const manifestMatch = /CRITICAL_BACKUP_MANIFEST=([^\r\n]+)/.exec(
			`${backupResult.stdout}\n${backupResult.stderr}`,
		);
		if (manifestMatch?.[1]) {
			session.preBackupManifestPath = manifestMatch[1].trim();
		}
	}
	writeHuman(
		`${operatorSymbol('ok')} Respaldo crítico ${phase === 'pre' ? 'previo' : 'posterior'} verificado.`,
	);
}

function assertPreBackupCoverageBeforeAuthorize(
	ctx: { dbUrl: string; session?: MigratePolicySession },
): void {
	const expected = ctx.session?.preBackupIntegrity;
	if (!ctx.session?.preBackupReused || !expected) {
		return;
	}
	writeHuman(
		`${operatorSymbol('info')} Confirmando que Production sigue cubierta por el respaldo reutilizado…`,
	);
	const check = assertProductionUnchangedSinceBackup({
		prodDbUrl: ctx.dbUrl,
		expectedIntegrity: expected,
	});
	if (!check.ok) {
		throw new OperatorError({
			title: 'Production cambió desde el respaldo crítico',
			cause:
				'El estado vivo ya no coincide con el respaldo reutilizado. Se aborta antes de la autorización.',
			code: 'PRODUCTION_CHANGED_SINCE_BACKUP',
			remediation: [
				'Reintente `pnpm db:prod:migrate -- --apply` para capturar un respaldo crítico nuevo.',
				'No reutilice el plan anterior si hubo otras escrituras (promoción, patch, etc.).',
			],
			retryCommand: 'pnpm db:prod:migrate -- --apply',
			affected: {
				label: 'Diferencias de integridad',
				items: check.failures,
			},
		});
	}
	ctx.session.preBackupIntegrity = check.liveIntegrity;
	writeHuman(`${operatorSymbol('ok')} Cobertura del respaldo confirmada.`);
}

function validatePendingVersions(
	pendingVersions: string[],
	expectedPin: readonly string[] | null | undefined,
	quiet: boolean,
): void {
	if (expectedPin) {
		const compare = comparePendingSetToExpected(pendingVersions, expectedPin);
		if (!compare.ok) {
			throw new OperatorError({
				title: 'El dry-run no coincide con --expected',
				cause: compare.errors.join('; '),
				code: 'EXPECTED_PIN_MISMATCH',
				remediation: [
					'Revise el conjunto pendiente real con un preflight.',
					'Ajuste --expected al conjunto exacto o omita el pin.',
				],
				retryCommand: 'pnpm db:prod:migrate',
				affected: { label: 'Detalles', items: [...compare.errors] },
			});
		}
		if (!quiet) {
			writeHuman(`${operatorSymbol('ok')} Dry-run coincide exactamente con --expected.`);
		}
	} else if (!quiet) {
		if (pendingVersions.length === 0) {
			writeHuman(`${operatorSymbol('info')} No hay migraciones pendientes.`);
		} else {
			writeHuman(`${operatorSymbol('info')} Pendientes: ${pendingVersions.join(', ')}`);
		}
	}
}

export const productionMigratePolicy: MigrateEnvironmentPolicy = {
	target: 'production',

	resolveContext(input) {
		const { url: prodDbUrl } = getProdDbUrl();
		assertProductionDbUrl(prodDbUrl);
		assertProductionMigratePerimeter(prodDbUrl);
		return {
			dbUrl: prodDbUrl,
			expectedPin: input.expectedPin,
			env: input.env ?? process.env,
			session: {},
		};
	},

	buildPlan(ctx, mode) {
		const priorBuilds = beginPlanBuild(ctx.session);
		const quiet = mode === 'apply' || priorBuilds > 0;

		runProductionAudit(ctx, quiet);

		if (!quiet) {
			writeHuman(`${operatorSymbol('info')} Preflight: descubriendo pendientes (dry-run)…`);
		}
		const dryRun = executeSupabaseDryRun(ctx.dbUrl);
		const pendingVersions = dryRun.pendingVersions;
		validatePendingVersions(pendingVersions, ctx.expectedPin, quiet);

		const worktree = readGitWorktreeState();
		const releaseSha = worktree.sha;
		if (!quiet) {
			writeHuman(
				`${operatorSymbol('info')} Preflight: compatibilidad de despliegue (release = HEAD)…`,
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
					`${operatorSymbol('info')} Release: asegurando evidencia de release-check…`,
				);
			}
			const evidence = ensureValidReleaseCheckEvidence({ worktree });
			releaseEvidenceSha = evidence.sha;
			if (!quiet) {
				writeHuman(
					`${operatorSymbol('ok')} Evidencia de release válida para HEAD ${shortSha(evidence.sha, 12)}.`,
				);
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

		return plan;
	},

	beforeWrite(plan, ctx) {
		runCriticalBackup(ctx.dbUrl, 'pre', plan, ctx.session);
	},

	async authorize(plan, ctx) {
		assertPreBackupCoverageBeforeAuthorize(ctx);
		const technicalReview: Array<readonly [string, string]> = [
			...buildMigrationTechnicalReview(plan, redactDbUrl(ctx.dbUrl)),
		];
		if (ctx.session?.preBackupManifestPath) {
			technicalReview.push([
				'Respaldo previo',
				ctx.session.preBackupReused
					? `Reutilizado · ${ctx.session.preBackupManifestPath}`
					: `Nuevo · ${ctx.session.preBackupManifestPath}`,
			]);
		}
		await requireOwnerProductionApply({
			apply: true,
			dbUrl: ctx.dbUrl,
			operationType: PRODUCTION_MIGRATION_OPERATION_TYPE,
			operationVerb: 'MIGRATE',
			bindingHex: plan.planId,
			applyActionLabel: 'Aplicar',
			// Compact card already shown by migrate-cli / apply path; gate is menu + code only.
			omitSummary: true,
			summary: [],
			technicalReview,
			env: ctx.env,
			readConfirmationLine: ctx.readConfirmationLine,
		});
	},

	execute(_plan, ctx) {
		writeHuman(`${operatorSymbol('info')} Aplicación: empujando migraciones…`);
		runCommand('supabase', ['db', 'push', '--db-url', ctx.dbUrl, '--yes'], {
			redact: [ctx.dbUrl],
		});
		writeHuman(`${operatorSymbol('ok')} Migraciones aplicadas.`);
	},

	afterWrite(plan, ctx) {
		writeHuman(`${operatorSymbol('info')} Verificación: historial y contrato…`);
		verifyVersionsInHistory(ctx.dbUrl, plan.pendingVersions);
		runMutationContractVerify('production');
		writeHuman(
			`${operatorSymbol('ok')} Verificación aprobada. Schema y contrato de mutación activos.`,
		);
		runCriticalBackup(ctx.dbUrl, 'post', plan, ctx.session);
		writeHuman(`${operatorSymbol('ok')} Migración de Production completada.`);
	},
};
