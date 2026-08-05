/**
 * preview-sync-db.ts — Database reading, writing, and truncate helpers for the
 * Production→Preview content mirror. Stale Preview-only rows are report-only in
 * preview-sync-invitations (no automatic prune).
 */

import { runPsql, sqlLiteral, quoteIdentifier } from './db-workflow-lib.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbRow {
	[key: string]: unknown;
}

export interface UpsertFailure {
	primaryKey: string;
	message: string;
}

export interface UpsertResult {
	created: number;
	failed: number;
	failures: UpsertFailure[];
}

// ---------------------------------------------------------------------------
// Data Reading
// ---------------------------------------------------------------------------

export function queryTableJson(
	dbUrl: string,
	table: string,
	orderBy = 'id',
	where?: string,
): DbRow[] {
	const whereClause = where ? `where ${where}` : '';
	const sql = `select coalesce(json_agg(sub), '[]'::json)::text from (select * from public.${quoteIdentifier(table)} ${whereClause} order by ${orderBy}) sub;`;
	const result = runPsql(sql, dbUrl);
	try {
		return JSON.parse(result.stdout.trim()) as DbRow[];
	} catch {
		return [];
	}
}

export function resolveColumns(dbUrl: string, table: string): string[] {
	const result = runPsql(
		`select column_name from information_schema.columns
		 where table_schema = 'public' and table_name = ${sqlLiteral(table)}
		 order by ordinal_position;`,
		dbUrl,
		{ tuplesOnly: true },
	);
	return result.stdout.trim().split(/\r?\n/).filter(Boolean);
}

export function countRows(dbUrl: string, table: string): number {
	const result = runPsql(`select count(*)::text from public.${quoteIdentifier(table)};`, dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	return parseInt(result.stdout.trim() || '0', 10);
}

// ---------------------------------------------------------------------------
// Data Writing (Upsert)
// ---------------------------------------------------------------------------

function sqlValue(val: unknown): string {
	if (val === null || val === undefined) return 'null';
	if (typeof val === 'string') {
		if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
			return `'${val}'::uuid`;
		}
		if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(val)) {
			return `'${val}'::timestamptz`;
		}
		if (/^-?\d+(\.\d+)?$/.test(val)) return val;
		return sqlLiteral(val);
	}
	if (typeof val === 'number') return String(val);
	if (typeof val === 'boolean') return val ? 'true' : 'false';
	// Object or array — serialize as JSON
	return sqlLiteral(JSON.stringify(val));
}

export function upsertFromJson(
	dbUrl: string,
	table: string,
	rows: DbRow[],
	primaryKey: string,
): UpsertResult {
	if (rows.length === 0) return { created: 0, failed: 0, failures: [] };
	const columns = resolveColumns(dbUrl, table);

	let created = 0;
	const failures: UpsertFailure[] = [];

	for (const row of rows) {
		const colList = columns.map((c) => quoteIdentifier(c)).join(', ');
		const valList = columns.map((c) => sqlValue(row[c])).join(', ');
		const pkValue = String(row[primaryKey] ?? '<missing>');

		const updateSet = columns
			.filter((c) => c !== primaryKey)
			.map((c) => `${quoteIdentifier(c)} = excluded.${quoteIdentifier(c)}`)
			.join(', ');

		const upsertSql = `insert into public.${quoteIdentifier(table)} (${colList})
			values (${valList})
			on conflict (${quoteIdentifier(primaryKey)}) do update set ${updateSet};`;

		try {
			const result = runPsql(upsertSql, dbUrl, { tuplesOnly: false, throwOnError: false });
			if (result.status !== 0) {
				const message = result.stderr.slice(0, 200) || `upsert status ${result.status}`;
				console.warn(
					`   ⚠️  Upsert failed for ${table} ${primaryKey}=${pkValue}: ${message}`,
				);
				failures.push({ primaryKey: pkValue, message });
			} else {
				created++;
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.warn(
				`   ⚠️  Exception upserting ${table} ${primaryKey}=${pkValue}: ${message}`,
			);
			failures.push({ primaryKey: pkValue, message });
		}
	}

	console.info(
		`   ${table}: ${created} upserted${failures.length > 0 ? `, ${failures.length} failed` : ''}`,
	);
	return { created, failed: failures.length, failures };
}

export function truncateTable(dbUrl: string, table: string): void {
	runPsql(`truncate table public.${quoteIdentifier(table)} cascade;`, dbUrl);
}
