import { isReadOnlySql } from '../../scripts/db/production-boundary-policy';
import {
	buildDataIntegritySnapshotSql,
	compareDataIntegritySnapshots,
	formatDataIntegrityComparison,
	parseDataIntegritySnapshot,
	parseSnapshotArgs,
	snapshotFromPayload,
	type DataIntegritySnapshot,
	type EventIntegrityCounts,
} from '../../scripts/db/data-integrity-snapshot';
import {
	CRITICAL_RECOVERY_TABLES,
	wrapRecoveryIntegrityPsqlInput,
} from '../../scripts/db/recovery-integrity';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const GUEST_A = '22222222-2222-4222-8222-222222222222';
const GUEST_B = '33333333-3333-4333-8333-333333333333';

function counts(overrides: Partial<EventIntegrityCounts> = {}): EventIntegrityCounts {
	return {
		eventType: 'xv',
		slug: 'america',
		deleted: false,
		guests: 2,
		activeGuests: 2,
		confirmed: 1,
		declined: 0,
		pending: 1,
		attendees: 3,
		memoryItems: 4,
		memoryAcceptedItems: 3,
		memoryAcceptedBytes: 9_000_000,
		engagementEvents: 10,
		...overrides,
	};
}

function fixture(): DataIntegritySnapshot {
	return snapshotFromPayload(
		{
			migrations: ['20261015110000', '20261015120000'],
			tables: {
				'public.guest_invitations': {
					fingerprint: { rowCount: 2, sha256: 'a'.repeat(64) },
					rows: {
						[GUEST_A]: ['1'.repeat(32), '2026-10-15T10:00:00+00:00'],
						[GUEST_B]: ['2'.repeat(32), '2026-10-15T11:00:00+00:00'],
					},
				},
				'public.guest_engagement_events': {
					fingerprint: { rowCount: 1, sha256: 'b'.repeat(64) },
					rows: { '1': ['3'.repeat(32), null] },
				},
			},
			events: { [EVENT_ID]: counts() },
		},
		'production',
		'2026-10-18T07:00:00.000Z',
	);
}

describe('data integrity snapshot SQL', () => {
	it('covers every recovery table plus per-row hashes and per-event counts', () => {
		const sql = buildDataIntegritySnapshotSql();
		for (const { schema, table } of CRITICAL_RECOVERY_TABLES)
			expect(sql).toContain(`'${schema}.${table}'`);
		expect(sql).toContain('md5(to_jsonb(t)::text)');
		expect(sql).toContain("'memoryAcceptedBytes'");
		expect(sql).toContain('from public.guest_engagement_events group by event_id');
	});

	it('runs in a forced read-only session that the production boundary accepts', () => {
		const sql = wrapRecoveryIntegrityPsqlInput(buildDataIntegritySnapshotSql());
		expect(sql).toContain('SET default_transaction_read_only = on;');
		expect(isReadOnlySql(sql)).toBe(true);
	});

	it('covers the memories, access and engagement tables but not the dropped rsvp tables', () => {
		const names = CRITICAL_RECOVERY_TABLES.map(({ table }) => table);
		expect(names).toEqual(
			expect.arrayContaining([
				'invitations',
				'event_memory_sessions',
				'event_memory_items',
				'event_memory_settings',
				'event_memory_audit_events',
				'invitation_access_controls',
				'guest_engagement_events',
			]),
		);
		expect(names).not.toContain('rsvp_records');
		expect(names).not.toContain('rsvp_audit_log');
		expect(names).not.toContain('rsvp_channel_log');
	});
});

describe('snapshotFromPayload', () => {
	it('keeps the recovery fingerprint and coerces bigint byte sums', () => {
		const snapshot = snapshotFromPayload(
			{
				migrations: [],
				tables: {},
				events: {
					[EVENT_ID]: counts({
						memoryAcceptedBytes: '12' as unknown as number,
					}),
				},
			},
			'preview',
		);
		expect(snapshot.latestMigration).toBeNull();
		expect(snapshot.events[EVENT_ID]?.memoryAcceptedBytes).toBe(12);
		const full = fixture();
		expect(full.migrationCount).toBe(2);
		expect(full.latestMigration).toBe('20261015120000');
		expect(full.tables['public.guest_invitations']?.sha256).toBe('a'.repeat(64));
	});
});

