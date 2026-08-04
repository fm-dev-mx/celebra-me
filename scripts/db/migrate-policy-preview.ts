/**
 * Preview schema migration policy.
 * Exact preview:schema:migrate auth; target-release identity; no Production backups.
 */

import { PREVIEW_SECRET_FILES, getSecretFromEnvOrFiles } from './db-guard.ts';
import { fail, redactDbUrl } from './db-workflow-lib.ts';
import {
	assertHostedCompatibilityOrFail,
	evaluateHostedCompatibilityForPlan,
	logHostedCompatibility,
	toPlanCompatibility,
} from './migrate-compatibility.ts';
import {
	executeSupabaseDryRun,
	executeSupabasePush,
	readAppliedMigrationVersions,
	runMutationContractVerify,
	verifyVersionsInHistory,
} from './migrate-executors.ts';
import type { MigrateEnvironmentPolicy } from './migrate-policy.ts';
import { buildMigrationPlan } from './migration-plan.ts';
import { comparePendingSetToExpected } from './migration-pending-set.ts';
import { authorizePreviewWriteApply } from '../provision/preview-write-auth.ts';
import { readGitWorktreeState } from './release-check.ts';

const PREVIEW_MIGRATE_AUTH_SLUG = 'schema';
const PREVIEW_MIGRATE_AUTH_OPERATION = 'migrate';

export const previewMigratePolicy: MigrateEnvironmentPolicy = {
	target: 'preview',

	resolveContext(input) {
		const dbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
		if (!dbUrl) {
			fail(
				'PREVIEW_DB_URL is not configured. Set PREVIEW_DB_URL in environment or secret files.',
			);
		}
		return {
			dbUrl,
			expectedPin: input.expectedPin,
			env: input.env ?? process.env,
		};
	},

	buildPlan(ctx, mode) {
		const worktree = readGitWorktreeState();
		const dryRun = executeSupabaseDryRun(ctx.dbUrl);
		const pendingVersions = dryRun.pendingVersions;

		if (ctx.expectedPin) {
			const compare = comparePendingSetToExpected(pendingVersions, ctx.expectedPin);
			if (!compare.ok) {
				for (const error of compare.errors) console.error(`❌ ERROR: ${error}`);
				fail('Migration dry-run does not match the explicit --expected set. Aborting.');
			}
		}

		const dbAppliedVersions = readAppliedMigrationVersions(ctx.dbUrl);
		const candidateVersions =
			pendingVersions.length > 0
				? pendingVersions
				: (ctx.expectedPin ?? []).filter((v) => v !== 'none');

		const compat = evaluateHostedCompatibilityForPlan({
			target: 'preview',
			candidateVersions,
			dbAppliedVersions,
			env: ctx.env,
		});
		assertHostedCompatibilityOrFail(compat, fail);
		logHostedCompatibility(compat);
		const planCompat = toPlanCompatibility(compat);

		return buildMigrationPlan({
			target: 'preview',
			mode,
			sourceHead: worktree.sha,
			redactedTargetIdentity: `preview:${redactDbUrl(ctx.dbUrl)}`,
			pendingVersions: candidateVersions,
			expectedPin: ctx.expectedPin ? [...ctx.expectedPin] : null,
			phaseByVersion: compat.phaseByVersion,
			compatibilityStatus: planCompat.compatibilityStatus,
			compatibilityReasons: planCompat.compatibilityReasons,
			releaseIdentity: {
				kind: 'target_sha',
				value: compat.targetReleaseSha,
			},
			deployedAppIdentity: {
				sha: compat.deployedAppSha,
				capabilities: compat.deployedAppCapabilities,
			},
			authRequirement: 'preview_scope_or_tty',
			backupRequirement: 'none',
			executor: 'supabase_cli_push',
			verificationRequirement: 'history_and_mutation_contract',
			releaseEvidenceSha: null,
		});
	},

	async authorize(_plan, ctx) {
		await authorizePreviewWriteApply({
			slug: PREVIEW_MIGRATE_AUTH_SLUG,
			operation: PREVIEW_MIGRATE_AUTH_OPERATION,
			confirmPrompt: 'Confirm Preview schema migration apply? Type YES to proceed: ',
			readConfirmationLine: ctx.readConfirmationLine,
			isInteractive: ctx.isInteractive,
		});
		console.info('✅ Preview write authorized.\n');
	},

	beforeWrite() {
		/* Preview never invokes Production backups */
	},

	execute(plan, ctx) {
		if (plan.pendingVersions.length === 0) return;
		console.info('Applying pending migrations to preview database...');
		const result = executeSupabasePush(ctx.dbUrl);
		if (result.status !== 0) {
			fail(
				`Preview migration failed with exit code ${result.status}. ` +
					`Re-run preflight and obtain a newly validated plan before retrying.`,
			);
		}
		console.info('✅ Migrations applied successfully.\n');
	},

	afterWrite(plan, ctx) {
		if (plan.pendingVersions.length > 0) {
			verifyVersionsInHistory(ctx.dbUrl, plan.pendingVersions);
		}
		console.info(
			'Verifying the application mutation schema contract before Preview code deployment...',
		);
		runMutationContractVerify('preview');
		console.info('✅ Preview migration and mutation contract verification complete.');
	},
};
