import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	LOCAL_DB_URL,
	REFRESH_PARITY_TABLES,
	STORAGE_BUCKET_SIZE_LIMIT,
	assertAppEnvIsLocal,
	assertLocalApiReachable,
	assertLocalDbReachable,
	assertNoProdCredentialsInLocalEnv,
	assertProductionDbUrl,
	countTableRows,
	createProdBackup,
	ensureDir,
	ensureTablesExist,
	fail,
	getProdDbUrl,
	loadAppEnv,
	log,
	redactDbUrl,
	runCommand,
	runPsql,
	runPsqlFile,
	sqlLiteral,
	timestamp,
	transformDumpForStaging,
	validateAuthOrphans,
	validateRefreshParity,
	writeTextFile,
} from './db-workflow-lib.ts';

const STAGING_SCHEMA = 'refresh_staging';

function transformDumpForStagingFile(inputPath: string, outputPath: string): void {
	const input = readFileSync(inputPath, 'utf8');
	const output = transformDumpForStaging(input, STAGING_SCHEMA);
	writeTextFile(outputPath, output);
}

function prepareStagingSchema(): void {
	runPsql(`
drop schema if exists ${STAGING_SCHEMA} cascade;
create schema ${STAGING_SCHEMA};

do $$
declare
  table_record record;
begin
  for table_record in
    select tablename
    from pg_tables
    where schemaname = 'public'
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
}

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));

function loadCopySql(): string {
	const template = readFileSync(resolve(SCRIPT_DIR, 'sql', 'refresh-copy.sql'), 'utf8');
	const replaced = template
		.replaceAll('__STAGING_SCHEMA__', STAGING_SCHEMA)
		.replaceAll('__STORAGE_BUCKET_SIZE_LIMIT__', String(STORAGE_BUCKET_SIZE_LIMIT));
	const unresolved = replaced.match(/__[A-Z_]+__/g);
	if (unresolved) {
		fail(
			`refresh-copy.sql contains unresolved placeholder(s): ${unresolved.join(', ')}. ` +
				'Update loadCopySql() to replace them.',
		);
	}
	return replaced;
}

function printCountTable(label: string, counts: Record<string, number>): void {
	const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
	const rows = entries.map(([table, count]) => `  ${table}: ${count}`).join('\n');
	log(`\n${label}:\n${rows}`);
}

function runPostRefreshRepairs(): void {
	log('\n--- Running post-refresh content repairs ---');

	const migrationsDir = resolve(SCRIPT_DIR, '..', '..', 'supabase', 'migrations');
	const repairMigrations = [
		'20260608000001_correct_icon_migration_preflight.sql',
		'20260608000002_normalize_itinerary_times.sql',
		'20260608000003_normalize_indication_icon_names.sql',
	];

	for (const migrationFile of repairMigrations) {
		const migrationPath = resolve(migrationsDir, migrationFile);
		if (!existsSync(migrationPath)) {
			log(`  SKIP: ${migrationFile} not found`);
			continue;
		}
		log(`  Applying: ${migrationFile}`);
		// Wrap in single transaction so ON COMMIT DROP temp tables survive
		// across statements (psql defaults to auto-commit otherwise).
		const result = runPsql(`BEGIN;\n${readFileSync(migrationPath, 'utf8')}\nCOMMIT;`);
		if (result.status !== 0) {
			log(`  WARN: ${migrationFile} exited with status ${result.status}`);
			if (result.stdout) log(result.stdout);
			if (result.stderr) log(result.stderr);
		} else {
			log(`  OK: ${migrationFile}`);
		}
	}

	log('--- Post-refresh repairs complete ---');
}

interface SetupResult {
	isReuse: boolean;
	dumpPath: string;
	stagingDumpPath: string;
	uuidMapPath: string;
	stamp: string;
	sourceCounts: Record<string, number> | undefined;
}

function resolveSetup(): SetupResult {
	const index = process.argv.indexOf('--reuse-dump');
	if (index !== -1) {
		const providedPath = process.argv[index + 1];
		if (!providedPath) fail('--reuse-dump requires a path argument: --reuse-dump <path>');

		const dumpPath = resolve(process.cwd(), providedPath);
		const tmpDbDir = resolve(process.cwd(), '.tmp', 'db');
		if (!dumpPath.toLowerCase().startsWith(tmpDbDir.toLowerCase())) {
			fail(`--reuse-dump path must be inside ${tmpDbDir}`);
		}
		if (!existsSync(dumpPath)) fail(`--reuse-dump file not found: ${dumpPath}`);

		const stamp = timestamp();
		log('Refresh local DB from production');
		log('- PRODUCTION CONTACT: SKIPPED (--reuse-dump mode)');
		log(`- Reusing existing dump: ${dumpPath}`);
		log('- Local action: destructive reset of local Supabase only');

		return {
			isReuse: true,
			dumpPath,
			stagingDumpPath: resolve(tmpDbDir, `prod-public-data-staging-${stamp}.sql`),
			uuidMapPath: resolve(tmpDbDir, `uuid-map-${stamp}.json`),
			stamp,
			sourceCounts: undefined,
		};
	}

	const { url: prodDbUrl, source } = getProdDbUrl();
	assertProductionDbUrl(prodDbUrl);
	const stamp = timestamp();
	const dumpPath = resolve(process.cwd(), '.tmp', 'db', `prod-public-data-${stamp}.sql`);
	const stagingDumpPath = resolve(
		process.cwd(),
		'.tmp',
		'db',
		`prod-public-data-staging-${stamp}.sql`,
	);
	const uuidMapPath = resolve(process.cwd(), '.tmp', 'db', `uuid-map-${stamp}.json`);

	log('Refresh local DB from production');
	log('- Production access: read-only dump');
	log('- Local action: destructive reset of local Supabase only');
	log(`- PROD_DB_URL source: ${source}`);
	log(`- Production target: ${redactDbUrl(prodDbUrl)}`);

	log('- Capturing production row counts before dump');
	ensureTablesExist(REFRESH_PARITY_TABLES, 'public', prodDbUrl, 'production');
	const sourceCounts = countTableRows(REFRESH_PARITY_TABLES, 'public', prodDbUrl);
	printCountTable('Production (source) row counts', sourceCounts);

	createProdBackup(prodDbUrl, dumpPath, false);
	log(`- Dump created: ${dumpPath}`);

	return { isReuse: false, dumpPath, stagingDumpPath, uuidMapPath, stamp, sourceCounts };
}

function cleanupOnSuccess(dumpPath: string, stagingDumpPath: string, isReuse: boolean): void {
	for (const tempFile of [stagingDumpPath]) {
		if (existsSync(tempFile)) rmSync(tempFile);
	}
	if (!isReuse && existsSync(dumpPath)) rmSync(dumpPath);
}

function cleanupOnFailure(
	dumpPath: string,
	stagingDumpPath: string,
	stamp: string,
	isReuse: boolean,
): void {
	const failedDir = resolve(process.cwd(), '.tmp', 'db', 'failed', stamp);
	ensureDir(failedDir);
	if (existsSync(stagingDumpPath)) {
		const dest = resolve(failedDir, basename(stagingDumpPath));
		rmSync(dest, { force: true });
		renameSync(stagingDumpPath, dest);
	}
	if (!isReuse && existsSync(dumpPath)) {
		const dest = resolve(failedDir, basename(dumpPath));
		rmSync(dest, { force: true });
		renameSync(dumpPath, dest);
	}
	log(
		'WARNING: Refresh failed or validation failed. Diagnostic dumps preserved at: ' + failedDir,
	);
	log('WARNING: These files may contain production data (check before committing).');
}

function validateAgainstProduction(sourceCounts: Record<string, number>): void {
	const publicCounts = countTableRows(REFRESH_PARITY_TABLES, 'public');
	printCountTable('Local public (after copy) row counts', publicCounts);

	const parity = validateRefreshParity({
		sourceCounts,
		targetCounts: publicCounts,
		maxDeltas: { app_user_roles: 1 },
	});
	if (!parity.ok) {
		for (const f of parity.failures)
			log(
				`  FAIL parity ${f.table}: source=${f.sourceCount} local=${f.targetCount} (${f.reason})`,
			);
		fail(
			`Post-refresh parity guard failed: ${parity.failures.length} table(s) with count mismatch. Diagnostic dumps preserved.`,
		);
	}
}

async function main(): Promise<void> {
	const appEnv = loadAppEnv();
	assertNoProdCredentialsInLocalEnv();
	assertAppEnvIsLocal(appEnv);
	assertLocalApiReachable();
	assertLocalDbReachable();

	const { isReuse, dumpPath, stagingDumpPath, uuidMapPath, stamp, sourceCounts } = resolveSetup();

	let refreshSucceeded = false;
	try {
		log('- Resetting local Supabase database (local-only destructive action)');
		runCommand('supabase', ['db', 'reset', '--local', '--yes']);

		prepareStagingSchema();
		transformDumpForStagingFile(dumpPath, stagingDumpPath);
		runPsqlFile(stagingDumpPath);

		const localSuperAdminPassword =
			appEnv.LOCAL_SUPER_ADMIN_PASSWORD || appEnv.RSVP_ADMIN_PASSWORD || '';
		runPsql(
			`
select set_config('app.local_super_admin_emails', ${sqlLiteral(appEnv.SUPER_ADMIN_EMAILS ?? '')}, false);
select set_config('app.local_super_admin_password', ${sqlLiteral(localSuperAdminPassword)}, false);
select set_config('app.local_admin_alias', ${sqlLiteral(appEnv.RSVP_ADMIN_USER ?? '')}, false);
${loadCopySql()}
`,
			undefined,
			[localSuperAdminPassword],
		);

		runPostRefreshRepairs();
		validateAuthOrphans();

		ensureTablesExist(REFRESH_PARITY_TABLES, 'public', LOCAL_DB_URL, 'local');
		if (sourceCounts) {
			validateAgainstProduction(sourceCounts);
		} else {
			log('- SKIP: parity validation (no production source counts in --reuse-dump mode)');
		}

		writeTextFile(
			uuidMapPath,
			JSON.stringify(
				{
					createdAt: new Date().toISOString(),
					strategy: isReuse
						? 'reused-existing-dump-no-production-contact'
						: 'preserve-production-public-uuids-locally',
					dumpPath,
					stagingDumpPath,
					sourceCounts: sourceCounts ?? null,
				},
				null,
				2,
			),
		);

		log('Refresh complete');
		log(`- UUID report: ${uuidMapPath}`);
		refreshSucceeded = true;
	} finally {
		if (refreshSucceeded) {
			cleanupOnSuccess(dumpPath, stagingDumpPath, isReuse);
		} else {
			cleanupOnFailure(dumpPath, stagingDumpPath, stamp, isReuse);
		}
	}
}

main().catch((error: unknown) => {
	fail(error instanceof Error ? error.message : String(error));
});
