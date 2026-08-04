/**
 * Migration-history retrieval and schema lifecycle classification.
 * Reuses shared history reader + schema-lifecycle-state; does not reimplement rules.
 *
 * Sync/async adapters are thin wrappers over one SQL query path and one
 * result-classification function. Observability must use StatusProbeSession.
 */

import { evaluateMigrationHistoryParity } from '../db/audit-db.ts';
import { getValidatedMigrationFiles } from '../db/apply-migrations.ts';
import {
	classifySchemaLifecycle,
	type SchemaLifecycleState,
} from '../db/schema-lifecycle-state.ts';
import type { StatusProbeSession } from './probe-runner.ts';

/** Repository migration versions via shared filename validator (SSOT). */
export function listExpectedMigrationVersions(): string[] {
	return getValidatedMigrationFiles().map((f) => f.version);
}

export interface MigrationLifecycleResult {
	schemaLifecycle: SchemaLifecycleState;
	migrationHead: string | null;
	pendingMigrations: string[];
	extraMigrations: string[];
	appliedMigrationCount: number | null;
	verified: boolean;
}

function toLifecycle(
	parity: ReturnType<typeof evaluateMigrationHistoryParity>,
	remoteVersions: string[],
): MigrationLifecycleResult {
	const schemaLifecycle = classifySchemaLifecycle({
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
	// Fail closed: never report BEHIND without exact missing version IDs.
	const resolvedLifecycle =
		schemaLifecycle === 'BEHIND' && parity.pendingLocal.length === 0
			? 'UNVERIFIED'
			: schemaLifecycle;
	return {
		schemaLifecycle: resolvedLifecycle,
		migrationHead: remoteVersions.at(-1) ?? null,
		pendingMigrations: [...parity.pendingLocal],
		extraMigrations: [...parity.extraRemote],
		appliedMigrationCount: remoteVersions.length,
		verified: true,
	};
}

function unverifiedLifecycle(): MigrationLifecycleResult {
	return {
		schemaLifecycle: 'UNVERIFIED',
		migrationHead: null,
		pendingMigrations: [],
		extraMigrations: [],
		appliedMigrationCount: null,
		verified: false,
	};
}

function classifyRemoteVersions(remoteVersions: string[]): MigrationLifecycleResult {
	const parity = evaluateMigrationHistoryParity(listExpectedMigrationVersions(), remoteVersions);
	return toLifecycle(parity, remoteVersions);
}

function classifyFromPsqlResult(result: {
	status: number | null;
	stdout: string;
	stderr: string;
}): MigrationLifecycleResult {
	if (result.status !== 0) {
		const combined = `${result.stderr}\n${result.stdout}`;
		const uninitialized =
			(combined.includes('42P01') || combined.includes('does not exist')) &&
			combined.includes('supabase_migrations.schema_migrations');
		if (uninitialized) {
			return classifyRemoteVersions([]);
		}
		return unverifiedLifecycle();
	}
	const remoteVersions = result.stdout
		.split(/\r?\n/)
		.map((v) => v.trim())
		.filter(Boolean);
	return classifyRemoteVersions(remoteVersions);
}

const MIGRATION_HISTORY_SQL =
	'select version from supabase_migrations.schema_migrations order by version;';

/**
 * Read migration lifecycle for a DB URL with explicit timeout via session/runner.
 * Counts as one session invocation when using StatusProbeSession memoization of the SQL.
 */
export async function readMigrationLifecycleForUrl(
	dbUrl: string,
	session: StatusProbeSession,
): Promise<MigrationLifecycleResult> {
	try {
		const result = await session.psql(MIGRATION_HISTORY_SQL, dbUrl, { tuplesOnly: true });
		return classifyFromPsqlResult(result);
	} catch {
		return unverifiedLifecycle();
	}
}

export function readMigrationLifecycleForUrlSync(
	dbUrl: string,
	session: StatusProbeSession,
): MigrationLifecycleResult {
	try {
		const result = session.psqlSync(MIGRATION_HISTORY_SQL, dbUrl, {
			tuplesOnly: true,
			throwOnError: false,
		});
		return classifyFromPsqlResult(result);
	} catch {
		return unverifiedLifecycle();
	}
}