describe('compareDataIntegritySnapshots', () => {
	it('passes when nothing changed', () => {
		const result = compareDataIntegritySnapshots(fixture(), fixture());
		expect(result).toMatchObject({ ok: true, failures: [], changedRows: [], missingRows: [] });
	});

	it('accepts growth and RSVP movement, listing new rows and count changes', () => {
		const after = fixture();
		const guests = after.tables['public.guest_invitations']!;
		guests.rowCount = 3;
		guests.rows['44444444-4444-4444-8444-444444444444'] = ['4'.repeat(32), null];
		after.events[EVENT_ID] = counts({ guests: 3, pending: 0, confirmed: 2, attendees: 5 });
		const result = compareDataIntegritySnapshots(fixture(), after);
		expect(result.ok).toBe(true);
		expect(result.newRows).toEqual({ 'public.guest_invitations': 1 });
		expect(result.eventCountChanges.map(({ field }) => field)).toEqual([
			'guests',
			'confirmed',
			'pending',
			'attendees',
		]);
	});

	it('lists changed pre-existing rows and flags those without an updated_at move', () => {
		const after = fixture();
		after.tables['public.guest_invitations']!.rows[GUEST_A] = [
			'9'.repeat(32),
			'2026-10-18T08:00:00+00:00',
		];
		after.tables['public.guest_engagement_events']!.rows['1'] = ['8'.repeat(32), null];
		const result = compareDataIntegritySnapshots(fixture(), after);
		expect(result.ok).toBe(true);
		expect(result.changedRows).toEqual([
			{
				table: 'public.guest_invitations',
				key: GUEST_A,
				beforeUpdatedAt: '2026-10-15T10:00:00+00:00',
				afterUpdatedAt: '2026-10-18T08:00:00+00:00',
				updatedAtChanged: true,
			},
			{
				table: 'public.guest_engagement_events',
				key: '1',
				beforeUpdatedAt: null,
				afterUpdatedAt: null,
				updatedAtChanged: false,
			},
		]);
		const summary = formatDataIntegrityComparison(result).join('\n');
		expect(summary).toContain('Result: PASS');
		expect(summary).toContain('REVIEW public.guest_engagement_events 1');
		expect(summary).not.toContain(`REVIEW public.guest_invitations ${GUEST_A}`);
	});

	it('fails when a pre-existing row vanishes or a table count shrinks', () => {
		const after = fixture();
		const guests = after.tables['public.guest_invitations']!;
		delete guests.rows[GUEST_B];
		guests.rowCount = 1;
		const result = compareDataIntegritySnapshots(fixture(), after);
		expect(result.ok).toBe(false);
		expect(result.missingRows).toEqual([{ table: 'public.guest_invitations', key: GUEST_B }]);
		expect(result.failures).toEqual([
			'public.guest_invitations row count shrank: 2 before, 1 after.',
			`public.guest_invitations row ${GUEST_B} existed before and is gone.`,
		]);
	});

	it('fails when monotonic per-event counts shrink but not when informational ones do', () => {
		const after = fixture();
		after.events[EVENT_ID] = counts({
			memoryItems: 3,
			engagementEvents: 9,
			memoryAcceptedBytes: 1,
			activeGuests: 1,
		});
		const result = compareDataIntegritySnapshots(fixture(), after);
		expect(result.failures).toEqual([
			'Event xv/america memoryItems shrank: 4 before, 3 after.',
			'Event xv/america engagementEvents shrank: 10 before, 9 after.',
		]);
	});

	it('fails on missing tables, missing events, migration loss and target mismatch', () => {
		const after = fixture();
		after.target = 'preview';
		after.migrationCount = 1;
		delete after.tables['public.guest_engagement_events'];
		delete after.events[EVENT_ID];
		const failures = compareDataIntegritySnapshots(fixture(), after).failures.join('\n');
		expect(failures).toMatch(/Target mismatch/);
		expect(failures).toMatch(/Migration count shrank/);
		expect(failures).toMatch(/public\.guest_engagement_events is missing/);
		expect(failures).toMatch(/Event xv\/america .* is missing/);
	});
});

describe('parseDataIntegritySnapshot', () => {
	it('round-trips a snapshot and rejects other JSON', () => {
		const snapshot = fixture();
		expect(parseDataIntegritySnapshot(JSON.stringify(snapshot), 'before.json')).toEqual(
			snapshot,
		);
		expect(() => parseDataIntegritySnapshot('{', 'before.json')).toThrow(/not valid JSON/);
		expect(() =>
			parseDataIntegritySnapshot(JSON.stringify({ version: 1, tables: {} }), 'manifest.json'),
		).toThrow(/not a version 1 data integrity snapshot/);
	});
});

describe('parseSnapshotArgs', () => {
	it('accepts capture, capture-and-compare and file-only compare', () => {
		expect(parseSnapshotArgs(['--', '--target=production', '--out=a.json'])).toEqual({
			target: 'production',
			out: 'a.json',
		});
		expect(
			parseSnapshotArgs(['--target=preview', '--out=b.json', '--compare=a.json']),
		).toMatchObject({ compare: 'a.json' });
		expect(parseSnapshotArgs(['--compare=a.json', '--after=b.json'])).toEqual({
			compare: 'a.json',
			after: 'b.json',
		});
	});

	it('rejects unknown targets, flags and incomplete combinations', () => {
		expect(() => parseSnapshotArgs(['--target=staging', '--out=a.json'])).toThrow(
			/--target must be one of/,
		);
		expect(() => parseSnapshotArgs(['--target=preview'])).toThrow(/required to capture/);
		expect(() => parseSnapshotArgs(['--after=b.json'])).toThrow(/needs --compare/);
		expect(() =>
			parseSnapshotArgs(['--target=preview', '--compare=a.json', '--after=b.json']),
		).toThrow(/drop --target/);
		expect(() => parseSnapshotArgs(['--force'])).toThrow(/Unknown argument/);
	});
});
