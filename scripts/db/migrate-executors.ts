/**
 * Migration executors — Supabase CLI push and guarded psql atomic apply.
 * No authorization, backup, or plan logic.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	MIGRATIONS_DIR,
	getValidatedMigrationFiles,
	runPsqlCommand,
	enforceDisposableTargetOnly,
} from './apply-migrations.ts';
import { fail, runCommand, runPsql, type CommandResult } from './db-workflow-lib.ts';
import { extractPendingMigrationVersions } from './migration-pending-set.ts';

export interface DryRunResult {
	output: string;
	pendingVersions: string[];
}

export function executeSupabaseDryRun(dbUrl: string): DryRunResult {
	const command = runCommand('supabase', ['db', 'push', '--db-url', dbUrl, '--dry-run'], {
		redact: [dbUrl],
	});
	const output = `${command.stdout}\n${command.stderr}`;
	return {
		output,
		pendingVersions: extractPendingMigrationVersions(output),
	};
}

export function executeSupabasePush(dbUrl: string): CommandResult {
	return runCommand('supabase', ['db', 'push', '--db-url', dbUrl, '--yes'], {
		redact: [dbUrl],
		throwOnError: false,
	});
}

export function readAppliedMigrationVersions(dbUrl: string): string[] {
	const result = runPsql(
		'select version from supabase_migrations.schema_migrations order by version',
		dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	if (result.status !== 0) {
		fail(
			`Unable to read schema_migrations from target: ${(result.stderr || result.stdout).trim()}`,
		);
	}
	return result.stdout
		.split(/\r?\n/)
		.map((v) => v.trim())
		.filter(Boolean);
}

export function ensureSchemaMigrationsTable(dbUrl: string): void {
	const initSql = `
BEGIN;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
	version text PRIMARY KEY,
	name text,
	statements text[]
);
COMMIT;
`;
	const initResult = runPsql(initSql, dbUrl, { throwOnError: false });
	if (initResult.status !== 0) {
		fail('Failed to initialize schema_migrations tracking table.');
	}
}

type MigrationFile = { filename: string; version: string; name: string };

function applyMigrationFilesAtomic(options: {
	dbUrl: string;
	files: readonly MigrationFile[];
	onConflictDoNothing: boolean;
	requireFileExists: boolean;
	failLabel: string;
	onProgress?: (filename: string, ok: boolean) => void;
}): void {
	const conflictClause = options.onConflictDoNothing ? ' ON CONFLICT (version) DO NOTHING' : '';
	for (const { filename, version, name } of options.files) {
		const filePath = resolve(MIGRATIONS_DIR, filename);
		if (options.requireFileExists && !existsSync(filePath)) {
			fail(`Migration file not found: ${filePath}`);
		}
		const sqlContent = readFileSync(filePath, 'utf8');
		const atomicSql = `
BEGIN;
${sqlContent}
;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${version}', '${name}')${conflictClause};
COMMIT;
`;
		const result = runPsqlCommand(options.dbUrl, atomicSql);
		options.onProgress?.(filename, result.ok);
		if (!result.ok) {
			fail(`${options.failLabel} ${filename}: ${result.output}`);
		}
	}
}

/**
 * Apply pending migration files via psql atomic transactions (persistent-local).
 * Stops on first failure; already-applied versions are skipped via live history.
 */
export function executePsqlAtomicPending(options: {
	dbUrl: string;
	pendingVersions: readonly string[];
	onProgress?: (filename: string, ok: boolean) => void;
}): void {
	const files = getValidatedMigrationFiles().filter((f) =>
		options.pendingVersions.includes(f.version),
	);
	applyMigrationFilesAtomic({
		dbUrl: options.dbUrl,
		files,
		onConflictDoNothing: true,
		requireFileExists: false,
		failLabel: 'Failed applying',
		onProgress: options.onProgress,
	});
}

/**
 * Disposable-only destructive apply of selected/all migrations.
 * Never redirect to persistent-local.
 */
export function executePsqlAtomicDisposable(options: {
	dbUrl: string;
	pendingVersions?: readonly string[];
	maxVersion?: string;
}): void {
	enforceDisposableTargetOnly(options.dbUrl);
	ensureSchemaMigrationsTable(options.dbUrl);

	const files = getValidatedMigrationFiles(options.maxVersion).filter((f) =>
		options.pendingVersions ? options.pendingVersions.includes(f.version) : true,
	);

	applyMigrationFilesAtomic({
		dbUrl: options.dbUrl,
		files,
		onConflictDoNothing: false,
		requireFileExists: true,
		failLabel: 'Disposable migration failed for',
	});
}

export function verifyVersionsInHistory(dbUrl: string, versions: readonly string[]): void {
	const remote = new Set(readAppliedMigrationVersions(dbUrl));
	for (const version of versions) {
		if (version === 'none') continue;
		if (!remote.has(version)) {
			fail(
				`Post-migration check failed: version "${version}" is not in remote schema_migrations.`,
			);
		}
	}
}

export function runMutationContractVerify(target: 'production' | 'preview'): void {
	runCommand('npx', ['tsx', 'scripts/db/verify-mutation-schema-contract.ts', '--target', target]);
}
