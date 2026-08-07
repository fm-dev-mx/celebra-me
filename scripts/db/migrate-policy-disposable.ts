/**
 * Disposable-test schema migration policy.
 * Destructive apply allowed only against disposable-test classification.
 * Full applies write a disposable migration proof receipt for Local/Hosted gates.
 */

import { DISPOSABLE_DB_URL, redactDbUrl } from './db-target-config.ts';
import {
	enforceDisposableTargetOnly,
	getValidatedMigrationFiles,
} from './apply-migrations.ts';
import { writeDisposableMigrationProof } from './disposable-migration-proof.ts';
import {
	assertCompatibilityOrFail,
	evaluateMigrationDeploymentCompatibility,
	loadMigrationRolloutRegistry,
} from './migration-deployment-compatibility.ts';
import {
	ensureSchemaMigrationsTable,
	executePsqlAtomicDisposable,
	readAppliedMigrationVersions,
	verifyVersionsInHistory,
} from './migrate-executors.ts';
import type { MigrateEnvironmentPolicy } from './migrate-policy.ts';
import { buildMigrationPlan } from './migration-plan.ts';
import { comparePendingSetToExpected } from './migration-pending-set.ts';
import { fail } from './db-workflow-lib.ts';
import { readGitWorktreeState } from './release-check.ts';

export const disposableMigratePolicy: MigrateEnvironmentPolicy = {
	target: 'disposable-test',

	resolveContext(input) {
		const dbUrl = DISPOSABLE_DB_URL;
		enforceDisposableTargetOnly(dbUrl);
		return {
			dbUrl,
			expectedPin: input.expectedPin,
			maxVersion: input.maxVersion ?? null,
			env: input.env ?? process.env,
		};
	},

	buildPlan(ctx, mode) {
		const worktree = readGitWorktreeState();
		ensureSchemaMigrationsTable(ctx.dbUrl);
		const applied = new Set(readAppliedMigrationVersions(ctx.dbUrl));
		const maxVersion = ctx.maxVersion ?? undefined;
		let pendingVersions = getValidatedMigrationFiles(maxVersion)
			.filter((f) => !applied.has(f.version))
			.map((f) => f.version);

		if (ctx.expectedPin) {
			const compare = comparePendingSetToExpected(pendingVersions, ctx.expectedPin);
			if (!compare.ok) {
				fail(
					`Disposable pending set does not match --expected:\n- ${compare.errors.join('\n- ')}`,
				);
			}
			pendingVersions = [...ctx.expectedPin].filter((v) => v !== 'none');
		}

		const registry = loadMigrationRolloutRegistry();
		const compatibility = evaluateMigrationDeploymentCompatibility({
			target: 'disposable-test',
			targetReleaseSha: null,
			deployedAppSha: null,
			deployedAppCapabilities: [],
			dbAppliedVersions: [...applied],
			candidateVersions: pendingVersions,
			targetReleaseMigrationVersions: pendingVersions,
			registry,
		});
		assertCompatibilityOrFail(compatibility, fail);

		return buildMigrationPlan({
			target: 'disposable-test',
			mode,
			sourceHead: worktree.sha,
			redactedTargetIdentity: `disposable-test:${redactDbUrl(ctx.dbUrl)}`,
			pendingVersions,
			expectedPin: ctx.expectedPin ? [...ctx.expectedPin] : null,
			phaseByVersion: Object.fromEntries(
				pendingVersions.map((v) => [
					v,
					compatibility.phaseByVersion[v] ?? ('unspecified' as const),
				]),
			),
			compatibilityStatus: compatibility.status,
			compatibilityReasons: compatibility.reasons,
			releaseIdentity: { kind: 'none', value: null },
			deployedAppIdentity: { sha: null, capabilities: [] },
			authRequirement: 'none',
			backupRequirement: 'none',
			executor: 'psql_atomic',
			verificationRequirement: 'history',
			releaseEvidenceSha: null,
		});
	},

	authorize() {
		/* none */
	},

	beforeWrite() {
		/* none */
	},

	execute(plan, ctx) {
		if (plan.pendingVersions.length === 0) return;
		console.info(`Applying ${plan.pendingVersions.length} migration(s) to disposable-test...`);
		executePsqlAtomicDisposable({
			dbUrl: ctx.dbUrl,
			pendingVersions: plan.pendingVersions,
			maxVersion: ctx.maxVersion ?? undefined,
		});
		console.info('✅ Disposable migration application complete.');
	},

	afterWrite(plan, ctx) {
		if (plan.pendingVersions.length > 0) {
			verifyVersionsInHistory(ctx.dbUrl, plan.pendingVersions);
		}
		// Full (non-cutoff) applies produce the proof Local/Hosted require.
		// Cutoff/baseline applies write a marked proof that cannot authorize hosted.
		const appliedVersions = readAppliedMigrationVersions(ctx.dbUrl);
		const proof = writeDisposableMigrationProof({
			appliedVersions,
			maxVersion: ctx.maxVersion ?? null,
		});
		if (proof.maxVersion) {
			console.info(
				`Disposable cutoff proof recorded (max-version=${proof.maxVersion}); not valid for Local/Hosted authorization.`,
			);
		} else {
			console.info(
				`✅ Disposable migration proof recorded (digest=${proof.migrationSetDigest.slice(0, 12)}…).`,
			);
		}
	},
};
