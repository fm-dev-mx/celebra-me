/**
 * Migration / schema lifecycle health for Local, Preview, Production, and repository SOURCE.
 * Read-only; failures are isolated per environment.
 */

import { evaluateMigrationHistoryParity, fetchRemoteMigrationVersions } from '../db/audit-db.ts';
import {
	classifySchemaLifecycle,
	type SchemaLifecycleState as DbSchemaLifecycleState,
} from '../db/schema-lifecycle-state.ts';
import {
	listExpectedMigrationVersions,
	resolveDbUrlForEnv,
	type TargetEnv,
} from '../provision/dbs-status.ts';
import { classifyDbTarget } from '../db/db-guard.ts';
import type { MigrationEnvHealth, ObservabilityTargetEnv } from './types.ts';

function redactDetail(message: string): string {
	return message.replace(/:[^:@/]+@/g, ':***@').slice(0, 160);
}

function probeEnv(env: TargetEnv): MigrationEnvHealth {
	const { dbUrl, error } = resolveDbUrlForEnv(env);
	if (!dbUrl) {
		return {
			environment: env,
			appliedCount: null,
			pending: [],
			schemaLifecycle: 'UNVERIFIED',
			reachable: false,
			configured: false,
			detail: redactDetail(error || 'Credentials not configured'),
		};
	}

	try {
		const expected = listExpectedMigrationVersions();
		const remote = fetchRemoteMigrationVersions(dbUrl);
		const parity = evaluateMigrationHistoryParity(expected, remote.remoteVersions);
		const schemaLifecycle: DbSchemaLifecycleState = classifySchemaLifecycle({
			pendingMigrations: parity.pendingLocal,
			extraMigrations: parity.extraRemote,
			mismatchedMigrations:
				parity.isReordered || parity.hasDivergentHistory
					? parity.extraRemote.length > 0
						? parity.extraRemote
						: ['divergent-history']
					: [],
			auditErrors: parity.errors.filter((e) => !e.startsWith('Pending local migrations')),
			verified: true,
		});

		// Connectivity is implied by a successful remote migration fetch.
		const classification = classifyDbTarget(dbUrl);
		return {
			environment: env,
			appliedCount: remote.remoteVersions.length,
			pending: parity.pendingLocal,
			schemaLifecycle,
			reachable: true,
			configured: true,
			detail: `target=${classification.target}; head=${remote.remoteVersions.at(-1) ?? 'none'}`,
		};
	} catch (err) {
		return {
			environment: env,
			appliedCount: null,
			pending: [],
			schemaLifecycle: 'UNVERIFIED',
			reachable: false,
			configured: true,
			detail: redactDetail(err instanceof Error ? err.message : 'Migration probe failed'),
		};
	}
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

export function evaluateMigrationHealth(): MigrationEnvHealth[] {
	const envs: TargetEnv[] = ['local', 'preview', 'production'];
	const rows: MigrationEnvHealth[] = [repositorySourceRow()];
	for (const env of envs) {
		try {
			rows.push(probeEnv(env));
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
