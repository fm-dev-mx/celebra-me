import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	assertAppEnvIsLocal,
	assertLocalApiReachable,
	assertLocalDbReachable,
	assertNoProdCredentialsInLocalEnv,
	assertProductionDbUrl,
	fail,
	getProdDbUrl,
	loadAppEnv,
	redactDbUrl,
	runCommand,
	runPsql,
	runPsqlFile,
	sqlLiteral,
	timestamp,
	transformDumpForStaging,
	tryRunCommand,
	writeTextFile,
} from './db-workflow-lib.ts';
import {
	BACKUP_DIR,
	PRESERVE_OUTPUT_DIR,
	buildDryRunReport,
	checkOrphanedRefs,
	checkOverlappingSlugsMatchProduction,
	checkStorageReferences,
	createAuthUserPlaceholders,
	createExportDump,
	createExportManifest,
	detectLocalOnlySlugs,
	formatDryRunReport,
	restoreFromDump,
	tracePreservedRows,
	validateExportDump,
	validatePreservedData,
} from './preserve-local-lib.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FLAGS = {
	dryRun: process.argv.includes('--dry-run'),
	export: process.argv.includes('--export'),
	confirm: process.argv.includes('--confirm'),
};

function hasFlagConflict(): boolean {
	const set = new Set<string>();
	if (FLAGS.dryRun) set.add('--dry-run');
	if (FLAGS.export) set.add('--export');
	if (FLAGS.confirm) set.add('--confirm');
	return set.size > 1;
}

// ----------------------------------------------------------------
// Phase 0 — Preflight
// ----------------------------------------------------------------
function phase0Preflight(): { prodDbUrl: string; stamp: string } {
	console.info('=== Phase 0: Preflight ===\n');

	if (hasFlagConflict()) {
		fail('Use exactly one of --dry-run, --export, or --confirm.');
	}

	const appEnv = loadAppEnv();
	assertNoProdCredentialsInLocalEnv();
	assertAppEnvIsLocal(appEnv);
	assertLocalApiReachable();
	assertLocalDbReachable();

	const backupFiles = [
		resolve(BACKUP_DIR, 'local-full.dump'),
		resolve(BACKUP_DIR, 'prod-full.dump'),
		resolve(BACKUP_DIR, 'local-full.sql'),
		resolve(BACKUP_DIR, 'prod-full.sql'),
	];
	for (const f of backupFiles) {
		if (!existsSync(f)) {
			fail(`Backup file not found: ${f}`);
		}
	}

	for (const f of backupFiles) {
		if (f.endsWith('.dump')) {
			const result = tryRunCommand('pg_restore', ['--list', f]);
			if (result.status !== 0) {
				fail(`Backup dump is not readable: ${f}`);
			}
		}
	}

	console.info('- Backup dumps verified: all 4 files exist and are readable');

	const { url: prodDbUrl, source } = getProdDbUrl();
	assertProductionDbUrl(prodDbUrl);
	console.info(`- PROD_DB_URL source: ${source}`);
	console.info(`- Production target: ${redactDbUrl(prodDbUrl)}`);

	const probe = tryRunCommand('psql', [
		'--set',
		'ON_ERROR_STOP=1',
		'--dbname',
		prodDbUrl,
		'--command',
		'select 1 as ok;',
	]);
	if (probe.status !== 0) {
		fail(`Production DB not reachable: ${probe.stderr.trim() || `exit code ${probe.status}`}`);
	}
	console.info('- Production DB reachable (read-only query OK)');

	const stamp = timestamp();
	console.info(`- Timestamp: ${stamp}`);
	console.info('');
	return { prodDbUrl, stamp };
}

// ----------------------------------------------------------------
// Phase 1 — Detect local-only identities
// ----------------------------------------------------------------
function phase1Detect(slugDiff: ReturnType<typeof detectLocalOnlySlugs>): string[] {
	console.info('=== Phase 1: Detect Local-Only Identities ===\n');
	const ambiguous: string[] = [];

	const tableSlugInfo = [
		{ name: 'invitations', slugs: slugDiff.invitations },
		{ name: 'events', slugs: slugDiff.events },
		{ name: 'published_invitation_content', slugs: slugDiff.published },
	];

	for (const { name, slugs } of tableSlugInfo) {
		console.info(`  ${name}:`);
		console.info(`    local-only: ${slugs.localOnly.length}`);
		console.info(`    overlapping: ${slugs.overlapping.length}`);
		console.info(`    prod-only: ${slugs.prodOnly.length}`);

		const nullSlugs = checkNullSlugs(name);
		if (nullSlugs > 0) {
			ambiguous.push(
				`${name}: ${nullSlugs} row(s) with null slug (not preserved automatically)`,
			);
		}

		for (const s of slugs.localOnly) {
			if (s.eventType === null && name === 'published_invitation_content') {
				ambiguous.push(`Published slug "${s.slug}" has null event_type — may be ambiguous`);
			}
		}
	}

	if (ambiguous.length > 0) {
		console.info('\n  Ambiguous cases:');
		for (const a of ambiguous) {
			console.info(`    ${a}`);
		}
	}

	console.info('');
	return ambiguous;
}

