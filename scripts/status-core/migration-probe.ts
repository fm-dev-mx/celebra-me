/**
 * Migration-history retrieval and schema lifecycle classification.
 * Reuses audit-db parity + schema-lifecycle-state; does not reimplement rules.
 */

import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	evaluateMigrationHistoryParity,
	fetchRemoteMigrationVersions,
} from '../db/audit-db.ts';
import { PROJECT_ROOT, runCommand } from '../db/db-workflow-lib.ts';
import {
	classifySchemaLifecycle,
	type SchemaLifecycleState,
} from '../db/schema-lifecycle-state.ts';
import type { StatusProbeSession } from './probe-runner.ts';

export function listExpectedMigrationVersions(): string[] {
	const migrationsDir = resolve(PROJECT_ROOT, 'supabase', 'migrations');
	if (!existsSync(migrationsDir)) return [];
	return readdirSync(migrationsDir)
		.filter((f) => f.endsWith('.sql'))
		.sort()
		.map((f) => f.split('_')[0]!)
		.filter(Boolean);
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

/**
 * Read migration lifecycle for a DB URL with explicit timeout via session/runner.
 * Counts as one session invocation when using StatusProbeSession memoization of the SQL.
 */
export async function readMigrationLifecycleForUrl(
	dbUrl: string,
	session: StatusProbeSession,
): Promise<MigrationLifecycleResult> {
	const sql = 'select version from supabase_migrations.schema_migrations order by version;';
	try {
		const result = await session.psql(sql, dbUrl, { tuplesOnly: true });
		if (result.status !== 0) {
			const combined = `${result.stderr}\n${result.stdout}`;
			const uninitialized =
				(combined.includes('42P01') || combined.includes('does not exist')) &&
				combined.includes('supabase_migrations.schema_migrations');
			if (uninitialized) {
				const expected = listExpectedMigrationVersions();
				const parity = evaluateMigrationHistoryParity(expected, []);
				return toLifecycle(parity, []);
			}
			return unverifiedLifecycle();
		}
		const remoteVersions = result.stdout
			.split(/\r?\n/)
			.map((v) => v.trim())
			.filter(Boolean);
		const parity = evaluateMigrationHistoryParity(
			listExpectedMigrationVersions(),
			remoteVersions,
		);
		return toLifecycle(parity, remoteVersions);
	} catch {
		return unverifiedLifecycle();
	}
}

export function readMigrationLifecycleForUrlSync(
	dbUrl: string,
	session: StatusProbeSession,
): MigrationLifecycleResult {
	const sql = 'select version from supabase_migrations.schema_migrations order by version;';
	try {
		const result = session.psqlSync(sql, dbUrl, { tuplesOnly: true, throwOnError: false });
		if (result.status !== 0) {
			const combined = `${result.stderr}\n${result.stdout}`;
			const uninitialized =
				(combined.includes('42P01') || combined.includes('does not exist')) &&
				combined.includes('supabase_migrations.schema_migrations');
			if (uninitialized) {
				const expected = listExpectedMigrationVersions();
				const parity = evaluateMigrationHistoryParity(expected, []);
				return toLifecycle(parity, []);
			}
			return unverifiedLifecycle();
		}
		const remoteVersions = result.stdout
			.split(/\r?\n/)
			.map((v) => v.trim())
			.filter(Boolean);
		const parity = evaluateMigrationHistoryParity(
			listExpectedMigrationVersions(),
			remoteVersions,
		);
		return toLifecycle(parity, remoteVersions);
	} catch {
		return unverifiedLifecycle();
	}
}

/**
 * Observability-compatible path: uses audit-db fetch with an explicit timeout runner.
 * Prefer session-based APIs for managed-status; this helper preserves budget consume sites.
 */
export function readMigrationLifecycleWithTimeout(
	dbUrl: string,
	timeoutMs: number,
): MigrationLifecycleResult {
	try {
		const remote = fetchRemoteMigrationVersions(dbUrl, (command, args, options) =>
			runCommand(command, args, {
				...options,
				env: {
					...process.env,
					PGOPTIONS: '-c default_transaction_read_only=on',
				},
				timeoutMs,
			}),
		);
		const parity = evaluateMigrationHistoryParity(
			listExpectedMigrationVersions(),
			remote.remoteVersions,
		);
		return toLifecycle(parity, remote.remoteVersions);
	} catch {
		return unverifiedLifecycle();
	}
}
