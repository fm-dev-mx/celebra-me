/**
 * Shared migration-history reader (single live implementation).
 *
 * Consumed by audit-db object audit, status-core lifecycle probes,
 * promotion preflight, and observability. Does not classify lifecycle —
 * that stays in schema-lifecycle-state.ts via migration-probe.ts.
 */

import { runCommand } from '../db/db-workflow-lib.ts';

export interface RemoteMigrationHistoryResult {
	remoteVersions: string[];
	isUninitialized: boolean;
}

const SCHEMA_MIGRATIONS_SQL =
	'select version from supabase_migrations.schema_migrations order by version;';

/**
 * Read remote schema_migrations versions via psql.
 * Throws on connection/permission failures; returns empty versions when the
 * migrations table is missing (uninitialized database).
 */
export function fetchRemoteMigrationVersions(
	dbUrl: string,
	runner: typeof runCommand = runCommand,
): RemoteMigrationHistoryResult {
	const result = runner(
		'psql',
		[
			'--set',
			'ON_ERROR_STOP=1',
			'--no-align',
			'--tuples-only',
			'--field-separator',
			'|',
			'--dbname',
			dbUrl,
		],
		{
			input: SCHEMA_MIGRATIONS_SQL,
			throwOnError: false,
			redact: [dbUrl],
		},
	);

	if (result.status === 0) {
		const versions = result.stdout
			.split(/\r?\n/)
			.map((v) => v.trim())
			.filter(Boolean);
		return { remoteVersions: versions, isUninitialized: false };
	}

	const combinedOutput = `${result.stderr}\n${result.stdout}`;
	const isMissingSchemaMigrationsTable =
		(combinedOutput.includes('42P01') || combinedOutput.includes('does not exist')) &&
		combinedOutput.includes('supabase_migrations.schema_migrations');

	if (isMissingSchemaMigrationsTable) {
		console.info(
			'ℹ️  Target database is uninitialized (supabase_migrations.schema_migrations relation does not exist).',
		);
		return { remoteVersions: [], isUninitialized: true };
	}

	const details = combinedOutput.trim();
	throw new Error(
		`Failed to query schema_migrations table: exit code ${result.status}.${details ? `\n${details}` : ''}`,
	);
}

