/**
 * apply-local-migrations.ts — Thin Persistent-Local Migration Adapter
 *
 * Reuses shared repository migration infrastructure from `scripts/db/apply-migrations.ts`
 * while enforcing persistent-local database target classification and identity verification.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	classifyDbTarget,
	verifyLocalIdentity,
	LOCAL_DB_URL,
} from './db-guard.ts';
import { runPsql } from './db-workflow-lib.ts';
import {
	PROJECT_ROOT,
	MIGRATIONS_DIR,
	getValidatedMigrationFiles,
	runPsqlCommand,
} from './apply-migrations.ts';

export function verifyPersistentLocalTarget(dbUrl = LOCAL_DB_URL): void {
	const classification = classifyDbTarget(dbUrl);
	if (classification.target !== 'persistent-local') {
		console.error(`ERROR: Target database is evaluated as "${classification.target}" instead of persistent-local. Operation blocked.`);
		process.exit(1);
	}

	const configPath = resolve(PROJECT_ROOT, 'supabase', 'config.toml');
	const configContent = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
	const identity = verifyLocalIdentity({ supabaseConfig: configContent });
	if (!identity.ok) {
		console.error(`ERROR: Persistent-local identity verification failed: ${identity.errors.join(' ')}`);
		process.exit(1);
	}
}

export function getAppliedLocalMigrationVersions(dbUrl = LOCAL_DB_URL): Set<string> {
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
		console.error('ERROR: Failed to initialize schema_migrations tracking table.');
		process.exit(1);
	}

	const res = runPsql('select version from supabase_migrations.schema_migrations;', dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});

	return new Set(res.stdout.trim().split(/\r?\n/).filter(Boolean));
}

export function main(): void {
	verifyPersistentLocalTarget();

	const applied = getAppliedLocalMigrationVersions();
	const allValidatedFiles = getValidatedMigrationFiles();
	const pending = allValidatedFiles.filter((f) => !applied.has(f.version));

	if (pending.length === 0) {
		console.info('✅ Persistent-local database is 100% up-to-date. No pending migrations.');
		return;
	}

	console.info(`Applying ${pending.length} pending migration(s) to persistent-local database...`);

	for (const { filename, version, name } of pending) {
		const filePath = resolve(MIGRATIONS_DIR, filename);
		const sqlContent = readFileSync(filePath, 'utf8');

		const atomicSql = `
BEGIN;
${sqlContent}
;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${version}', '${name}') ON CONFLICT (version) DO NOTHING;
COMMIT;
`;
		process.stdout.write(`  ${filename}: `);
		const result = runPsqlCommand(LOCAL_DB_URL, atomicSql);
		if (!result.ok) {
			console.info('FAIL');
			console.error(`ERROR: Failed applying ${filename}:`);
			console.error(result.output);
			process.exit(1);
		}
		console.info('OK');
	}

	console.info('✅ Persistent-local migration application complete.');
}

if (process.argv[1]?.endsWith('apply-local-migrations.ts')) {
	main();
}
