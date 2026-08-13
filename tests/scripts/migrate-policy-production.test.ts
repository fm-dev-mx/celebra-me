import { describe, expect, it } from '@jest/globals';
import { isAllowlistedBehindAuditOutput } from '../../scripts/db/migrate-policy-production.ts';
import {
	comparePendingSetToExpected,
	extractPendingMigrationVersions,
} from '../../scripts/db/migration-pending-set.ts';

describe('Production migration helpers', () => {
	it('treats BEHIND with Errors: 0 as allowlisted pre-apply audit output', () => {
		const output = [
			'Final schema lifecycle state: BEHIND',
			'Errors: 0',
			'AUDIT verdict details',
		].join('\n');
		expect(isAllowlistedBehindAuditOutput(output, 1)).toBe(true);
		expect(isAllowlistedBehindAuditOutput(output, 0)).toBe(false);
		expect(
			isAllowlistedBehindAuditOutput(
				'Final schema lifecycle state: SCHEMA_DRIFT\nErrors: 0',
				1,
			),
		).toBe(false);
	});

	it('still allowlists BEHIND when structural findings are reported as non-blocking', () => {
		const output = [
			'Final schema lifecycle state: BEHIND',
			'Structural findings: 2 (non-blocking while BEHIND)',
			'Errors: 0',
		].join('\n');
		expect(isAllowlistedBehindAuditOutput(output, 1)).toBe(true);
	});

	it('extracts unique pending versions from dry-run output', () => {
		const output =
			'Would apply 20260802090000_production_authorization_receipts.sql\n' +
			'Also mentions 20260802090000_production_authorization_receipts.sql again\n' +
			'and 20260730220544_public_guest_rsvp_rpc_pgcrypto_qualify.sql';
		expect(extractPendingMigrationVersions(output)).toEqual([
			'20260802090000',
			'20260730220544',
		]);
	});

	it('requires exact expected-set match for pending migrations', () => {
		expect(
			comparePendingSetToExpected(['20260802090000'], ['20260802090000']),
		).toEqual({ ok: true });
		expect(comparePendingSetToExpected(['20260802090000'], ['20260730220544']).ok).toBe(
			false,
		);
		expect(comparePendingSetToExpected([], ['20260802090000']).ok).toBe(false);
		expect(comparePendingSetToExpected([], ['none'])).toEqual({ ok: true });
	});
});
