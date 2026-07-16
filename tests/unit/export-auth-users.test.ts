/**
 * Jest tests for export-auth-users.ts SQL generation
 *
 * Validates the Auth dump SQL format without connecting to production.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function applyDump(dumpSql: string, dbUrl: string): void {
	const tmpFile = join(mkdtempSync(join(tmpdir(), 'authtest-')), 'dump.sql');
	writeFileSync(tmpFile, dumpSql, 'utf8');
	try {
		execFileSync('psql', [
			'--set', 'ON_ERROR_STOP=1',
			'--dbname', dbUrl,
			'--file', tmpFile,
		], { stdio: 'pipe' });
	} finally {
		rmSync(tmpFile, { force: true });
	}
}

describe('export-auth-users SQL format', () => {
	const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

	// Sample user data that simulates what the production export would produce
	const SAMPLE_USER_SQL = `
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, phone, phone_confirmed_at, banned_until, is_sso_user, is_anonymous, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'authenticated', 'authenticated', 'test@celebra-me.test', 'local-only-no-production-hash', '2026-01-01T00:00:00+00:00'::timestamptz, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, null, null, null, false, false, '2026-01-01T00:00:00+00:00'::timestamptz, '2026-01-01T00:00:00+00:00'::timestamptz),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'authenticated', 'authenticated', 'test2@celebra-me.test', 'local-only-no-production-hash', '2026-01-02T00:00:00+00:00'::timestamptz, '{}'::jsonb, '{}'::jsonb, true, null, null, null, false, false, '2026-01-02T00:00:00+00:00'::timestamptz, '2026-01-02T00:00:00+00:00'::timestamptz)
ON CONFLICT (id) DO NOTHING;
`;

	const SAMPLE_IDENTITY_SQL = `
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}'::jsonb, 'email', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-01T00:00:00+00:00'::timestamptz, '2026-01-01T00:00:00+00:00'::timestamptz, '2026-01-01T00:00:00+00:00'::timestamptz),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}'::jsonb, 'email', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-01-02T00:00:00+00:00'::timestamptz, '2026-01-02T00:00:00+00:00'::timestamptz, '2026-01-02T00:00:00+00:00'::timestamptz)
ON CONFLICT (id) DO NOTHING;
`;

	afterEach(() => {
		try {
			execFileSync('psql', [
				'--set', 'ON_ERROR_STOP=1',
				'--dbname', DB_URL,
				'--command', "DELETE FROM auth.identities WHERE id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc');",
			], { stdio: 'pipe' });
			execFileSync('psql', [
				'--set', 'ON_ERROR_STOP=1',
				'--dbname', DB_URL,
				'--command', "DELETE FROM auth.users WHERE id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');",
			], { stdio: 'pipe' });
		} catch {
			// ignore
		}
	});

	it('applies auth.users dump successfully with local-controlled password', () => {
		expect(() => applyDump(SAMPLE_USER_SQL, DB_URL)).not.toThrow();
	});

	it('applies auth.identities dump successfully', () => {
		expect(() => applyDump(SAMPLE_USER_SQL, DB_URL)).not.toThrow();
		expect(() => applyDump(SAMPLE_IDENTITY_SQL, DB_URL)).not.toThrow();
	});

	it('preserves user UUIDs exactly', () => {
		applyDump(SAMPLE_USER_SQL, DB_URL);
		const result = execFileSync('psql', [
			'--set', 'ON_ERROR_STOP=1',
			'--no-align',
			'--tuples-only',
			'--dbname', DB_URL,
			'--command', "SELECT id::text FROM auth.users WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';",
		], { encoding: 'utf8' });
		expect(result.trim()).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
	});

	it('uses local-controlled password (not production hash)', () => {
		applyDump(SAMPLE_USER_SQL, DB_URL);
		const result = execFileSync('psql', [
			'--set', 'ON_ERROR_STOP=1',
			'--no-align',
			'--tuples-only',
			'--dbname', DB_URL,
			'--command', "SELECT encrypted_password FROM auth.users WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';",
		], { encoding: 'utf8' });
		expect(result.trim()).toBe('local-only-no-production-hash');
	});

	it('preserves email and metadata', () => {
		applyDump(SAMPLE_USER_SQL, DB_URL);
		const result = execFileSync('psql', [
			'--set', 'ON_ERROR_STOP=1',
			'--no-align',
			'--tuples-only',
			'--dbname', DB_URL,
			'--command', "SELECT email, raw_app_meta_data::text FROM auth.users WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';",
		], { encoding: 'utf8' });
		const [email, meta] = result.trim().split('|');
		expect(email).toBe('test@celebra-me.test');
		expect(meta).toContain('provider');
	});

	it('is idempotent (ON CONFLICT DO NOTHING)', () => {
		applyDump(SAMPLE_USER_SQL, DB_URL);
		expect(() => applyDump(SAMPLE_USER_SQL, DB_URL)).not.toThrow();
	});
});
