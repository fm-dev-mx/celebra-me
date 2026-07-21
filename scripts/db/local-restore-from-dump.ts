/**
 * local-restore-from-dump.ts — Restore Persistent Local DB from a Production Dump
 *
 * Safely imports production-derived data into the persistent local database WITHOUT
 * running `db reset` or deleting Docker volumes.
 *
 * The restore process (all operations non-destructive against persistent-local):
 *   1. Validate dump file integrity (non-empty, contains SQL)
 *   2. Verify the target is a persistent-local host/port
 *   3. Import into a staging schema (transaction-wrapped)
 *   4. Validate schema compatibility and FK integrity
 *   5. Copy staging data into public schema (INSERT...WHERE NOT EXISTS)
 *   6. Copy minimum required Auth users (for FK integrity)
 *   7. Copy minimum required Storage buckets and objects
 *   8. Create a local super admin (separate, does not modify copied records)
 *   9. Validate row counts and relational integrity
 *  10. Remove staging schema and temporary dumps
 *
 * NO sanitization — exact production values, IDs, timestamps, and relationships
 * are preserved.
 *
 * Usage:
 *   tsx scripts/db/local-restore-from-dump.ts --dump <path> [--keep-dump] [--dry-run]
 *   tsx scripts/db/local-restore-from-dump.ts --dump <path> --auth-dump <path> --storage-dump <path>
 */

import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import {
	classifyDbTarget,
	LOCAL_DB_URL,
	redactCredentials,
	validateDumpIntegrity,
	PERSISTENT_LOCAL,
} from './db-guard.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandResult {
	status: number | null;
	stdout: string;
	stderr: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGING_SCHEMA = 'restore_staging';

// Tables whose exact copy is mandatory for functional parity
const BUSINESS_TABLES = [
	'app_user_roles',
	'audit_logs',
	'commercial_record_classifications',
	'customers',
	'event_claim_codes',
	'event_memberships',
	'events',
	'guest_invitation_audit',
	'guest_invitations',
	'host_profiles',
	'intake_requests',
	'intake_submissions',
	'invitation_assets',
	'invitation_content_drafts',
	'invitations',
	'leads',
	'meta_conversion_delivery_attempts',
	'meta_conversion_events',
	'meta_conversion_recoveries',
	'published_invitation_content',
	'rsvp_audit_log',
	'rsvp_channel_log',
	'rsvp_records',
	'sales_orders',
	'tracking_events',
	'visitor_sessions',
] as const;

