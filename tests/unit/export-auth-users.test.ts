/**
 * Jest tests for export-auth-users.ts SQL generation
 *
 * Validates the Auth dump SQL format as a pure unit test without database access.
 */

import {
	generateAuthDump,
	type AuthUser,
	type AuthIdentity,
} from '../../scripts/db/export-auth-users';

describe('export-auth-users SQL generator', () => {
	const sampleUser: AuthUser = {
		id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
		aud: 'authenticated',
		role: 'authenticated',
		email: 'test@celebra-me.test',
		email_confirmed_at: '2026-01-01T00:00:00Z',
		raw_app_meta_data: { provider: 'email', providers: ['email'] },
		raw_user_meta_data: {},
		is_super_admin: false,
		phone: null,
		phone_confirmed_at: null,
		banned_until: null,
		deleted_at: null,
		is_sso_user: false,
		is_anonymous: false,
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
	};

	const sampleIdentity: AuthIdentity = {
		id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab',
		user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
		identity_data: { sub: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
		provider: 'email',
		provider_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
		last_sign_in_at: '2026-01-01T00:00:00Z',
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
	};

	it('generates valid SQL insert statement for auth.users', () => {
		const sql = generateAuthDump([sampleUser], []);
		expect(sql).toContain('INSERT INTO auth.users');
		expect(sql).toContain("'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid");
	});

	it('uses local-controlled password (not production hash)', () => {
		const sql = generateAuthDump([sampleUser], []);
		expect(sql).toContain("crypt('local-only-no-production-hash', gen_salt('bf'))");
	});

	it('preserves soft-deleted Auth users for relationship reconstruction', () => {
		const sql = generateAuthDump([{ ...sampleUser, deleted_at: '2026-02-01T00:00:00Z' }], []);
		expect(sql).toContain('deleted_at');
		expect(sql).toContain("'2026-02-01T00:00:00Z'::timestamptz");
	});

	it('emits valid no-op SQL when Auth users and identities are empty', () => {
		const sql = generateAuthDump([], []);
		expect(sql).not.toContain('INSERT INTO auth.users');
		expect(sql).not.toContain('INSERT INTO auth.identities');
		expect(sql).toContain('No Auth users were present');
		expect(sql).toContain('No Auth identities were present');
	});

	it('preserves email and metadata', () => {
		const sql = generateAuthDump([sampleUser], []);
		expect(sql).toContain("'test@celebra-me.test'");
		expect(sql).toContain('\'{"provider":"email","providers":["email"]}\'::jsonb');
	});

	it('generates valid SQL insert statement for auth.identities', () => {
		const sql = generateAuthDump([], [sampleIdentity]);
		expect(sql).toContain('INSERT INTO auth.identities');
		expect(sql).toContain("'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab'::uuid");
	});

	it('is idempotent (ON CONFLICT DO NOTHING)', () => {
		const sql = generateAuthDump([sampleUser], [sampleIdentity]);
		expect(sql).toContain('ON CONFLICT (id) DO NOTHING;');
	});

	it('emits non-null empty strings for tokens to avoid GoTrue database scan errors', () => {
		const sql = generateAuthDump([sampleUser], []);
		expect(sql).toContain('confirmation_token');
		expect(sql).toContain('recovery_token');
		expect(sql).toContain('email_change_token_new');
		expect(sql).toContain('email_change');
		// The query parameters should be blanked out empty strings: '', '', '', ''
		expect(sql).toContain(`'', '', '', ''`);
	});
});
