/**
 * Disposable-test schema migration policy.
 * Destructive apply allowed only against disposable-test classification.
 */

import { DISPOSABLE_DB_URL, redactDbUrl } from './db-target-config.ts';
import {
	enforceDisposableTargetOnly,
	getValidatedMigrationFiles,
} from './apply-migrations.ts';
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
			env: input.env ?? process.env,
		};
	},

	buildPlan(ctx, mode) {
		const worktree = readGitWorktreeState();
		ensureSchemaMigrationsTable(ctx.dbUrl);
		const applied = new Set(readAppliedMigrationVersions(ctx.dbUrl));
		let pendingVersions = getValidatedMigrationFiles()
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

		return buildMigrationPlan({
			target: 'disposable-test',
			mode,
			sourceHead: worktree.sha,
			redactedTargetIdentity: `disposable-test:${redactDbUrl(ctx.dbUrl)}`,
			pendingVersions,
			expectedPin: ctx.expectedPin ? [...ctx.expectedPin] : null,
			phaseByVersion: Object.fromEntries(
				pendingVersions.map((v) => [v, 'unspecified' as const]),
			),
			compatibilityStatus: 'allow',
			compatibilityReasons: ['Disposable-test is not gated by hosted deployment identity.'],
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
		});
		console.info('✅ Disposable migration application complete.');
	},

	afterWrite(plan, ctx) {
		if (plan.pendingVersions.length === 0) return;
		verifyVersionsInHistory(ctx.dbUrl, plan.pendingVersions);
	},
};
