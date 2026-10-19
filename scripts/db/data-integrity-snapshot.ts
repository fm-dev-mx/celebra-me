import {
	CRITICAL_RECOVERY_TABLES,
	fingerprintSubquery,
	recoveryTableSource,
	type CriticalRecoveryTable,
} from './recovery-integrity.ts';

/**
 * Read-only data integrity snapshot taken before and after an operational step
 * (hosting cutover, asset URL switch). It extends the recovery fingerprints with
 * one hash per row and per-event RSVP/memories counts, so a later snapshot can
 * prove that nothing created before the first one disappeared or shrank.
 */

export type IntegritySnapshotTarget = 'local' | 'preview' | 'production';

/** [row hash, updated_at as text or null when the table has no such column]. */
type RowFingerprint = [string, string | null];

interface TableIntegrity {
	rowCount: number;
	/** Same digest as the recovery integrity fingerprint for this table. */
	sha256: string;
	rows: Record<string, RowFingerprint>;
}

export interface EventIntegrityCounts {
	eventType: string;
	slug: string;
	deleted: boolean;
	/** Every guest row, soft-deleted included. Never shrinks. */
	guests: number;
	activeGuests: number;
	confirmed: number;
	declined: number;
	pending: number;
	/** Sum of attendee_count over active guests. */
	attendees: number;
	/** Every memory item row, any status. Never shrinks. */
	memoryItems: number;
	memoryAcceptedItems: number;
	memoryAcceptedBytes: number;
	/** Never shrinks. */
	engagementEvents: number;
}

export interface DataIntegritySnapshot {
	kind: 'celebra-data-integrity-snapshot';
	version: 1;
	target: IntegritySnapshotTarget;
	capturedAt: string;
	migrationCount: number;
	latestMigration: string | null;
	tables: Record<string, TableIntegrity>;
	events: Record<string, EventIntegrityCounts>;
}

/** Per-event counts that may only grow between two snapshots. */
const MONOTONIC_EVENT_COUNTS = ['guests', 'memoryItems', 'engagementEvents'] as const;

/** Per-event counts that legitimately move (RSVP answers, host deletions); reported, never enforced. */
const INFORMATIONAL_EVENT_COUNTS = [
	'activeGuests',
	'confirmed',
	'declined',
	'pending',
	'attendees',
	'memoryAcceptedItems',
	'memoryAcceptedBytes',
] as const;

const SNAPSHOT_TABLES: readonly CriticalRecoveryTable[] = CRITICAL_RECOVERY_TABLES;

function rowHashesSubquery(entry: CriticalRecoveryTable): string {
	return `(select coalesce(json_object_agg((${entry.orderBy})::text, json_build_array(
		  md5(to_jsonb(t)::text), to_jsonb(t) ->> 'updated_at'
		) order by ${entry.orderBy}), '{}'::json) from ${recoveryTableSource(entry)} t)`;
}

const EVENT_COUNTS_SQL = `(select coalesce(json_object_agg(e.id::text, json_build_object(
	  'eventType', e.event_type,
	  'slug', e.slug,
	  'deleted', e.deleted_at is not null,
	  'guests', coalesce(g.total, 0),
	  'activeGuests', coalesce(g.active, 0),
	  'confirmed', coalesce(g.confirmed, 0),
	  'declined', coalesce(g.declined, 0),
	  'pending', coalesce(g.pending, 0),
	  'attendees', coalesce(g.attendees, 0),
	  'memoryItems', coalesce(m.total, 0),
	  'memoryAcceptedItems', coalesce(m.accepted, 0),
	  'memoryAcceptedBytes', coalesce(m.accepted_bytes, 0),
	  'engagementEvents', coalesce(x.total, 0)
	) order by e.id), '{}'::json)
	from public.events e
	left join (
	  select event_id,
	         count(*) total,
	         count(*) filter (where deleted_at is null) active,
	         count(*) filter (where deleted_at is null and attendance_status = 'confirmed') confirmed,
	         count(*) filter (where deleted_at is null and attendance_status = 'declined') declined,
	         count(*) filter (where deleted_at is null and attendance_status = 'pending') pending,
	         coalesce(sum(attendee_count) filter (where deleted_at is null), 0) attendees
	  from public.guest_invitations group by event_id
	) g on g.event_id = e.id
	left join (
	  select event_id,
	         count(*) total,
	         count(*) filter (where status = 'accepted' and object_deleted_at is null) accepted,
	         coalesce(sum(size_bytes) filter (where status = 'accepted' and object_deleted_at is null), 0) accepted_bytes
	  from public.event_memory_items group by event_id
	) m on m.event_id = e.id
	left join (
	  select event_id, count(*) total from public.guest_engagement_events group by event_id
	) x on x.event_id = e.id)`;

/**
 * One statement, so Postgres evaluates every table against the same MVCC snapshot.
 * The session is forced read-only: the database itself rejects any write.
 */
