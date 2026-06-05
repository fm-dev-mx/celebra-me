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

async function main(): Promise<void> {
	const appEnv = loadAppEnv();
	assertNoProdCredentialsInLocalEnv();
	assertAppEnvIsLocal(appEnv);
	assertLocalApiReachable();
	assertLocalDbReachable();

	const { url: prodDbUrl, source } = getProdDbUrl();
	const target = assertProductionDbUrl(prodDbUrl);
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

	let refreshSucceeded = false;
	try {
		log('- Capturing production row counts before dump');
		ensureTablesExist(REFRESH_PARITY_TABLES, 'public', prodDbUrl, 'production');
		const sourceCounts = countTableRows(REFRESH_PARITY_TABLES, 'public', prodDbUrl);
		printCountTable('Production (source) row counts', sourceCounts);

		createProdBackup(prodDbUrl, dumpPath, false);
		log(`- Dump created: ${dumpPath}`);

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

		validateAuthOrphans();

		ensureTablesExist(REFRESH_PARITY_TABLES, 'public', LOCAL_DB_URL, 'local');
		const publicCounts = countTableRows(REFRESH_PARITY_TABLES, 'public');
		printCountTable('Local public (after copy) row counts', publicCounts);

		const parity = validateRefreshParity({
			sourceCounts,
			targetCounts: publicCounts,
			// app_user_roles gets an extra row locally for the super-admin user
			// that refresh-copy.sql inserts after copying production data.
			maxDeltas: { app_user_roles: 1 },
		});

		if (!parity.ok) {
			for (const f of parity.failures) {
				log(
					`  FAIL parity ${f.table}: source=${f.sourceCount} local=${f.targetCount} (${f.reason})`,
				);
			}
			fail(
				`Post-refresh parity guard failed: ${parity.failures.length} table(s) with count mismatch. ` +
					'Diagnostic dumps preserved.',
			);
		}

		writeTextFile(
			uuidMapPath,
			JSON.stringify(
				{
					createdAt: new Date().toISOString(),
					strategy: 'preserve-production-public-uuids-locally',
					remapped: false,
					authUsers: {
						productionReferencedUsers:
							'preserved by UUID with local-only placeholder emails',
						localSuperAdmin:
							(appEnv.SUPER_ADMIN_EMAILS ?? '').split(',')[0]?.trim() || null,
					},
					dumpPath,
					stagingDumpPath,
					productionHost: target.hostname,
					sourceCounts,
					publicCounts,
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
			for (const tempFile of [dumpPath, stagingDumpPath]) {
				if (existsSync(tempFile)) rmSync(tempFile);
			}
		} else {
			const failedDir = resolve(process.cwd(), '.tmp', 'db', 'failed', stamp);
			for (const tempFile of [dumpPath, stagingDumpPath]) {
				if (existsSync(tempFile)) {
					const destPath = resolve(failedDir, basename(tempFile));
					ensureDir(failedDir);
					rmSync(destPath, { force: true });
					renameSync(tempFile, destPath);
				}
			}
			log(
				`WARNING: Refresh failed or parity validation failed. Diagnostic dumps preserved at: ${failedDir}`,
			);
			log('WARNING: These files may contain production data. Do NOT commit them.');
		}
	}
}

main().catch((error: unknown) => {
	fail(error instanceof Error ? error.message : String(error));
});
