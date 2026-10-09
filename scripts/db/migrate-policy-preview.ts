/**
 * Preview schema migration policy.
 * Exact Preview project perimeter; clean-HEAD release identity; Preview write auth;
 * no Production backups.
 */

import { fail, redactDbUrl, requirePreviewDbUrl } from './db-workflow-lib.ts';
import { requireCurrentDisposableMigrationProof } from './disposable-migration-proof.ts';
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
import { assertCleanGitWorktree, readGitWorktreeState } from './release-check.ts';
import { resolveContractDeploymentEvidence } from './contract-deployment-evidence.ts';
import { loadMigrationRolloutRegistry } from './migration-deployment-compatibility.ts';
import { operatorSymbol, writeHuman } from './operator-cli-ux.ts';

const PREVIEW_MIGRATE_AUTH_SLUG = 'schema';
const PREVIEW_MIGRATE_AUTH_OPERATION = 'migrate';

export const previewMigratePolicy: MigrateEnvironmentPolicy = {
	target: 'preview',

	resolveContext(input) {
		const { url: dbUrl } = requirePreviewDbUrl();
		return {
			dbUrl,
			expectedPin: input.expectedPin,
			env: input.env ?? process.env,
		};
	},

	buildPlan(ctx, mode) {
		requireCurrentDisposableMigrationProof(fail);
		const worktree = readGitWorktreeState();
		const releaseSha = assertCleanGitWorktree(worktree);
		writeHuman(
			`${operatorSymbol('info')} Preflight: compatibilidad de despliegue (release = HEAD)…`,
		);
		const dryRun = executeSupabaseDryRun(ctx.dbUrl);
		const pendingVersions = dryRun.pendingVersions;

		const dbAppliedVersions = readAppliedMigrationVersions(ctx.dbUrl);
		if (ctx.expectedPin) {
			const compare = comparePendingSetToExpected(
				pendingVersions,
				ctx.expectedPin,
				dbAppliedVersions,
			);
			if (!compare.ok) {
				for (const error of compare.errors) console.error(`❌ ERROR: ${error}`);
				fail('Migration dry-run does not match the explicit --expected set. Aborting.');
			}
		}

		const candidateVersions = pendingVersions;

		// Contract migrations need the same smoke-checked Production deployment
		// evidence on Preview as on Production.
		const { deployedAppIdentity, remoteEvidenceUnavailable } =
			resolveContractDeploymentEvidence({
				candidateVersions,
				registry: loadMigrationRolloutRegistry(),
				targetReleaseSha: releaseSha,
				mode,
			});
		const compat = evaluateHostedCompatibilityForPlan({
			target: 'preview',
			candidateVersions,
			dbAppliedVersions,
			env: ctx.env,
			targetReleaseShaOverride: releaseSha,
			deployedAppIdentity,
		});
		if (!remoteEvidenceUnavailable) assertHostedCompatibilityOrFail(compat, fail);
		logHostedCompatibility(compat);
		const planCompat = remoteEvidenceUnavailable
			? {
					compatibilityStatus: 'environment_not_ready' as const,
					compatibilityReasons: [remoteEvidenceUnavailable],
				}
			: toPlanCompatibility(compat);

		return buildMigrationPlan({
			target: 'preview',
			mode,
			sourceHead: releaseSha,
			redactedTargetIdentity: `preview:${redactDbUrl(ctx.dbUrl)}`,
			pendingVersions: candidateVersions,
			expectedPin: ctx.expectedPin ? [...ctx.expectedPin] : null,
			phaseByVersion: compat.phaseByVersion,
			compatibilityStatus: planCompat.compatibilityStatus,
			compatibilityReasons: planCompat.compatibilityReasons,
			releaseIdentity: {
				kind: 'head',
				value: releaseSha,
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
