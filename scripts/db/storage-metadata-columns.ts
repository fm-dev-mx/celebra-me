/**
 * Aligns the disposable Storage schema with a Production Storage metadata dump.
 *
 * Production runs a newer Supabase Storage service than the frozen
 * `supabase/test/storage-schema.sql`, so its `pg_dump --data-only` COPY blocks
 * can name columns the disposable tables lack (e.g. `storage.buckets.versioning_status`).
 * Missing columns are added with their Supabase Storage type so row fingerprints
 * (`to_jsonb`) match the source; an unknown column falls back to nullable `text`,
 * which accepts any COPY text value unchanged.
 */

/** Types from supabase/storage tenant migrations 0062 (versioning) and 0068 (lifecycle). */
const KNOWN_STORAGE_COLUMN_TYPES: Record<string, string> = {
	'buckets.versioning_status': 'text',
	'buckets.lifecycle_configuration': 'jsonb',
	'buckets.lifecycle_configuration_generation': 'uuid',
	'objects.archived_at': 'timestamptz',
	'objects.is_delete_marker': 'boolean',
	'objects.is_versioned': 'boolean',
};

export function storageColumnType(table: string, column: string): string {
	return KNOWN_STORAGE_COLUMN_TYPES[`${table}.${column}`] ?? 'text';
}

const COPY_HEADER = /^COPY\s+storage\.("?)(\w+)\1\s*\(([^)]*)\)\s+FROM\s+stdin;\s*$/gim;

/** Column lists of every `COPY storage.<table> (...) FROM stdin;` header in a dump. */
export function parseStorageCopyColumns(sql: string): Map<string, string[]> {
	const columnsByTable = new Map<string, string[]>();
	for (const match of sql.matchAll(COPY_HEADER)) {
		const table = match[2];
		const columns = match[3]
			.split(',')
			.map((column) =>
				column
					.trim()
					.replace(/^"(.*)"$/, '$1')
					.replaceAll('""', '"'),
			)
			.filter(Boolean);
		columnsByTable.set(table, [...(columnsByTable.get(table) ?? []), ...columns]);
	}
	return columnsByTable;
}

/** Columns named by the dump that the target table does not have. */
export function findMissingStorageColumns(
	dumpColumns: Map<string, string[]>,
	targetColumns: Map<string, Set<string>>,
): Array<{ table: string; column: string }> {
	const missing: Array<{ table: string; column: string }> = [];
	for (const [table, columns] of dumpColumns) {
		const existing = targetColumns.get(table);
		if (!existing) {
			throw new Error(`Storage metadata dump targets an unknown table: storage.${table}`);
		}
		for (const column of new Set(columns)) {
			if (!existing.has(column)) missing.push({ table, column });
		}
	}
	return missing;
}

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

/** DDL that adds each missing column as a nullable column of its Storage type. */
export function buildAddStorageColumnsSql(
	missing: Array<{ table: string; column: string }>,
): string {
	return missing
		.map(
			({ table, column }) =>
				`alter table storage.${quoteIdentifier(table)} add column if not exists ${quoteIdentifier(column)} ${storageColumnType(table, column)};`,
		)
		.join('\n');
}