function checkNullSlugs(table: string): number {
	const qualified = `"${table}"`;
	const result = runPsql(`select count(*)::text from public.${qualified} where slug is null;`);
	return parseInt(result.stdout.trim(), 10) || 0;
}

// ----------------------------------------------------------------
// Phase 2 — Trace dependent rows
// ----------------------------------------------------------------
function phase2Trace(
	slugDiff: ReturnType<typeof detectLocalOnlySlugs>,
	ambiguous: string[],
): {
	preservedRows: Record<string, { id: string }[]>;
	authUserIds: string[];
	risks: string[];
} {
	console.info('=== Phase 2: Trace Dependent Rows ===\n');

	const risks: string[] = [];
	const { preservedRows, authUserIds } = tracePreservedRows(slugDiff);

	const invCount = preservedRows.invitations?.length ?? 0;
	const evCount = preservedRows.events?.length ?? 0;
	if (evCount > 0 && invCount === 0) {
		risks.push(
			`${evCount} local-only event(s) preserved but 0 invitations — events without linked invitations may be orphaned`,
		);
	}

	if (authUserIds.length > 0) {
		risks.push(
			`${authUserIds.length} auth user(s) referenced by preserved rows — placeholders will be created`,
		);
	}

	if (slugDiff.invitations.overlapping.length > 0 || slugDiff.events.overlapping.length > 0) {
		risks.push(
			`${slugDiff.invitations.overlapping.length + slugDiff.events.overlapping.length} overlapping slug(s) — production data will overwrite local versions`,
		);
	}

	if (ambiguous.length > 0) {
		risks.push(`${ambiguous.length} ambiguous case(s) — review before confirm`);
	}

	console.info(`  invitations: ${invCount}`);
	console.info(`  events: ${evCount}`);
	for (const [table, rows] of Object.entries(preservedRows)) {
		if (table === 'invitations' || table === 'events') continue;
		if (rows?.length) {
			console.info(`  ${table}: ${rows.length}`);
		}
	}
	console.info(`  auth user references: ${authUserIds.length}`);
	console.info('');

	return { preservedRows, authUserIds, risks };
}

// ----------------------------------------------------------------
// Phase 3 — Dry-run report
// ----------------------------------------------------------------
function phase3DryRun(
	slugDiff: ReturnType<typeof detectLocalOnlySlugs>,
	preservedRows: Record<string, { id: string }[]>,
	authUserIds: string[],
	risks: string[],
	ambiguous: string[],
	stamp: string,
): void {
	console.info('=== Phase 3: Dry-Run Report ===\n');

	const storageRefs = checkStorageReferences(slugDiff, preservedRows);
	const report = buildDryRunReport(
		slugDiff,
		preservedRows,
		storageRefs,
		authUserIds,
		risks,
		ambiguous,
	);
	console.info(formatDryRunReport(report));

	console.info(`Export would write to:`);
	console.info(`  ${resolve(PRESERVE_OUTPUT_DIR, `preserve-local-${stamp}.sql`)}`);
	console.info(`  ${resolve(PRESERVE_OUTPUT_DIR, `preserve-local-${stamp}.manifest.json`)}`);
	console.info('');
}

// ----------------------------------------------------------------
// Phase 4 — Export preserve bundle
// ----------------------------------------------------------------
function phase4Export(
	slugDiff: ReturnType<typeof detectLocalOnlySlugs>,
	preservedRows: Record<string, { id: string }[]>,
	authUserIds: string[],
	risks: string[],
	ambiguous: string[],
	stamp: string,
): string {
	console.info('=== Phase 4: Export Preserve Bundle ===\n');

	const storageRefs = checkStorageReferences(slugDiff, preservedRows);
	const report = buildDryRunReport(
		slugDiff,
		preservedRows,
		storageRefs,
		authUserIds,
		risks,
		ambiguous,
	);
	console.info(formatDryRunReport(report));

	const exportPath = createExportDump(preservedRows, PRESERVE_OUTPUT_DIR, stamp);
	console.info(`Export file: ${exportPath}`);

	validateExportDump(exportPath);
	console.info('Export dump validated successfully');

	const manifestPath = createExportManifest(
		slugDiff,
		preservedRows,
		storageRefs,
		authUserIds,
		exportPath,
		stamp,
	);
	console.info(`Manifest file: ${manifestPath}`);
	console.info('');

	return exportPath;
}