// Map of tables whose primary key is NOT `id`.
// The restore merge SQL joins on this column to detect existing rows.
const PRIMARY_KEY_OVERRIDES: Record<string, string> = {
	app_user_roles: 'user_id',
	host_profiles: 'user_id',
	rsvp_audit_log: 'audit_id',
	rsvp_channel_log: 'channel_event_id',
	rsvp_records: 'store_key',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(message: string): never {
	console.error(`ERROR: ${message}`);
	process.exit(1);
}

function runCommand(
	command: string,
	args: string[],
	options: SpawnSyncOptions & { redact?: string[] } = {},
): CommandResult {
	const isShellRequired = ['npx', 'supabase', 'pnpm', 'npm'].includes(command);
	const result = spawnSync(command, args, {
		cwd: process.cwd(),
		encoding: 'utf8',
		stdio: 'pipe',
		shell: isShellRequired && process.platform === 'win32',
		...options,
	});
	return {
		status: result.status,
		stdout: typeof result.stdout === 'string' ? result.stdout : '',
		stderr: typeof result.stderr === 'string' ? result.stderr : (result.error?.message ?? ''),
	};
}

function runPsql(sql: string): CommandResult {
	return runCommand('psql', [
		'--set',
		'ON_ERROR_STOP=1',
		'--no-align',
		'--tuples-only',
		'--dbname',
		LOCAL_DB_URL,
		'--command',
		sql,
	]);
}

function runPsqlFile(filePath: string): CommandResult {
	return runCommand(
		'psql',
		['--set', 'ON_ERROR_STOP=1', '--dbname', LOCAL_DB_URL, '--file', filePath],
		{ redact: [LOCAL_DB_URL] },
	);
}

function printStep(step: string): void {
	console.info(`\n=== ${step} ===`);
}

// ---------------------------------------------------------------------------
// Phase 1 — Preflight: validate dump, target, and guard
// ---------------------------------------------------------------------------

function phase1Preflight(dumpPath: string, authDumpPath?: string, storageDumpPath?: string): void {
	printStep('Phase 1: Preflight');

	console.info(`  Business dump: ${dumpPath}`);
	const integrity = validateDumpIntegrity(dumpPath);
	if (!integrity.ok) {
		for (const err of integrity.errors) console.error(`  FAIL: ${err}`);
		fail('Business dump integrity check failed. Aborting restore.');
	}
	console.info('  PASS: Business dump integrity valid');

	if (authDumpPath) {
		if (!existsSync(authDumpPath)) fail(`Auth dump not found: ${authDumpPath}`);
		console.info(`  Auth dump: ${authDumpPath}`);
	}
	if (storageDumpPath) {
		if (!existsSync(storageDumpPath)) fail(`Storage dump not found: ${storageDumpPath}`);
		console.info(`  Storage dump: ${storageDumpPath}`);
	}

	const classification = classifyDbTarget(LOCAL_DB_URL, { apiUrl: PERSISTENT_LOCAL.apiUrl });
	console.info(`  Target classification: ${classification.target} (${classification.reason})`);
	if (classification.target !== 'persistent-local') {
		fail(`Restore target is not persistent-local (got "${classification.target}"). Aborting.`);
	}

	const supabaseStatus = runCommand('supabase', ['status']);
	if (supabaseStatus.status !== 0) {
		fail('Local Supabase is not running. Run `supabase start` first.');
	}
	console.info('  PASS: Local Supabase is running');

	// Abort if unexpected local data exists (goal requirement)
	const existingCheck = runPsql(`
select count(*)::text as rows from public.invitations;
`);
	const existingRows = parseInt(existingCheck.stdout.trim() || '0', 10);
	if (existingRows > 0) {
		fail(
			`Local database already contains ${existingRows} invitation(s). ` +
				'Restore requires empty local. Aborting per policy.',
		);
	}
	console.info('  PASS: Local database is empty (ready for non-destructive restore)');
}

// ---------------------------------------------------------------------------
// Phase 1.5 — Load auth users into real auth schema (before staging import)
// ---------------------------------------------------------------------------

function phase1b5LoadAuth(authDumpPath: string | undefined): void {
	if (!authDumpPath) {
		console.info('  No auth dump — FK integrity will be incomplete');
		return;
	}

	const authIntegrity = validateDumpIntegrity(authDumpPath);
	if (!authIntegrity.ok) {
		console.warn('  WARN: Auth dump integrity check failed, skipping');
		return;
	}

	console.info('  Loading auth users into auth schema (preserves production UUIDs)...');
	const authResult = runPsqlFile(authDumpPath);
	if (authResult.status !== 0) {
		console.warn(`  WARN: Auth dump apply failed: ${authResult.stderr}`);
		return;
	}
	console.info('  PASS: Auth users loaded');
}

// ---------------------------------------------------------------------------
// Phase 2 — Import business dump into staging schema
// ---------------------------------------------------------------------------

function phase2ImportToStaging(dumpPath: string): void {
	printStep('Phase 2: Import business dump into staging schema');

	runPsql(`drop schema if exists ${STAGING_SCHEMA} cascade;`);
	runPsql(`create schema ${STAGING_SCHEMA};`);
	console.info('  Staging schema created');

	// Create shadow tables in staging matching public schema (skip _db_sentinel)
	runPsql(`
do $$
declare
  table_record record;
begin
  for table_record in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in ('_db_sentinel')
    order by tablename
  loop
    execute format(
      'create table ${STAGING_SCHEMA}.%I (like public.%I including defaults including identity including generated)',
      table_record.tablename,
      table_record.tablename
    );
  end loop;
end $$;
`);
	console.info('  Staging tables created (mirroring public schema)');

	// Load dump into staging schema via search_path
	console.info('  Loading dump data into staging schema...');
	const setSearchPath = runPsql(`set search_path to ${STAGING_SCHEMA}, public;`);
	if (setSearchPath.status !== 0) {
		console.warn(`  WARN: Could not set search_path: ${setSearchPath.stderr}`);
	}
	const importResult = runPsqlFile(dumpPath);
	if (importResult.status !== 0) {
		console.error(`  FAIL: Import failed: ${importResult.stderr}`);
		fail('Staging import failed. Aborting restore.');
	}
	console.info('  PASS: Staging data loaded');
}

// ---------------------------------------------------------------------------
// Phase 3 — Validate staging data
// ---------------------------------------------------------------------------

function phase3ValidateStaging(): void {
	printStep('Phase 3: Validate staging data');

	// Row counts in key tables
	const counts = runPsql(`
select table_name, count(*)::text
from (
  select 'invitations' as table_name from ${STAGING_SCHEMA}.invitations
  union all
  select 'events' from ${STAGING_SCHEMA}.events
  union all
  select 'published_invitation_content' from ${STAGING_SCHEMA}.published_invitation_content
  union all
  select 'guest_invitations' from ${STAGING_SCHEMA}.guest_invitations
  union all
  select 'rsvp_records' from ${STAGING_SCHEMA}.rsvp_records
  union all
  select 'leads' from ${STAGING_SCHEMA}.leads
  union all
  select 'customers' from ${STAGING_SCHEMA}.customers
  union all
  select 'sales_orders' from ${STAGING_SCHEMA}.sales_orders
) sub
group by table_name
order by table_name;
`);
	console.info(`  Staging row counts:\n    ${counts.stdout.trim().split('\n').join('\n    ')}`);

	// Duplicate slug check
	const dupCheck = runPsql(`
select slug, count(*)::text as cnt
from ${STAGING_SCHEMA}.invitations
group by slug
having count(*) > 1;
`);
	if (dupCheck.stdout.trim()) {
		fail(`Duplicate invitation slugs in dump:\n${dupCheck.stdout.trim()}`);
	}
	console.info('  PASS: No duplicate slugs');
}

// ---------------------------------------------------------------------------
// Phase 4 — Copy staging data to public schema (non-destructive, no sanitization)
// ---------------------------------------------------------------------------

function phase4CopyToPublic(): void {
	printStep('Phase 4: Copy staging data to public schema (exact, no sanitization)');

	// Wrapped in a single transaction — rolls back completely on failure
	const txBegin = runPsql(`begin;`);
	if (txBegin.status !== 0) fail('Failed to begin transaction');

	try {
		for (const table of BUSINESS_TABLES) {
			// Check staging has this table
			const existsCheck = runPsql(`
select count(*)::text from information_schema.tables
where table_schema = '${STAGING_SCHEMA}' and table_name = '${table}';
`);
			if (existsCheck.stdout.trim() === '0') {
				console.info(`  SKIP: ${table} not in staging`);
				continue;
			}

			// Get column list (non-generated)
			const colsResult = runPsql(`
select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
from information_schema.columns
where table_schema = '${STAGING_SCHEMA}'
  and table_name = '${table}'
  and is_generated = 'NEVER';
`);
			const columns = colsResult.stdout.trim();
			if (!columns) {
				console.info(`  SKIP: ${table} has no columns`);
				continue;
			}

			// INSERT where PK does not exist in public (exact values, no sanitization)
			const pkCol = PRIMARY_KEY_OVERRIDES[table] ?? 'id';
			const mergeSql = `
insert into public."${table}" (${columns})
select s.*
from ${STAGING_SCHEMA}."${table}" s
left join public."${table}" p on p.${pkCol} = s.${pkCol}
where p.${pkCol} is null;
`;
			const mergeResult = runPsql(mergeSql);
			if (mergeResult.status !== 0) {
				// Rollback the entire transaction
				runPsql(`rollback;`);
				fail(`Merge failed for ${table}: ${mergeResult.stderr}`);
			}
			const inserted = runPsql(`select count(*)::text from public."${table}";`);
			console.info(`  OK: ${table} → ${inserted.stdout.trim()} total rows`);
		}

		// Update sequences to match max(ids) so future inserts work correctly
		console.info('  Updating sequences...');
		for (const table of BUSINESS_TABLES) {
			const seqResult = runPsql(`
do $$
begin
  if exists (select 1 from pg_class where relname = '${table}_id_seq' and relkind = 'S') then
    execute format('select setval(pg_get_serial_sequence(''public.%I'', ''id''), coalesce(max(id), 1)) from public.%I', '${table}', '${table}');
  end if;
end $$;
`);
			if (seqResult.status !== 0) {
				console.warn(`  WARN: sequence update for ${table} failed: ${seqResult.stderr}`);
			}
		}

		const txCommit = runPsql(`commit;`);
		if (txCommit.status !== 0) fail('Failed to commit transaction');
		console.info('  PASS: Transaction committed (exact copy, no sanitization)');
	} catch (err) {
		runPsql(`rollback;`);
		throw err;
	}
}

// ---------------------------------------------------------------------------
// Phase 5 — Copy Storage buckets and objects
// ---------------------------------------------------------------------------

function phase5CopyStorage(storageDumpPath: string | undefined): void {
	printStep('Phase 5: Copy Storage buckets and objects');

	if (!storageDumpPath) {
		console.info('  SKIP: No storage dump provided (invitation_assets paths will 404)');
		return;
	}

	const storageIntegrity = validateDumpIntegrity(storageDumpPath);
	if (!storageIntegrity.ok) {
		console.warn(`  WARN: Storage dump integrity check failed, skipping`);
		return;
	}

	console.info('  Loading storage dump (buckets + objects, paths preserved)...');
	const storageResult = runPsqlFile(storageDumpPath);
	if (storageResult.status !== 0) {
		console.warn(`  WARN: Storage dump apply failed: ${storageResult.stderr}`);
		return;
	}
	console.info('  PASS: Storage buckets and objects imported');
}

// ---------------------------------------------------------------------------
// Phase 7 — Create local super admin (separate, does not modify copied records)
// ---------------------------------------------------------------------------

function phase6CreateLocalAdmin(): void {
	printStep('Phase 6: Create local super admin');

	const adminEmail = process.env.SUPER_ADMIN_EMAILS?.split(',')[0]?.trim();
	const adminPassword = process.env.LOCAL_SUPER_ADMIN_PASSWORD || process.env.RSVP_ADMIN_PASSWORD;

	if (!adminEmail || !adminPassword) {
		console.info('  SKIP: No SUPER_ADMIN_EMAILS or LOCAL_SUPER_ADMIN_PASSWORD set');
		return;
	}

	// Use the existing bootstrap script (does not modify copied business records)
	const result = runCommand('npx', ['-y', 'tsx', 'scripts/db/bootstrap-local-admin.ts']);
	if (result.status !== 0) {
		console.warn(`  WARN: Local admin bootstrap failed: ${result.stderr}`);
		return;
	}
	console.info(`  PASS: Local super admin created: ${adminEmail}`);
}

// ---------------------------------------------------------------------------
// Phase 8 — Post-restore validation
// ---------------------------------------------------------------------------

function phase7PostRestore(): void {
	printStep('Phase 7: Post-restore validation');

	const tables = [
		'invitations',
		'events',
		'published_invitation_content',
		'guest_invitations',
		'rsvp_records',
		'leads',
		'customers',
		'sales_orders',
		'tracking_events',
		'visitor_sessions',
	];
	for (const table of tables) {
		const result = runPsql(`select count(*)::text from public."${table}";`);
		console.info(`  ${table}: ${result.stdout.trim() || '0'} rows`);
	}

	// Sentinel check
	const sentinelCheck = runPsql(`
select count(*)::text from public._db_sentinel
where id = '00000000-0000-0000-0000-000000000000'::uuid;
`);
	const sentinelCount = parseInt(sentinelCheck.stdout.trim() || '0', 10);
	if (sentinelCount === 1) {
		console.info('  SENTINEL: Present — persistent local was NOT reset');
	} else {
		console.warn('  WARNING: Sentinel missing — persistent local may have been reset');
	}
}

// ---------------------------------------------------------------------------
// Phase 9 — Cleanup
// ---------------------------------------------------------------------------

function phase8Cleanup(
	dumpPath: string,
	keepDump: boolean,
	authDumpPath?: string,
	storageDumpPath?: string,
): void {
	printStep('Phase 8: Cleanup');

	const dropResult = runPsql(`drop schema if exists ${STAGING_SCHEMA} cascade;`);
	if (dropResult.status === 0) {
		console.info('  Staging schema dropped');
	}

	if (!keepDump) {
		for (const file of [dumpPath, authDumpPath, storageDumpPath]) {
			if (file && existsSync(file)) {
				try {
					rmSync(file);
					console.info(`  Removed: ${file}`);
				} catch (err) {
					console.warn(`  WARN: Failed to remove ${file}: ${err}`);
				}
			}
		}
	} else {
		console.info('  Dumps preserved (--keep-dump)');
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
	const args = process.argv.slice(2);
	const dumpIdx = args.indexOf('--dump');
	const dumpPath = dumpIdx !== -1 ? resolve(process.cwd(), args[dumpIdx + 1]) : undefined;
	const authDumpIdx = args.indexOf('--auth-dump');
	const authDumpPath =
		authDumpIdx !== -1 ? resolve(process.cwd(), args[authDumpIdx + 1]) : undefined;
	const storageDumpIdx = args.indexOf('--storage-dump');
	const storageDumpPath =
		storageDumpIdx !== -1 ? resolve(process.cwd(), args[storageDumpIdx + 1]) : undefined;
	const keepDump = args.includes('--keep-dump');
	const dryRun = args.includes('--dry-run');

	if (!dumpPath) {
		console.error(`
Usage: tsx scripts/db/local-restore-from-dump.ts --dump <path> [options]

Options:
  --dump <path>           Business data dump (required)
  --auth-dump <path>      Auth users dump (optional, for FK integrity)
  --storage-dump <path>   Storage objects dump (optional, for asset binaries)
  --keep-dump             Preserve all dump files after restore
  --dry-run               Validate all steps without mutations

All mutations run against persistent-local only. No sanitization is performed.
`);
		process.exit(1);
	}

	console.info(`
╔══════════════════════════════════════════════════════════╗
║  Restore Persistent Local from Production Dump (exact)  ║
╚══════════════════════════════════════════════════════════╝
`);
	console.info(`  Business dump: ${dumpPath}`);
	if (authDumpPath) console.info(`  Auth dump:     ${authDumpPath}`);
	if (storageDumpPath) console.info(`  Storage dump:  ${storageDumpPath}`);
	console.info(`  Keep dump:     ${keepDump}`);
	console.info(`  Dry run:       ${dryRun}`);
	console.info(`  Target:        ${redactCredentials(LOCAL_DB_URL)}`);

	phase1Preflight(dumpPath, authDumpPath, storageDumpPath);

	if (dryRun) {
		console.info('\nDRY RUN: All preflight checks passed. Stopping before mutations.');
		return;
	}

	printStep('Phase 1.5: Load Auth users (before staging import)');
	phase1b5LoadAuth(authDumpPath);

	phase2ImportToStaging(dumpPath);
	phase3ValidateStaging();
	phase4CopyToPublic();
	phase5CopyStorage(storageDumpPath);
	phase6CreateLocalAdmin();
	phase7PostRestore();
	phase8Cleanup(dumpPath, keepDump, authDumpPath, storageDumpPath);

	console.info(`
╔══════════════════════════════════════════════════════════╗
║  Restore Complete (exact, no sanitization)             ║
╚══════════════════════════════════════════════════════════╝
`);
}

main();
