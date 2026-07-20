/**
 * apply-migrations.ts — Apply repository migrations to disposable test database
 *
 * RESTRICTED: Strictly allowed against the `disposable-test` target only.
 * Prohibited against production, preview, persistent-local, or unknown targets.
 *
 * Uses atomic single-transaction execution combining the migration SQL and
 * its schema_migrations record. Fails closed immediately on any error.
 *
 * Usage:
 *   tsx scripts/db/apply-migrations.ts --db-url <connection-string>
 *   tsx scripts/db/apply-migrations.ts --db-url <url> --file <single-migration.sql>
 *   tsx scripts/db/apply-migrations.ts --db-url <url> --max-version <timestamp>
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyDbTarget, redactDbUrl } from './db-guard.ts';

const PROJECT_ROOT = process.cwd();
const MIGRATIONS_DIR = resolve(PROJECT_ROOT, 'supabase', 'migrations');
const SAFE_FILENAME_PATTERN = /^(\d{14})_([a-zA-Z0-9_-]+)\.sql$/;

function runPsqlCommand(dbUrl: string, sqlInput: string): { ok: boolean; output: string } {
	const result = spawnSync(
		'psql',
		['--set', 'ON_ERROR_STOP=1', '--dbname', dbUrl],
		{ input: sqlInput, encoding: 'utf8', stdio: 'pipe' },
	);
	const stdout = typeof result.stdout === 'string' ? result.stdout : '';
	const stderr = typeof result.stderr === 'string' ? result.stderr : '';
	return {
		ok: result.status === 0,
		output: (stdout + stderr).trim(),
	};
}

function getValidatedMigrationFiles(maxVersion?: string): { filename: string; version: string; name: string }[] {
	if (!existsSync(MIGRATIONS_DIR)) {
		console.error(`ERROR: Migrations directory not found: ${MIGRATIONS_DIR}`);
		process.exit(1);
	}

	const allEntries = readdirSync(MIGRATIONS_DIR);
	const seenVersions = new Map<string, string>();
	const validFiles: { filename: string; version: string; name: string }[] = [];

	for (const entry of allEntries) {
		if (entry.startsWith('.')) continue;

		const match = entry.match(SAFE_FILENAME_PATTERN);
		if (!match) {
			console.error(`ERROR: Malformed migration filename or non-conforming file found: "${entry}".`);
			console.error(`All migration files must strictly follow the format: <14-digit-timestamp>_<name>.sql`);
			process.exit(1);
		}

		const version = match[1]!;
		const name = match[2]!;

		if (seenVersions.has(version)) {
			console.error(`ERROR: Duplicate migration version timestamp "${version}" found in:`);
			console.error(`  - ${seenVersions.get(version)}`);
			console.error(`  - ${entry}`);
			console.error(`Ambiguous ordering detected.`);
			process.exit(1);
		}

		seenVersions.set(version, entry);
		validFiles.push({ filename: entry, version, name });
	}

	validFiles.sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));

	if (maxVersion) {
		if (!/^\d{14}$/.test(maxVersion)) {
			console.error(`ERROR: Requested max version cutoff "${maxVersion}" is malformed. Must be a 14-digit timestamp.`);
			process.exit(1);
		}
		if (!seenVersions.has(maxVersion)) {
			console.error(`ERROR: Requested baseline cutoff version "${maxVersion}" is not a known migration timestamp in the repository.`);
			process.exit(1);
		}
	}

	return maxVersion ? validFiles.filter((f) => f.version <= maxVersion) : validFiles;
}

export function enforceDisposableTargetOnly(dbUrl: string): void {
	const classification = classifyDbTarget(dbUrl);
	if (classification.target !== 'disposable-test') {
		console.error(`ERROR: apply-migrations.ts is strictly restricted to the disposable-test environment.`);
		console.error(`Target evaluated as "${classification.target}" for ${redactDbUrl(dbUrl)}. Operation blocked.`);
		process.exit(1);
	}
}

function main(): void {
	const args = process.argv.slice(2);
	const dbUrlIdx = args.indexOf('--db-url');
	const fileIdx = args.indexOf('--file');
	const maxVersionIdx = args.indexOf('--max-version');
	const maxVersion = maxVersionIdx !== -1 ? args[maxVersionIdx + 1] : undefined;

	if (dbUrlIdx === -1) {
		console.error('Usage: tsx scripts/db/apply-migrations.ts --db-url <url> [--file <path>] [--max-version <timestamp>]');
		process.exit(1);
	}

	const dbUrl = args[dbUrlIdx + 1];
	if (!dbUrl) {
		console.error('ERROR: Missing --db-url value');
		process.exit(1);
	}

	// Safety Enforcement: Target MUST be disposable-test
	enforceDisposableTargetOnly(dbUrl);

	// Ensure migration tracking table exists
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
	const initResult = runPsqlCommand(dbUrl, initSql);
	if (!initResult.ok) {
		console.error('ERROR: Failed to initialize supabase_migrations.schema_migrations table.');
		console.error(initResult.output);
		process.exit(1);
	}

	// Single-file mode
	if (fileIdx !== -1) {
		const rawPath = args[fileIdx + 1];
		if (!rawPath) {
			console.error('ERROR: Missing --file path value');
			process.exit(1);
		}
		const filePath = resolve(PROJECT_ROOT, rawPath);
		if (!existsSync(filePath)) {
			console.error(`ERROR: Migration file not found: ${filePath}`);
			process.exit(1);
		}
		const filename = filePath.split(/[/\\]/).pop()!;
		const match = filename.match(SAFE_FILENAME_PATTERN);
		if (!match) {
			console.error(`ERROR: Single migration file "${filename}" does not match pattern <14-digits>_<name>.sql`);
			process.exit(1);
		}
		const version = match[1]!;
		const name = match[2]!;
		const fileContent = readFileSync(filePath, 'utf8');

		const atomicSql = `
BEGIN;
${fileContent}
;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${version}', '${name}');
COMMIT;
`;
		const result = runPsqlCommand(dbUrl, atomicSql);
		if (!result.ok) {
			console.error(`FAILED: ${filePath}`);
			console.error(result.output);
			process.exit(1);
		}
		console.info(`OK: ${filePath}`);
		return;
	}

	// All-migrations mode
	const files = getValidatedMigrationFiles(maxVersion);

	console.info(
		`Applying ${files.length} migrations to disposable-test database ${redactDbUrl(dbUrl)}${maxVersion ? ` (up to version ${maxVersion})` : ''}`,
	);

	let applied = 0;
	for (const { filename, version, name } of files) {
		const filePath = resolve(MIGRATIONS_DIR, filename);
		process.stdout.write(`  ${filename}: `);
		const fileContent = readFileSync(filePath, 'utf8');

		const atomicSql = `
BEGIN;
${fileContent}
;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${version}', '${name}');
COMMIT;
`;
		const result = runPsqlCommand(dbUrl, atomicSql);
		if (!result.ok) {
			console.info('FAIL');
			console.error(`    ERROR executing migration ${filename}:`);
			console.error(result.output);
			console.error('Migration execution halted on first failure.');
			process.exit(1);
		}
		console.info('OK');
		applied++;
	}

	console.info(`\nResult: ${applied}/${files.length} applied successfully.`);
}

// Execute CLI when invoked directly
if (process.argv[1]?.endsWith('apply-migrations.ts')) {
	main();
}