export function buildDataIntegritySnapshotSql(
	tables: readonly CriticalRecoveryTable[] = SNAPSHOT_TABLES,
): string {
	const tableEntries = tables.map(
		(entry) => `'${entry.schema}.${entry.table}', json_build_object(
		  'fingerprint', ${fingerprintSubquery(entry)},
		  'rows', ${rowHashesSubquery(entry)}
		)`,
	);
	return `SET default_transaction_read_only = on;
select json_build_object(
	  'migrations', coalesce((
	    select json_agg(version::text order by version) from supabase_migrations.schema_migrations
	  ), '[]'::json),
	  'tables', json_build_object(${tableEntries.join(',\n	  ')}),
	  'events', ${EVENT_COUNTS_SQL}
	)::text`;
}

interface SnapshotPayload {
	migrations: string[];
	tables: Record<
		string,
		{ fingerprint: { rowCount: number; sha256: string }; rows: Record<string, RowFingerprint> }
	>;
	events: Record<string, EventIntegrityCounts>;
}

export function snapshotFromPayload(
	payload: SnapshotPayload,
	target: IntegritySnapshotTarget,
	capturedAt: string = new Date().toISOString(),
): DataIntegritySnapshot {
	const tables = Object.fromEntries(
		Object.entries(payload.tables).map(([name, { fingerprint, rows }]) => [
			name,
			{ rowCount: fingerprint.rowCount, sha256: fingerprint.sha256, rows },
		]),
	);
	const events = Object.fromEntries(
		Object.entries(payload.events).map(([id, counts]) => [
			id,
			{ ...counts, memoryAcceptedBytes: Number(counts.memoryAcceptedBytes) },
		]),
	);
	return {
		kind: 'celebra-data-integrity-snapshot',
		version: 1,
		target,
		capturedAt,
		migrationCount: payload.migrations.length,
		latestMigration: payload.migrations.at(-1) ?? null,
		tables,
		events,
	};
}

export function parseDataIntegritySnapshot(text: string, label: string): DataIntegritySnapshot {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error(`${label} is not valid JSON.`);
	}
	const value = parsed as Partial<DataIntegritySnapshot> | null;
	if (
		!value ||
		value.kind !== 'celebra-data-integrity-snapshot' ||
		value.version !== 1 ||
		typeof value.tables !== 'object' ||
		typeof value.events !== 'object'
	) {
		throw new Error(`${label} is not a version 1 data integrity snapshot.`);
	}
	return value as DataIntegritySnapshot;
}

interface ChangedRow {
	table: string;
	key: string;
	beforeUpdatedAt: string | null;
	afterUpdatedAt: string | null;
	/** True when updated_at moved, i.e. the application recorded a write. */
	updatedAtChanged: boolean;
}

interface EventCountChange {
	eventId: string;
	label: string;
	field: string;
	before: number;
	after: number;
}

export interface DataIntegrityComparison {
	ok: boolean;
	/** Enforced: shrunk counts, vanished rows, missing tables/events, target mismatch. */
	failures: string[];
	missingRows: { table: string; key: string }[];
	/** Pre-existing rows whose hash changed; listed for review, not a failure. */
	changedRows: ChangedRow[];
	newRows: Record<string, number>;
	/** Informational per-event counts that moved. */
	eventCountChanges: EventCountChange[];
}

function eventLabel(counts: EventIntegrityCounts): string {
	return `${counts.eventType}/${counts.slug}`;
}