// ----------------------------------------------------------------
// Phase 5 — Storage binary check
// ----------------------------------------------------------------
function phase5StorageCheck(
	slugDiff: ReturnType<typeof detectLocalOnlySlugs>,
	preservedRows: Record<string, { id: string }[]>,
): string[] {
	console.info('=== Phase 5: Storage Binary Check ===\n');

	const storageRefs = checkStorageReferences(slugDiff, preservedRows);
	const missingBinaries: string[] = [];

	const unresolved = storageRefs.filter((r) => r.status === 'unresolved');
	const localStorage = storageRefs.filter((r) => r.status === 'local_storage');

	for (const ref of unresolved) {
		missingBinaries.push(
			`[${ref.invitationSlug}] ${ref.storagePath} (bucket: ${ref.bucket}) — status: unresolved`,
		);
	}

	for (const ref of localStorage) {
		const exists = checkLocalStorageObject(ref.bucket, ref.storagePath);
		if (!exists) {
			missingBinaries.push(
				`[${ref.invitationSlug}] ${ref.storagePath} (bucket: ${ref.bucket}) — not found in local Storage`,
			);
		}
	}

	if (missingBinaries.length > 0) {
		console.info('Missing Storage binaries (will be reported as risk):');
		for (const m of missingBinaries) {
			console.info(`  ${m}`);
		}
	} else {
		console.info('All Storage references resolve or are static assets.');
	}

	console.info('');
	return missingBinaries;
}

function checkLocalStorageObject(bucket: string, path: string): boolean {
	const result = tryRunCommand('curl', [
		'-s',
		'-o',
		'/dev/null',
		'-w',
		'%{http_code}',
		`http://127.0.0.1:54321/storage/v1/object/${bucket}/${path}`,
	]);
	return result.stdout.trim() === '200';
}

// ----------------------------------------------------------------
// Phase 6 — Refresh local from production
// ----------------------------------------------------------------
function phase6Refresh(prodDbUrl: string): void {
	console.info('=== Phase 6: Refresh Local from Production ===\n');

	console.info('- Resetting local Supabase database (local-only destructive action)');
	runCommand('supabase', ['db', 'reset', '--local', '--yes']);
	console.info('- Local DB reset complete');

	const stamp = timestamp();
	const dumpPath = resolve(process.cwd(), '.tmp', 'db', `prod-public-data-${stamp}.sql`);
	const stagingDumpPath = resolve(
		process.cwd(),
		'.tmp',
		'db',
		`prod-public-data-staging-${stamp}.sql`,
	);

	console.info('- Creating production dump (read-only)');
	runCommand(
		'supabase',
		[
			'db',
			'dump',
			'--db-url',
			prodDbUrl,
			'--schema',
			'public',
			'--data-only',
			'--use-copy',
			'-f',
			dumpPath,
		],
		{ redact: [prodDbUrl] },
	);
	console.info(`- Production dump: ${dumpPath}`);

	const stagingSchema = 'refresh_staging';
	runPsql(`
drop schema if exists ${stagingSchema} cascade;
create schema ${stagingSchema};
do $$
declare
  table_record record;
begin
  for table_record in
    select tablename from pg_tables where schemaname = 'public' order by tablename
  loop
    execute format(
      'create table ${stagingSchema}.%I (like public.%I including defaults including identity including generated)',
      table_record.tablename, table_record.tablename
    );
  end loop;
end $$;
`);

	const dumpSql = readFileSync(dumpPath, 'utf8');
	const stagingSql = transformDumpForStaging(dumpSql, stagingSchema);
	writeTextFile(stagingDumpPath, stagingSql);
	runPsqlFile(stagingDumpPath);
	console.info('- Staging data loaded');

	const appEnv = loadAppEnv();
	const localSuperAdminPassword =
		appEnv.LOCAL_SUPER_ADMIN_PASSWORD || appEnv.RSVP_ADMIN_PASSWORD || '';

	const copySql = loadCopySql(stagingSchema);
	const sqlToRun = `
select set_config('app.local_super_admin_emails', ${sqlLiteral(appEnv.SUPER_ADMIN_EMAILS ?? '')}, false);
select set_config('app.local_super_admin_password', ${sqlLiteral(localSuperAdminPassword)}, false);
select set_config('app.local_admin_alias', ${sqlLiteral(appEnv.RSVP_ADMIN_USER ?? '')}, false);
${copySql}
`;
	runPsql(sqlToRun, undefined, [localSuperAdminPassword]);
	console.info('- Copy from staging to public complete');
	console.info('');
}

