import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	lintProductionPatchSql,
	argValue,
	validateAndNormalizeSupabaseUrl,
	validateOwnerUserId,
	assertSameSupabaseProject,
} from './sql-safety.ts';
import { runPsql, getProdDbUrl } from './db-workflow-lib.ts';

const dryRun = process.argv.includes('--dry-run');
const apply = process.argv.includes('--apply');
const file = argValue('--file');
const ownerUserId = argValue('--owner-user-id');

if (!file || file === '--help' || file === '-h') {
	console.error('Usage: pnpm db:prod:patch -- --dry-run --file <production-patch.sql>');
	console.error('       pnpm db:prod:patch -- --apply --owner-user-id <UUID> --file <production-patch.sql>');
	process.exit(1);
}

if (!dryRun && !apply) {
	console.error(
		'Specify --dry-run (lint only) or --apply (execute after validation).',
	);
	process.exit(1);
}

const path = resolve(process.cwd(), file);
let sql: string;
try {
	sql = readFileSync(path, 'utf8');
} catch {
	console.error(`Cannot read file: ${path}`);
	process.exit(1);
}

const result = lintProductionPatchSql(sql);

if (!result.ok) {
	console.error(`Production patch blocked: ${path}`);
	for (const error of result.errors) console.error(`- ${error}`);
	process.exit(1);
}

if (dryRun) {
	console.info(`Production patch dry-run passed lint: ${path}`);
	console.info('No database connection was opened and no SQL was executed.');
	process.exit(0);
}

if (!apply) process.exit(0);

// ── --apply mode ──────────────────────────────────────────────────────────

// 1. Validate owner UUID before connecting
let validatedOwnerId: string;
try {
	validatedOwnerId = validateOwnerUserId(ownerUserId);
} catch (error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exit(1);
}

// 2. Validate SUPABASE_URL from environment
let normalizedUrl: string;
try {
	normalizedUrl = validateAndNormalizeSupabaseUrl(process.env.SUPABASE_URL || '');
} catch (error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exit(1);
}

// 3. Obtain the production database URL
const { url: dbUrl } = getProdDbUrl();

// 4. Verify SUPABASE_URL and PROD_DB_URL reference the same project
try {
	assertSameSupabaseProject(normalizedUrl, dbUrl);
} catch (error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exit(1);
}

// 5. Build session config prefix with both values (session scope so they
//    persist across the BEGIN/COMMIT transaction in the patch SQL).
const ownerConfig = `SELECT set_config('app.owner_user_id', '${validatedOwnerId.replace(/'/g, "''")}', false);\n`;
const urlConfig = `SELECT set_config('app.supabase_project_url', '${normalizedUrl.replace(/'/g, "''")}', false);\n`;
const fullSql = ownerConfig + urlConfig + sql;

// 6. Execute — redact both URLs from output
const execResult = runPsql(fullSql, dbUrl, [normalizedUrl, dbUrl]);

if (execResult.status !== 0) {
	console.error(`Production patch failed (exit ${execResult.status}):`);
	console.error(execResult.stderr || execResult.stdout);
	process.exit(1);
}

console.info(`Owner UUID validated and applied: ${validatedOwnerId}`);
console.info(`Production patch applied successfully: ${file}`);
if (execResult.stdout) console.info(execResult.stdout);
