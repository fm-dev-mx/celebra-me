import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from '@jest/globals';

const MIGRATION = resolve(
	process.cwd(),
	'supabase/migrations/20260812210000_reconcile_guest_invitation_phone_objects.sql',
);

describe('guest invitation phone reconciliation migration', () => {
	const sql = readFileSync(MIGRATION, 'utf8');

	it('inspects catalog objects and fails closed without ADD CONSTRAINT IF NOT EXISTS', () => {
		expect(sql).toMatch(/pg_index|pg_constraint|pg_class/);
		expect(sql).toMatch(/pg_get_constraintdef|pg_get_indexdef/);
		expect(sql).not.toMatch(/ADD CONSTRAINT IF NOT EXISTS/i);
		expect(sql).not.toMatch(/schema_migrations/);
		expect(sql).toContain('idx_guest_invitations_phone');
		expect(sql).toContain('idx_guest_invitations_phone_e164');
		expect(sql).toContain('guest_invitations_phone_country_code_pair_check');
	});

	it('raises on incompatible index, incompatible check, and unsupported catalog states', () => {
		expect(sql).toContain('PHONE_INDEX_INCOMPATIBLE');
		expect(sql).toContain('PHONE_CHECK_INCOMPATIBLE');
		expect(sql).toContain('PHONE_RECONCILE_UNSUPPORTED');
		expect(sql).toMatch(/RAISE EXCEPTION/);
	});

	it('covers both confirmed starting states without dropping unknown objects', () => {
		expect(sql).toMatch(/ALTER INDEX public\.idx_guest_invitations_phone_e164 RENAME TO idx_guest_invitations_phone/);
		expect(sql).toMatch(/DROP INDEX public\.idx_guest_invitations_phone_e164/);
		expect(sql).toMatch(/ADD CONSTRAINT guest_invitations_phone_country_code_pair_check/);
		expect(sql).not.toMatch(/DROP CONSTRAINT/i);
		expect(sql).not.toMatch(/CREATE INDEX/i);
		expect(sql).toMatch(
			/PHONE_RECONCILE_UNSUPPORTED: no btree\(phone\) index on public\.guest_invitations/,
		);
	});
});
