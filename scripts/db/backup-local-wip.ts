import { resolve } from 'node:path';
import {
	assertAppEnvIsLocal,
	assertLocalApiReachable,
	assertLocalDbReachable,
	assertNoProdCredentialsInLocalEnv,
	ensureDir,
	fail,
	loadAppEnv,
	log,
	parseTsv,
	quoteIdentifier,
	runPsql,
	sqlLiteral,
	timestamp,
	writeTextFile,
} from './db-workflow-lib.ts';

const WIP_TABLES = [
	'invitations',
	'intake_requests',
	'intake_submissions',
	'invitation_content_drafts',
	'invitation_assets',
] as const;

function getExistingWipTables(): { existing: string[]; missing: string[] } {
	const tableList = WIP_TABLES.map((table) => sqlLiteral(table)).join(', ');
	const result = runPsql(`
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
  and table_name = any(array[${tableList}])
order by table_name;
`);
	const existingSet = new Set(result.stdout.trim().split(/\r?\n/).filter(Boolean));
	const existing = WIP_TABLES.filter((table) => existingSet.has(table));
	const missing = WIP_TABLES.filter((table) => !existingSet.has(table));
	return { existing, missing };
}

function getAllTableColumns(tables: string[]): Map<string, string[]> {
	const tableList = tables.map((t) => sqlLiteral(t)).join(', ');
	const result = runPsql(`
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = any(array[${tableList}])
  and is_generated = 'NEVER'
order by table_name, ordinal_position;
`);
	const columnMap = new Map<string, string[]>();
	for (const [table, column] of parseTsv(result.stdout)) {
		if (!columnMap.has(table)) columnMap.set(table, []);
		columnMap.get(table)!.push(column);
	}
	return columnMap;
}

function dumpTableCopyBlock(table: string, columns: string[]): string {
	if (columns.length === 0) {
		return `-- Skipped public.${table}: no dumpable columns found.\n`;
	}

	const columnList = columns.map(quoteIdentifier).join(', ');
	const qualifiedTable = `public.${quoteIdentifier(table)}`;
	const copyData = runPsql(`copy ${qualifiedTable} (${columnList}) to stdout;`).stdout;
	const copyLines = copyData.trimEnd() ? [copyData.trimEnd()] : [];

	return [
		`-- Local WIP data for ${qualifiedTable}`,
		`COPY ${qualifiedTable} (${columnList}) FROM stdin;`,
		...copyLines,
		'\\.',
		'',
	].join('\n');
}

function main(): void {
	const appEnv = loadAppEnv();
	assertNoProdCredentialsInLocalEnv();
	assertAppEnvIsLocal(appEnv);
	assertLocalApiReachable();
	assertLocalDbReachable();

	const { existing, missing } = getExistingWipTables();
	if (existing.length === 0) {
		fail('No local WIP tables were found to back up.');
	}

	const outputDir = resolve(process.cwd(), '.tmp', 'db', 'local-wip');
	const outputPath = resolve(outputDir, `local-wip-${timestamp()}.sql`);
	ensureDir(outputDir);

	const columnMap = getAllTableColumns(existing);
	log(`Local WIP backup (${existing.join(', ')})`);
	if (missing.length > 0) {
		log(`Skipped missing optional tables: ${missing.join(', ')}`);
	}

	const header = [
		'-- Celebra-me local WIP backup',
		`-- Created at: ${new Date().toISOString()}`,
		'-- This backup includes selected local public tables only.',
		'-- It does not include Supabase Storage binaries.',
		'-- It does not include a full auth snapshot.',
		'-- Use it for manual recovery, not as a full restore artifact.',
		'',
		'set check_function_bodies = off;',
		'set client_min_messages = warning;',
		'',
	].join('\n');
	const body = existing
		.map((table) => dumpTableCopyBlock(table, columnMap.get(table) ?? []))
		.join('\n');
	writeTextFile(outputPath, `${header}${body}`);

	log(`Backup complete: ${outputPath}`);
}

try {
	main();
} catch (error: unknown) {
	fail(error instanceof Error ? error.message : String(error));
}
