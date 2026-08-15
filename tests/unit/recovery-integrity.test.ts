import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isReadOnlySql } from '../../scripts/db/production-boundary-policy';
import {
	buildRecoveryIntegrityCaptureSql,
	captureRecoveryIntegrity,
	compareRecoveryIntegrity,
	CRITICAL_RECOVERY_TABLES,
	parsePsqlJsonPayload,
	wrapRecoveryIntegrityPsqlInput,
	type RecoveryIntegritySnapshot,
} from '../../scripts/db/recovery-integrity';

function snapshot(): RecoveryIntegritySnapshot {
	return {
		version: 1,
		profile: 'phase3',
		capturedAt: '2026-07-29T12:00:00.000Z',
		migrationCount: 67,
		migrationVersions: ['20260729152113'],
		migrationSha256: 'a'.repeat(64),
		tables: {
			'public.guest_invitations': { rowCount: 3, sha256: 'b'.repeat(64) },
		},
		businessStateSha256: 'c'.repeat(64),
		invariants: { orphanGuests: 0 },
	};
}

describe('recovery integrity comparison', () => {
	it('accepts exact recovery evidence', () => {
		const expected = snapshot();
		const actual = structuredClone(expected);
		expect(compareRecoveryIntegrity(expected, actual)).toEqual({ ok: true, failures: [] });
	});

	it('reports count, checksum, business-state, and invariant failures', () => {
		const expected = snapshot();
		const actual = structuredClone(expected);
		actual.migrationCount = 66;
		actual.tables['public.guest_invitations'] = {
			rowCount: 2,
			sha256: 'd'.repeat(64),
		};
		actual.businessStateSha256 = 'e'.repeat(64);
		actual.invariants.orphanGuests = 1;
		const result = compareRecoveryIntegrity(expected, actual);
		expect(result.ok).toBe(false);
		expect(result.failures.join('\n')).toMatch(/Migration count mismatch/);
		expect(result.failures.join('\n')).toMatch(/row-count mismatch/);
		expect(result.failures.join('\n')).toMatch(/checksum mismatch/);
		expect(result.failures.join('\n')).toMatch(/business-state checksum mismatch/);
		expect(result.failures.join('\n')).toMatch(/Invariant orphanGuests/);
	});

	it('can compare two capture points without treating a stable pre-existing invariant as drift', () => {
		const expected = snapshot();
		expected.invariants.orphanGuests = 1;
		const actual = structuredClone(expected);
		expect(
			compareRecoveryIntegrity(expected, actual, { requireValidInvariants: false }),
		).toEqual({ ok: true, failures: [] });
	});

	it('rejects a recovery snapshot captured under a different schema profile', () => {
		const expected = snapshot();
		const actual = structuredClone(expected);
		actual.profile = 'pre-phase3';
		expect(compareRecoveryIntegrity(expected, actual).failures).toEqual([
			'Recovery integrity profile mismatch: expected phase3, got pre-phase3.',
		]);
	});
});

describe('recovery integrity capture SQL', () => {
	it('batches every critical table into one query without per-table PK lookups', () => {
		const sql = buildRecoveryIntegrityCaptureSql('phase3');
		expect(sql).not.toMatch(/pg_index/);
		for (const { schema, table } of CRITICAL_RECOVERY_TABLES) {
			expect(sql).toContain(`'${schema}.${table}'`);
		}
		expect(sql).toContain('invitation_mutation_operation_receipts');
		expect(buildRecoveryIntegrityCaptureSql('pre-phase3')).not.toContain(
			'invitation_mutation_operation_receipts',
		);
	});

	it('orders fingerprints by each table primary key instead of assuming t.id', () => {
		const sql = buildRecoveryIntegrityCaptureSql('phase3');
		const nonIdPrimaryKeys = {
			'public.rsvp_records': 't.store_key',
			'public.rsvp_audit_log': 't.audit_id',
			'public.rsvp_channel_log': 't.channel_event_id',
			'public.invitation_publication_idempotency': 't.idempotency_key',
			'public.managed_invitation_release_provenance': 't.invitation_id',
		} as const;
		for (const { schema, table, orderBy } of CRITICAL_RECOVERY_TABLES) {
			expect(sql).toContain(`order by ${orderBy}`);
			const qualified = `${schema}.${table}` as keyof typeof nonIdPrimaryKeys;
			if (qualified in nonIdPrimaryKeys) {
				expect(orderBy).toBe(nonIdPrimaryKeys[qualified]);
				expect(orderBy).not.toBe('t.id');
			}
		}
		expect(sql).toMatch(/order by t\.store_key[\s\S]*from "public"\."rsvp_records" t/);
	});

	it('sends the batched snapshot through stdin as read-only SQL, not --command', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/recovery-integrity.ts'),
			'utf8',
		);
		expect(source).toContain('input: wrapRecoveryIntegrityPsqlInput(sql)');
		expect(source).toContain("'--quiet'");
		expect(source).not.toMatch(/--command[\s\S]*COPY/);
		const sessionSql = wrapRecoveryIntegrityPsqlInput(
			buildRecoveryIntegrityCaptureSql('phase3'),
		);
		expect(isReadOnlySql(sessionSql)).toBe(true);
		expect(sessionSql.startsWith("SET statement_timeout = '0';")).toBe(true);
	});

	it('parses JSON after psql command tags such as SET', () => {
		expect(
			parsePsqlJsonPayload<{ tables: { 'public.rsvp_records': { rowCount: number } } }>(
				'SET\n{"tables":{"public.rsvp_records":{"rowCount":1}}}\n',
				'recovery integrity snapshot',
			).tables['public.rsvp_records'].rowCount,
		).toBe(1);
		expect(parsePsqlJsonPayload<number[]>(`SET\n[1,2]\n`, 'array result')).toEqual([1, 2]);
	});

	it('captures a snapshot with a single copy() call', () => {
		const tables = Object.fromEntries(
			CRITICAL_RECOVERY_TABLES.map(({ schema, table }) => [
				`${schema}.${table}`,
				{ rowCount: 1, sha256: 'b'.repeat(64) },
			]),
		);
		const copy = jest.fn(
			() =>
				`SET\n${JSON.stringify({
					tables,
					migrationsText: '20260729152113\n',
					invariants: { orphanGuests: 0 },
					businessState: { guestAttendeeTotal: 0 },
				})}\n`,
		);
		const captured = captureRecoveryIntegrity('postgresql://unused', { copy });
		expect(copy).toHaveBeenCalledTimes(1);
		expect(captured.migrationCount).toBe(1);
		expect(captured.migrationVersions).toEqual(['20260729152113']);
		expect(captured.tables['public.guest_invitations']?.rowCount).toBe(1);
		expect(captured.invariants.orphanGuests).toBe(0);
		expect(captured.businessStateSha256).toHaveLength(64);
	});
});