export function compareDataIntegritySnapshots(
	before: DataIntegritySnapshot,
	after: DataIntegritySnapshot,
): DataIntegrityComparison {
	const failures: string[] = [];
	const missingRows: DataIntegrityComparison['missingRows'] = [];
	const changedRows: ChangedRow[] = [];
	const newRows: Record<string, number> = {};
	const eventCountChanges: EventCountChange[] = [];

	if (before.target !== after.target)
		failures.push(`Target mismatch: before is ${before.target}, after is ${after.target}.`);
	if (after.migrationCount < before.migrationCount)
		failures.push(
			`Migration count shrank: ${before.migrationCount} before, ${after.migrationCount} after.`,
		);

	for (const [name, beforeTable] of Object.entries(before.tables)) {
		const afterTable = after.tables[name];
		if (!afterTable) {
			failures.push(`Table ${name} is missing from the after snapshot.`);
			continue;
		}
		if (afterTable.rowCount < beforeTable.rowCount)
			failures.push(
				`${name} row count shrank: ${beforeTable.rowCount} before, ${afterTable.rowCount} after.`,
			);
		for (const [key, [beforeHash, beforeUpdatedAt]] of Object.entries(beforeTable.rows)) {
			const afterRow = afterTable.rows[key];
			if (!afterRow) {
				missingRows.push({ table: name, key });
				continue;
			}
			const [afterHash, afterUpdatedAt] = afterRow;
			if (afterHash !== beforeHash)
				changedRows.push({
					table: name,
					key,
					beforeUpdatedAt,
					afterUpdatedAt,
					updatedAtChanged: afterUpdatedAt !== beforeUpdatedAt,
				});
		}
		const added = Object.keys(afterTable.rows).filter((key) => !(key in beforeTable.rows));
		if (added.length > 0) newRows[name] = added.length;
	}
	for (const { table, key } of missingRows)
		failures.push(`${table} row ${key} existed before and is gone.`);

	for (const [eventId, beforeCounts] of Object.entries(before.events)) {
		const afterCounts = after.events[eventId];
		const label = eventLabel(beforeCounts);
		if (!afterCounts) {
			failures.push(`Event ${label} (${eventId}) is missing from the after snapshot.`);
			continue;
		}
		for (const field of MONOTONIC_EVENT_COUNTS) {
			if (afterCounts[field] < beforeCounts[field])
				failures.push(
					`Event ${label} ${field} shrank: ${beforeCounts[field]} before, ${afterCounts[field]} after.`,
				);
		}
		for (const field of [...MONOTONIC_EVENT_COUNTS, ...INFORMATIONAL_EVENT_COUNTS]) {
			if (afterCounts[field] !== beforeCounts[field])
				eventCountChanges.push({
					eventId,
					label,
					field,
					before: beforeCounts[field],
					after: afterCounts[field],
				});
		}
	}

	return {
		ok: failures.length === 0,
		failures,
		missingRows,
		changedRows,
		newRows,
		eventCountChanges,
	};
}

/** Short human summary; full detail lives in the JSON report. */
export function formatDataIntegrityComparison(result: DataIntegrityComparison): string[] {
	const lines: string[] = [];
	lines.push(result.ok ? 'Result: PASS' : `Result: FAIL (${result.failures.length} failure(s))`);
	for (const failure of result.failures.slice(0, 50)) lines.push(`  FAIL ${failure}`);
	if (result.failures.length > 50) lines.push(`  ... ${result.failures.length - 50} more`);
	const appWrites = result.changedRows.filter((row) => row.updatedAtChanged);
	const silent = result.changedRows.filter((row) => !row.updatedAtChanged);
	lines.push(
		`Changed pre-existing rows: ${result.changedRows.length} (${appWrites.length} with a newer updated_at, ${silent.length} without — review those first)`,
	);
	for (const row of silent.slice(0, 50))
		lines.push(`  REVIEW ${row.table} ${row.key} (updated_at ${row.afterUpdatedAt ?? 'none'})`);
	if (silent.length > 50) lines.push(`  ... ${silent.length - 50} more`);
	const added = Object.entries(result.newRows);
	lines.push(
		`New rows: ${added.length === 0 ? 'none' : added.map(([t, n]) => `${t} +${n}`).join(', ')}`,
	);
	for (const change of result.eventCountChanges)
		lines.push(`  ${change.label} ${change.field}: ${change.before} → ${change.after}`);
	return lines;
}

export interface SnapshotCliArgs {
	target?: IntegritySnapshotTarget;
	out?: string;
	compare?: string;
	/** Compare against an existing after-snapshot file instead of capturing. */
	after?: string;
	report?: string;
}

const TARGETS: readonly IntegritySnapshotTarget[] = ['local', 'preview', 'production'];

const SNAPSHOT_USAGE = [
	'Usage:',
	'  pnpm db:integrity:snapshot --target=preview|production|local --out=<file.json> [--compare=<before.json>]',
	'  pnpm db:integrity:snapshot --compare=<before.json> --after=<after.json> [--report=<file.json>]',
].join('\n');

export function parseSnapshotArgs(argv: readonly string[]): SnapshotCliArgs {
	const args: SnapshotCliArgs = {};
	for (const arg of argv) {
		if (arg === '--') continue;
		const match = /^--(target|out|compare|after|report)=(.+)$/.exec(arg);
		if (!match) throw new Error(`Unknown argument "${arg}".\n${SNAPSHOT_USAGE}`);
		const [, name, value] = match;
		if (name === 'target') {
			if (!TARGETS.includes(value as IntegritySnapshotTarget))
				throw new Error(`--target must be one of ${TARGETS.join(', ')}.`);
			args.target = value as IntegritySnapshotTarget;
		} else {
			args[name as Exclude<keyof SnapshotCliArgs, 'target'>] = value;
		}
	}
	if (args.after) {
		if (!args.compare) throw new Error(`--after needs --compare.\n${SNAPSHOT_USAGE}`);
		if (args.target || args.out)
			throw new Error(
				`--after compares two files; drop --target and --out.\n${SNAPSHOT_USAGE}`,
			);
	} else if (!args.target || !args.out) {
		throw new Error(`--target and --out are required to capture.\n${SNAPSHOT_USAGE}`);
	}
	return args;
}
