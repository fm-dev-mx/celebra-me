import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
	process.cwd(),
	'supabase',
	'migrations',
	'20260729140514_invitation_mutation_operation_receipts.sql',
);

describe('invitation mutation receipt migration', () => {
	const sql = fs.readFileSync(migrationPath, 'utf8');

	it('creates an append-only receipt table with the canonical outcomes', () => {
		expect(sql).toContain('create table public.invitation_mutation_operation_receipts');
		expect(sql).toContain("'not_applied', 'applied', 'partial', 'replayed'");
		expect(sql).toContain('grant select, insert');
		expect(sql).not.toMatch(/grant\s+(?:update|delete)/i);
		expect(sql).toContain('invitation_mutation_receipts_append_only');
	});

	it('enables RLS and keeps invitation deletion restrictive', () => {
		expect(sql).toContain('on delete restrict');
		expect(sql).toContain('enable row level security');
		expect(sql).toContain('force row level security');
	});

	it('stores only sanitized diagnostics by contract', () => {
		expect(sql).toContain('sanitized_error');
		expect(sql).toContain('Passwords, tokens, credentials, secrets');
	});

	it('removes ordinary invitation credential write authority from RSVP state', () => {
		expect(sql).toContain(
			'revoke insert, update, delete on public.guest_invitations from service_role',
		);
		expect(sql).toContain(
			'revoke insert, update, delete on public.guest_invitation_audit from service_role',
		);
	});
});