function loadCopySql(stagingSchema: string): string {
	const templatePath = resolve(__dirname, 'sql', 'refresh-copy.sql');
	const template = readFileSync(templatePath, 'utf8');
	const replaced = template
		.replaceAll('__STAGING_SCHEMA__', stagingSchema)
		.replaceAll('__STORAGE_BUCKET_SIZE_LIMIT__', '10485760');
	const unresolved = replaced.match(/__[A-Z_]+__/g);
	if (unresolved) {
		fail(`refresh-copy.sql contains unresolved placeholder(s): ${unresolved.join(', ')}`);
	}
	return replaced;
}

// ----------------------------------------------------------------
// Phase 7 — Restore preserved local-only data
// ----------------------------------------------------------------
function phase7Restore(exportPath: string, authUserIds: string[]): void {
	console.info('=== Phase 7: Restore Preserved Local-Only Data ===\n');

	createAuthUserPlaceholders(authUserIds);
	console.info(`- Created ${authUserIds.length} auth user placeholders`);

	restoreFromDump(exportPath);
	console.info('');
}

// ----------------------------------------------------------------
// Phase 8 — Post-restore validation
// ----------------------------------------------------------------
function phase8Validate(
	slugDiff: ReturnType<typeof detectLocalOnlySlugs>,
	preservedRows: Record<string, { id: string }[]>,
): void {
	console.info('=== Phase 8: Post-Restore Validation ===\n');

	const issues: string[] = [];

	const preservedIssues = validatePreservedData(slugDiff);
	issues.push(...preservedIssues);

	const orphanIssues = checkOrphanedRefs(preservedRows);
	issues.push(...orphanIssues);

	const overlapIssues = checkOverlappingSlugsMatchProduction();
	issues.push(...overlapIssues);

	if (issues.length === 0) {
		console.info('All validation checks passed.');
	} else {
		for (const issue of issues) {
			console.info(`  FAIL: ${issue}`);
		}
		fail(`${issues.length} validation check(s) failed.`);
	}

	console.info('');
}

// ----------------------------------------------------------------
// Main entrypoint
// ----------------------------------------------------------------
async function main(): Promise<void> {
	const { prodDbUrl, stamp } = phase0Preflight();

	const slugDiff = detectLocalOnlySlugs(prodDbUrl);
	const ambiguous = phase1Detect(slugDiff);

	const { preservedRows, authUserIds, risks } = phase2Trace(slugDiff, ambiguous);

	const allRisks = [...risks];
	const missingBinaries = phase5StorageCheck(slugDiff, preservedRows);
	if (missingBinaries.length > 0) {
		allRisks.push(
			`${missingBinaries.length} Storage binary(ies) missing — metadata will be preserved but binaries may be unavailable`,
		);
	}

	if (FLAGS.dryRun) {
		phase3DryRun(slugDiff, preservedRows, authUserIds, allRisks, ambiguous, stamp);
		console.info('=== Dry-Run Complete (no changes made) ===');
		return;
	}

	if (FLAGS.export) {
		phase4Export(slugDiff, preservedRows, authUserIds, allRisks, ambiguous, stamp);
		console.info('=== Export Complete ===');
		return;
	}

	if (FLAGS.confirm) {
		const hasCollision = ambiguous.some(
			(a) => a.includes('may be ambiguous') || a.includes('collision'),
		);
		if (hasCollision) {
			fail(
				'Cannot proceed with --confirm due to ambiguous slug collision. Resolve it first.',
			);
		}

		if (ambiguous.length > 0) {
			console.info('Ambiguous cases (non-blocking, will be reported as risks):');
			for (const a of ambiguous) {
				console.info(`  ${a}`);
			}
		}

		const totalPreserved = Object.values(preservedRows).reduce(
			(sum, rows) => sum + (rows?.length ?? 0),
			0,
		);

		if (totalPreserved === 0) {
			console.info('No local-only data to preserve. Running standard refresh.');
			phase6Refresh(prodDbUrl);
			console.info('=== Refresh Complete (no preserved data) ===');
			return;
		}

		const exportPath = phase4Export(
			slugDiff,
			preservedRows,
			authUserIds,
			allRisks,
			ambiguous,
			stamp,
		);

		phase6Refresh(prodDbUrl);
		phase7Restore(exportPath, authUserIds);
		phase8Validate(slugDiff, preservedRows);

		console.info('=== Preserve-Local Refresh Complete ===');
		const totalRows = Object.values(preservedRows).reduce(
			(sum, rows) => sum + (rows?.length ?? 0),
			0,
		);
		console.info(`Total rows preserved: ${totalRows}`);
		console.info(`Export archive: ${exportPath}`);
		return;
	}

	console.info('No flag specified. Use one of:');
	console.info('  --dry-run   Show report without modifying anything');
	console.info('  --export    Create preserve bundle without refreshing');
	console.info('  --confirm   Full refresh + restore');
}

main().catch((error: unknown) => {
	fail(error instanceof Error ? error.message : String(error));
});
