/**
 * Migration / schema lifecycle health for Local, Preview, Production, and repository SOURCE.
 * Read-only; failures are isolated per environment.
 *
 * Prefer passing a precomputed `GeneralStatusSummary` from the snapshot aggregator so
 * connectivity/schema are probed once per refresh (shared with environment-health).
 */

import {
	evaluateGeneralStatus,
	listExpectedMigrationVersions,
	type GeneralStatusSummary,
	type TargetEnv,
} from '../provision/dbs-status.ts';
import type { MigrationEnvHealth, ObservabilityTargetEnv, SchemaLifecycleState } from './types.ts';

function redactDetail(message: string): string {
	return message.replace(/:[^:@/]+@/g, ':***@').slice(0, 160);
}

function repositorySourceRow(): MigrationEnvHealth {
	const expected = listExpectedMigrationVersions();
	return {
		environment: 'repository',
		appliedCount: expected.length,
		pending: '—',
		schemaLifecycle: 'SOURCE',
		reachable: true,
		configured: true,
		detail: 'Repository migration file count (SOURCE)',
	};
}

function mapGeneralEnv(env: TargetEnv, general: GeneralStatusSummary): MigrationEnvHealth {
	const status = general.environments[env];
	const pending = status.pendingMigrations ?? [];
	return {
		environment: env,
		appliedCount: status.reachable ? (status.appliedMigrationCount ?? null) : null,
		pending,
		schemaLifecycle: (status.schemaLifecycle ?? 'UNVERIFIED') as SchemaLifecycleState,
		reachable: status.reachable,
		configured: status.configured,
		detail: status.errorDetail
			? redactDetail(status.errorDetail)
			: status.reachable
				? `target=${status.targetClassification}; head=${status.migrationHead ?? 'none'}`
				: undefined,
	};
}

export function evaluateMigrationHealth(
	general?: GeneralStatusSummary,
	options?: { environments?: readonly TargetEnv[] },
): MigrationEnvHealth[] {
	const summary = general ?? evaluateGeneralStatus();
	const probeEnvs: TargetEnv[] = options?.environments
		? [...options.environments]
		: ['local', 'preview', 'production'];
	const rows: MigrationEnvHealth[] = [repositorySourceRow()];

	for (const env of probeEnvs) {
		try {
			rows.push(mapGeneralEnv(env, summary));
		} catch (err) {
			rows.push({
				environment: env as ObservabilityTargetEnv,
				appliedCount: null,
				pending: [],
				schemaLifecycle: 'UNVERIFIED',
				reachable: false,
				configured: false,
				detail: redactDetail(
					err instanceof Error ? err.message : 'Unexpected probe failure',
				),
			});
		}
	}

	return rows;
}
