import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
	lintProductionPatchSql,
	argValue,
	validateAndNormalizeSupabaseUrl,
	validateOwnerUserId,
	assertSameSupabaseProject,
} from './sql-safety.ts';
import {
	consumeProductionApproval,
	getProdDbUrl,
	requireProductionConfirmationSync,
	runPsql,
} from './db-workflow-lib.ts';

/**
 * db:prod:patch disposition: RESTRICT_OWNER_ONLY / KEEP_SPECIALIZED
 *
 * Narrow owner-only path for reviewed manual SQL patches that cannot yet be
 * expressed as versioned supabase/migrations/*. Not a bypass for
 * invitation:promote or db:prod:migrate. Default operator mode is lint-only
 * (--dry-run). --apply requires external Ed25519 approval matching the exact
 * patch fingerprint and never auto-migrates schema.
 */

const dryRun = process.argv.includes('--dry-run');
const apply = process.argv.includes('--apply');
const file = argValue('--file');
const ownerUserId = argValue('--owner-user-id');

function printUsage(): void {
	console.error('Usage: pnpm db:prod:patch -- --dry-run --file <production-patch.sql>');
	console.error(
		'       pnpm db:prod:patch -- --apply --owner-user-id <UUID> --file <production-patch.sql>',
	);
	console.error(
		'Owner-only specialized maintenance. Prefer supabase/migrations + db:prod:migrate for schema and invitation:promote for managed content.',
	);
	console.error(
		'Apply requires CELEBRA_PROD_APPROVAL_TOKEN and CELEBRA_PROD_APPROVAL_PUBLIC_KEY after reviewing the dry-run output.',
	);
}

// ── Mode validation ──────────────────────────────────────────────────────
// Exactly one of --dry-run or --apply is required.

if (dryRun && apply) {
	console.error('Cannot specify both --dry-run and --apply. Choose one mode.');
	process.exit(1);
}

if (!dryRun && !apply) {
	printUsage();
	console.error('       Specify --dry-run (lint only) or --apply (execute after validation).');
	process.exit(1);
}

// ── File validation ──────────────────────────────────────────────────────

if (!file || file === '--help' || file === '-h') {
	printUsage();
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

// ── Dry-run stops here ───────────────────────────────────────────────────

if (dryRun) {
	console.info(`Production patch dry-run passed lint: ${path}`);
	console.info('No database connection was opened and no SQL was executed.');
	console.info(
		'Disposition: RESTRICT_OWNER_ONLY specialized maintenance — not invitation:promote and not db:prod:migrate.',
	);
	process.exit(0);
}

// ── --apply mode (owner-only) ────────────────────────────────────────────

let validatedOwnerId: string;
try {
	validatedOwnerId = validateOwnerUserId(ownerUserId);
} catch (error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exit(1);
}

const rawSupabaseUrl = process.env.SUPABASE_URL || '';
if (!rawSupabaseUrl) {
	console.error('SUPABASE_URL environment variable is required for --apply.');
	process.exit(1);
}
if (rawSupabaseUrl.startsWith('postgresql://')) {
	console.error(
		'SUPABASE_URL must be the Supabase API URL (https://<project>.supabase.co), not a PostgreSQL connection string. ' +
			'Set PROD_DB_URL for the database connection string.',
	);
	process.exit(1);
}
let normalizedUrl: string;
try {
	normalizedUrl = validateAndNormalizeSupabaseUrl(rawSupabaseUrl);
} catch (error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exit(1);
}

const { url: dbUrl } = getProdDbUrl();

try {
	assertSameSupabaseProject(normalizedUrl, dbUrl);
} catch (error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exit(1);
}

const ownerConfig = `SELECT set_config('app.owner_user_id', '${validatedOwnerId.replace(/'/g, "''")}', false);\n`;
const urlConfig = `SELECT set_config('app.supabase_project_url', '${normalizedUrl.replace(/'/g, "''")}', false);\n`;
const fullSql = ownerConfig + urlConfig + sql;

const manifestFingerprint = createHash('sha256')
	.update(`${file}\u001f${validatedOwnerId}\u001f${normalizedUrl}\u001f${fullSql}`)
	.digest('hex');

requireProductionConfirmationSync(new URL(dbUrl).hostname, undefined, {
	operationType: 'production_patch',
	scope: validatedOwnerId,
	manifestFingerprint,
	consumeApproval: (payload) => consumeProductionApproval({ dbUrl, payload }),
});

const execResult = runPsql(fullSql, dbUrl, [normalizedUrl, dbUrl]);

if (execResult.status !== 0) {
	console.error(`Production patch failed (exit ${execResult.status}):`);
	console.error(execResult.stderr || execResult.stdout);
	process.exit(1);
}

console.info(`Owner UUID validated and applied: ${validatedOwnerId}`);
console.info(`Production patch applied successfully: ${file}`);
if (execResult.stdout) console.info(execResult.stdout);
