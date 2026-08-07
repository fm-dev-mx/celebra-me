/**
 * Production schema migration policy.
 *
 * Owns: perimeter identity, audit handling, release-check evidence, critical pre/post
 * backups (bounded RPO coverage), owner TTY confirmation, post-apply history + mutation
 * contract verification.
 *
 * Gate-before-write ordering is intentional and covered by production-authorization tests.
 */

import { parseSchemaAuditVerdictFromOutput } from './audit-db.ts';
import {
	CRITICAL_BACKUP_RPO_MS,
	formatBackupAge,
	type CriticalBackupCoverage,
} from './critical-backup-reuse.ts';
import {
	ensureCriticalProductionBackup,
	revalidateCriticalProductionBackup,
} from './critical-production-backup.ts';
import { classifyDbTarget, guardProduction } from './db-guard.ts';
import {
	fail,
	getProdDbUrl,
	assertProductionDbUrl,
	redactDbUrl,
	runCommand,
} from './db-workflow-lib.ts';
import { requireCurrentDisposableMigrationProof } from './disposable-migration-proof.ts';
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
import { OperatorError, operatorSymbol, shortSha, writeHuman } from './operator-cli-ux.ts';
import { requireOwnerProductionApply } from './owner-production-apply.ts';
import { ensureValidReleaseCheckEvidence, readGitWorktreeState } from './release-check.ts';

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
				'Reintente pnpm db:migrate -- --target production.',
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
				'Use únicamente pnpm db:migrate -- --target production para mutaciones de schema en Production.',
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
			retryCommand: 'pnpm db:migrate -- --target production',
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

function rememberCoverage(
	session: MigratePolicySession | undefined,
	coverage: CriticalBackupCoverage,
	reused: boolean,
): void {
	if (!session || !coverage.manifestPath) return;
	session.preBackupReused = reused;
	session.preBackupManifestPath = coverage.manifestPath;
	session.preBackupAgeMs = coverage.ageMs;
	session.preBackupMaxAgeMs = coverage.maxAgeMs;
	session.preBackupBusinessActivity = coverage.businessActivityDetected === true;
	session.preBackupCoverageReason = coverage.reason;
}

function runCriticalBackup(
	prodDbUrl: string,
	phase: 'pre' | 'post',
	plan?: MigrationPlan,
	session?: MigratePolicySession,
): void {
	const preparation = ensureCriticalProductionBackup({
		prodDbUrl,
		purpose: phase === 'pre' ? 'migrate-pre' : 'migrate-post',
		planId: plan?.planId,
		pendingVersions: plan?.pendingVersions,
		reuseExisting: phase === 'pre',
		retryCommand: 'pnpm db:migrate -- --target production --apply',
		operationLabel:
			phase === 'pre'
				? 'la autorización de la migración'
				: 'el cierre posterior de la migración',
		failureTitle:
			phase === 'pre'
				? 'Respaldo crítico previo fallido'
				: 'Respaldo crítico posterior fallido',
		noChangesMessage:
			phase === 'post'
				? 'La migración pudo haberse aplicado; verifique el estado.'
				: undefined,
	});
	if (phase === 'pre') {
		rememberCoverage(session, preparation.coverage, preparation.reused);
	}
}

function assertPreBackupCoverageBeforeAuthorize(ctx: {
	dbUrl: string;
	session?: MigratePolicySession;
}): void {
	const manifestPath = ctx.session?.preBackupManifestPath;
	if (!manifestPath) {
		return;
	}
	const check = revalidateCriticalProductionBackup({
		prodDbUrl: ctx.dbUrl,
		manifestPath,
		maxAgeMs: ctx.session?.preBackupMaxAgeMs ?? CRITICAL_BACKUP_RPO_MS,
		retryCommand: 'pnpm db:migrate -- --target production --apply',
	});
	rememberCoverage(ctx.session, check, ctx.session?.preBackupReused === true);
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
				retryCommand: 'pnpm db:migrate -- --target production',
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

	prepareApply(ctx) {
		if (ctx.session?.releaseCheckCompleted && ctx.session.releaseEvidenceSha) {
			return;
		}
		writeHuman(`${operatorSymbol('info')} Release: asegurando evidencia de release-check…`);
		const worktree = readGitWorktreeState();
		const evidence = ensureValidReleaseCheckEvidence({ worktree });
		if (ctx.session) {
			ctx.session.releaseCheckCompleted = true;
			ctx.session.releaseEvidenceSha = evidence.sha;
		}
		writeHuman(
			`${operatorSymbol('ok')} Evidencia de release válida para HEAD ${shortSha(evidence.sha, 12)}.`,
		);
	},

	buildPlan(ctx, mode) {
		const priorBuilds = beginPlanBuild(ctx.session);
		const quiet = mode === 'apply' || priorBuilds > 0;

		requireCurrentDisposableMigrationProof(fail);
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
			if (ctx.session?.releaseEvidenceSha) {
				releaseEvidenceSha = ctx.session.releaseEvidenceSha;
			} else {
				// Fallback when buildPlan(apply) is invoked without prepareApply (tests / direct use).
				if (!quiet) {
					writeHuman(
						`${operatorSymbol('info')} Release: asegurando evidencia de release-check…`,
					);
				}
				const evidence = ensureValidReleaseCheckEvidence({ worktree });
				releaseEvidenceSha = evidence.sha;
				if (ctx.session) {
					ctx.session.releaseCheckCompleted = true;
					ctx.session.releaseEvidenceSha = evidence.sha;
				}
				if (!quiet) {
					writeHuman(
						`${operatorSymbol('ok')} Evidencia de release válida para HEAD ${shortSha(evidence.sha, 12)}.`,
					);
				}
			}
		}

		return buildMigrationPlan({
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
			const ageLabel = formatBackupAge(ctx.session.preBackupAgeMs ?? 0);
			const rpoLabel = formatBackupAge(
				ctx.session.preBackupMaxAgeMs ?? CRITICAL_BACKUP_RPO_MS,
			);
			technicalReview.push([
				'Respaldo previo',
				ctx.session.preBackupReused
					? `Reutilizado · edad ${ageLabel} · RPO ${rpoLabel}`
					: `Nuevo · RPO ${rpoLabel}`,
			]);
			technicalReview.push(['Manifest', ctx.session.preBackupManifestPath]);
			if (ctx.session.preBackupBusinessActivity) {
				technicalReview.push([
					'Actividad de negocio',
					'Detectada tras el respaldo; permitida dentro del RPO',
				]);
			}
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
