/**
 * preview-sync-db.ts — Database Reading, Writing & Pruning
 *
 * Reads invitation data from Production, writes to Preview via psql,
 * and prunes stale records to maintain mirror convergence.
 */

import {
	runPsql,
	sqlLiteral,
	quoteIdentifier,
} from './db-workflow-lib.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbRow {
	[key: string]: unknown;
}

export interface UpsertResult {
	created: number;
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
	const result = runPsql(
		`select count(*)::text from public.${quoteIdentifier(table)};`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
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
	if (rows.length === 0) return { created: 0 };
	const columns = resolveColumns(dbUrl, table);

	let created = 0;

	for (const row of rows) {
		const colList = columns.map((c) => quoteIdentifier(c)).join(', ');
		const valList = columns.map((c) => sqlValue(row[c])).join(', ');

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
				console.warn(`   ⚠️  Upsert failed for ${table} ${primaryKey}=${row[primaryKey]}: ${result.stderr.slice(0, 200)}`);
			} else {
				created++;
			}
		} catch (err) {
			console.warn(`   ⚠️  Exception upserting ${table} ${primaryKey}=${row[primaryKey]}: ${err}`);
		}
	}

	console.info(`   ${table}: ${created} upserted`);
	return { created };
}

export function truncateTable(dbUrl: string, table: string): void {
	runPsql(`truncate table public.${quoteIdentifier(table)} cascade;`, dbUrl);
}


// ---------------------------------------------------------------------------
// Pruning (Stale Record Reconciliation)
// ---------------------------------------------------------------------------

export interface PruneResult {
	table: string;
	staleCount: number;
	action: 'none' | 'dry-run' | 'applied';
}

export function pruneStaleRecords(
	prodDbUrl: string,
	previewDbUrl: string,
	table: string,
	dryRun: boolean,
	detectedDrift: string[],
): PruneResult {
	const columns = resolveColumns(prodDbUrl, table);
	const pk = columns.includes('id') ? 'id' : columns[0] || 'id';

	const prodResult = runPsql(
		`select ${quoteIdentifier(pk)}::text from public.${quoteIdentifier(table)} order by ${quoteIdentifier(pk)};`,
		prodDbUrl,
		{ tuplesOnly: true },
	);
	const prodIds = new Set(prodResult.stdout.trim().split(/\r?\n/).filter(Boolean));

	if (prodIds.size === 0) {
		return { table, staleCount: 0, action: 'none' };
	}

	const previewResult = runPsql(
		`select ${quoteIdentifier(pk)}::text from public.${quoteIdentifier(table)} order by ${quoteIdentifier(pk)};`,
		previewDbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	const previewIds = new Set(previewResult.stdout.trim().split(/\r?\n/).filter(Boolean));

	const staleIds = [...previewIds].filter((id) => !prodIds.has(id) && id.length > 0);

	if (staleIds.length === 0) {
		return { table, staleCount: 0, action: 'none' };
	}

	console.info(`   ${table}: ${staleIds.length} stale records in Preview not in Production`);

	if (dryRun) {
		console.info(`   [dry-run] Would prune ${staleIds.length} stale ${table} records`);
		for (const id of staleIds.slice(0, 5)) {
			console.info(`     - ${id}`);
		}
		if (staleIds.length > 5) {
			console.info(`     - ... and ${staleIds.length - 5} more`);
		}
		detectedDrift.push(`${table}: ${staleIds.length} stale records to prune`);
		return { table, staleCount: staleIds.length, action: 'dry-run' };
	}

	const idList = staleIds.map((id) => sqlLiteral(id)).join(', ');

	if (table === 'invitations') {
		runPsql(
			`update public.${quoteIdentifier(table)}
			 set archived_at = now()
			 where ${quoteIdentifier(pk)} in (${idList})
			 and archived_at is null;`,
			previewDbUrl,
		);
	} else if (table === 'events') {
		runPsql(
			`update public.${quoteIdentifier(table)}
			 set deleted_at = now(), status = 'archived'
			 where ${quoteIdentifier(pk)} in (${idList})
			 and deleted_at is null;`,
			previewDbUrl,
		);
	} else {
		const previewCols = resolveColumns(previewDbUrl, table);
		if (previewCols.includes('deleted_at')) {
			runPsql(
				`update public.${quoteIdentifier(table)}
				 set deleted_at = now()
				 where ${quoteIdentifier(pk)} in (${idList})
				 and deleted_at is null;`,
				previewDbUrl,
			);
		} else {
			runPsql(
				`delete from public.${quoteIdentifier(table)}
				 where ${quoteIdentifier(pk)} in (${idList});`,
				previewDbUrl,
			);
		}
	}

	console.info(`   ✅ Pruned ${staleIds.length} stale ${table} records`);
	return { table, staleCount: staleIds.length, action: 'applied' };
}
