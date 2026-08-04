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
import { requireOwnerProductionApply } from './owner-production-apply.ts';
import { assertValidReleaseCheckEvidence, readGitWorktreeState } from './release-check.ts';

export const PRODUCTION_MIGRATION_OPERATION_TYPE = 'production_migration';

/** BEHIND with zero unexplained errors is the expected pre-apply Production state. */
export function isAllowlistedBehindAuditOutput(auditOutput: string, status: number): boolean {
	if (status === 0) return false;
	return (
		/Final schema lifecycle state:\s*BEHIND\b/.test(auditOutput) &&
		/Errors:\s*0\b/.test(auditOutput) &&
		!/Final schema lifecycle state:\s*SCHEMA_DRIFT\b/.test(auditOutput)
	);
}

function runProductionAudit(ctx: { session?: MigratePolicySession }): void {
	if (ctx.session?.productionAuditCompleted) {
		console.info('1. Reusing Production audit evidence from this orchestration (already verified).\n');
		return;
	}
	console.info('1. Running read-only production database audit...');
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
	if (behindOnly) {
		console.info(
			'ℹ️  Production is BEHIND expected migrations (allowed before an exact expected-set apply).\n',
		);
	} else {
		console.info('✅ Production database audit passed.\n');
	}
	if (ctx.session) ctx.session.productionAuditCompleted = true;
}

function runPreMigrationBackup(prodDbUrl: string): void {
	console.info('Creating a complete read-only pre-migration critical recovery point...');
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
	console.info('✅ Complete pre-migration critical recovery point verified.\n');
}

function runPostMigrationBackup(prodDbUrl: string): void {
	console.info('Creating the complete post-migration critical recovery set...');
	runCommand('npx', ['tsx', 'scripts/db/backup-critical-production.ts'], {
		env: { ...process.env, PROD_DB_URL: prodDbUrl },
		redact: [prodDbUrl],
	});
	console.info('✅ Complete post-migration critical recovery set verified.');
}

export const productionMigratePolicy: MigrateEnvironmentPolicy = {
	target: 'production',

	resolveContext(input) {
		const { url: prodDbUrl, source } = getProdDbUrl();
		assertProductionDbUrl(prodDbUrl);
		console.info(`- PROD_DB_URL source: ${source}`);
		console.info(`- Target: ${redactDbUrl(prodDbUrl)}`);
		return {
			dbUrl: prodDbUrl,
			expectedPin: input.expectedPin,
			env: input.env ?? process.env,
			session: {},
		};
	},

	buildPlan(ctx, mode) {
		runProductionAudit(ctx);

		console.info('2. Executing migration dry-run and pending-set discovery...');
		const dryRun = executeSupabaseDryRun(ctx.dbUrl);
		const pendingVersions = dryRun.pendingVersions;

		if (ctx.expectedPin) {
			const compare = comparePendingSetToExpected(pendingVersions, ctx.expectedPin);
			if (!compare.ok) {
				for (const error of compare.errors) console.error(`❌ ERROR: ${error}`);
				fail('Migration dry-run does not match --expected. Aborting.');
			}
			console.info('✅ Dry-run matches --expected exactly.\n');
		} else if (pendingVersions.length === 0) {
			console.info('Dry-run reports no pending migrations.');
		} else {
			console.info(`Pending migrations from dry-run: ${pendingVersions.join(', ')}`);
		}

		const worktree = readGitWorktreeState();
		const releaseSha = worktree.sha;
		console.info('3. Evaluating migration / deployment compatibility (release = HEAD)...');
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
		logHostedCompatibility(compat);
		const planCompat = toPlanCompatibility(compat);

		let releaseEvidenceSha: string | null = null;
		if (mode === 'apply') {
			console.info('4. Validating release-check evidence for current clean HEAD...');
			const evidence = assertValidReleaseCheckEvidence({ worktree });
			releaseEvidenceSha = evidence.sha;
			console.info(`✅ Release evidence valid for HEAD ${evidence.sha}\n`);
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

	beforeWrite(_plan, ctx) {
		// Mandatory verified critical backup before owner confirmation (gate-before-write).
		runPreMigrationBackup(ctx.dbUrl);
	},

	authorize(plan, ctx) {
		const pendingLabel =
			plan.pendingVersions.length === 0 ? '(none)' : plan.pendingVersions.join(',');
		const releaseSha = plan.releaseEvidenceSha ?? plan.sourceHead;
		requireOwnerProductionApply({
			apply: true,
			dbUrl: ctx.dbUrl,
			operationType: PRODUCTION_MIGRATION_OPERATION_TYPE,
			confirmationChallenge: `MIGRATE ${releaseSha} ${pendingLabel} ${plan.planId}`,
			summary: [
				['Mode', 'schema migration apply'],
				['Release SHA', releaseSha],
				['Pending', pendingLabel],
				['Plan ID', plan.planId],
				[
					'Expected pin',
					plan.expectedPin ? plan.expectedPin.join(',') : '(derived from dry-run)',
				],
			],
			env: ctx.env,
			readConfirmationLine: ctx.readConfirmationLine
				? () => String(ctx.readConfirmationLine!())
				: undefined,
		});
	},

	execute(_plan, ctx) {
		console.info('6. Applying migrations to production database...');
		runCommand('supabase', ['db', 'push', '--db-url', ctx.dbUrl, '--yes'], {
			redact: [ctx.dbUrl],
		});
		console.info('✅ Migrations applied successfully.\n');
	},

	afterWrite(plan, ctx) {
		console.info('7. Running post-migration verification...');
		verifyVersionsInHistory(ctx.dbUrl, plan.pendingVersions);
		runMutationContractVerify('production');
		console.info(
			'✅ Post-migration verification passed. Migrations and application DB contract are active.',
		);
		runPostMigrationBackup(ctx.dbUrl);
		console.info('Production migration workflow completed successfully.');
	},
};
