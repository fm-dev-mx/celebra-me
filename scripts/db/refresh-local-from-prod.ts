import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	STORAGE_BUCKET_SIZE_LIMIT,
	assertAppEnvIsLocal,
	assertLocalApiReachable,
	assertLocalDbReachable,
	assertNoProdCredentialsInLocalEnv,
	assertProductionDbUrl,
	createProdBackup,
	ensureDir,
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
	validateAuthOrphans,
	writeTextFile,
} from './db-workflow-lib.ts';

const STAGING_SCHEMA = 'refresh_staging';

function transformDumpForStaging(inputPath: string, outputPath: string): void {
	const rawDump = readFileSync(inputPath, 'utf8');
	const transformed = rawDump
		.replace(/\bpublic\./g, `${STAGING_SCHEMA}.`)
		.replace(/SET search_path = public,/g, `SET search_path = ${STAGING_SCHEMA},`);
	writeTextFile(outputPath, transformed);
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
		createProdBackup(prodDbUrl, dumpPath, false);
		log(`- Dump created: ${dumpPath}`);

		log('- Resetting local Supabase database (local-only destructive action)');
		runCommand('supabase', ['db', 'reset', '--local', '--yes']);

		prepareStagingSchema();
		transformDumpForStaging(dumpPath, stagingDumpPath);
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
				},
				null,
				2,
			),
		);

		const summary = runPsql(`
select table_name, row_count::text
from (
  select 'invitations' table_name, count(*) row_count from public.invitations
  union all select 'events', count(*) from public.events
  union all select 'guest_invitations', count(*) from public.guest_invitations
  union all select 'invitation_assets', count(*) from public.invitation_assets
) rows
order by table_name;
`).stdout.trim();

		log('Refresh complete');
		log(`- UUID report: ${uuidMapPath}`);
		log(`- Row summary:\n${summary}`);
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
			log(`WARNING: Refresh failed. Diagnostic dumps preserved at: ${failedDir}`);
			log('WARNING: These files may contain production data. Do NOT commit them.');
		}
	}
}

main().catch((error: unknown) => {
	fail(error instanceof Error ? error.message : String(error));
});
