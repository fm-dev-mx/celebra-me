/**
 * Persistent-local schema migration policy.
 * No hosted release, backup, or authorization requirements.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyDbTarget, verifyLocalIdentity, LOCAL_DB_URL } from './db-guard.ts';
import { getValidatedMigrationFiles, PROJECT_ROOT } from './apply-migrations.ts';
import {
	ensureSchemaMigrationsTable,
	executePsqlAtomicPending,
	readAppliedMigrationVersions,
	verifyVersionsInHistory,
} from './migrate-executors.ts';
import type { MigrateEnvironmentPolicy } from './migrate-policy.ts';
import { buildMigrationPlan } from './migration-plan.ts';
import { comparePendingSetToExpected } from './migration-pending-set.ts';
import { fail, redactDbUrl } from './db-workflow-lib.ts';
import { readGitWorktreeState } from './release-check.ts';

export function verifyPersistentLocalTarget(dbUrl = LOCAL_DB_URL): void {
	const classification = classifyDbTarget(dbUrl);
	if (classification.target !== 'persistent-local') {
		fail(
			`Target database is evaluated as "${classification.target}" instead of persistent-local. Operation blocked.`,
		);
	}

	const configPath = resolve(PROJECT_ROOT, 'supabase', 'config.toml');
	const configContent = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
	const identity = verifyLocalIdentity({ supabaseConfig: configContent });
	if (!identity.ok) {
		fail(`Persistent-local identity verification failed: ${identity.errors.join(' ')}`);
	}
}

function discoverLocalPending(dbUrl: string): string[] {
	ensureSchemaMigrationsTable(dbUrl);
	const applied = new Set(readAppliedMigrationVersions(dbUrl));
	return getValidatedMigrationFiles()
		.filter((f) => !applied.has(f.version))
		.map((f) => f.version);
}

export const localMigratePolicy: MigrateEnvironmentPolicy = {
	target: 'local',

	resolveContext(input) {
		const dbUrl = LOCAL_DB_URL;
		verifyPersistentLocalTarget(dbUrl);
		return {
			dbUrl,
			expectedPin: input.expectedPin,
			env: input.env ?? process.env,
		};
	},

	buildPlan(ctx, mode) {
		const worktree = readGitWorktreeState();
		let pendingVersions = discoverLocalPending(ctx.dbUrl);
		if (ctx.expectedPin) {
			const compare = comparePendingSetToExpected(pendingVersions, ctx.expectedPin);
			if (!compare.ok) {
				fail(
					`Local pending set does not match --expected:\n- ${compare.errors.join('\n- ')}`,
				);
			}
			pendingVersions = [...ctx.expectedPin].filter((v) => v !== 'none');
		}

		return buildMigrationPlan({
			target: 'local',
			mode,
			sourceHead: worktree.sha,
			redactedTargetIdentity: `persistent-local:${redactDbUrl(ctx.dbUrl)}`,
			pendingVersions,
			expectedPin: ctx.expectedPin ? [...ctx.expectedPin] : null,
			phaseByVersion: Object.fromEntries(
				pendingVersions.map((v) => [v, 'unspecified' as const]),
			),
			compatibilityStatus: 'allow',
			compatibilityReasons: ['Local target is not gated by hosted deployment identity.'],
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
		/* no auth for local */
	},

	beforeWrite() {
		/* no backup for local */
	},

	execute(plan, ctx) {
		if (plan.pendingVersions.length === 0) return;
		console.info(
			`Applying ${plan.pendingVersions.length} pending migration(s) to persistent-local database...`,
		);
		executePsqlAtomicPending({
			dbUrl: ctx.dbUrl,
			pendingVersions: plan.pendingVersions,
			onProgress: (filename, ok) => {
				process.stderr.write(`  ${filename}: ${ok ? 'OK' : 'FAIL'}\n`);
			},
		});
		console.info('✅ Persistent-local migration application complete.');
	},

	afterWrite(plan, ctx) {
		if (plan.pendingVersions.length === 0) return;
		verifyVersionsInHistory(ctx.dbUrl, plan.pendingVersions);
	},
};
