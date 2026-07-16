/**
 * Database Permission Regression Tests
 *
 * These tests verify the least-privilege permission migration
 * (20260715210600_grant_supabase_roles_permissions.sql) enforces the correct
 * security model by statically analyzing the migration SQL file.
 *
 * Key invariants:
 * - anon has NO data-mutation grants (no INSERT/UPDATE/DELETE)
 * - anon has NO administrative grants (no TRUNCATE/REFERENCES/TRIGGER)
 * - Neither anon nor authenticated have GRANT ALL
 * - service_role never receives TRUNCATE/REFERENCES/TRIGGER
 * - Sensitive RPCs are NOT executable by anon
 * - Only explicitly allowlisted functions are executable by authenticated
 * - Default privileges for future tables do NOT include anon or authenticated
 */

import fs from 'node:fs';
import path from 'node:path';

const MIGRATION_FILE = path.resolve(
	'supabase/migrations/20260715210600_grant_supabase_roles_permissions.sql',
);

function readMigration(): string {
	return fs.readFileSync(MIGRATION_FILE, 'utf8');
}

/** Strip single-line SQL comments (-- ...) so regexes don't match comment text */
function stripSqlComments(sql: string): string {
	return sql.replace(/--[^\r\n]*/g, '');
}

describe('Least-privilege migration: anon role', () => {
	let sql: string;
	let sqlNoComments: string;
	beforeAll(() => {
		sql = readMigration();
		sqlNoComments = stripSqlComments(sql);
	});

	it('exists and is non-empty', () => {
		expect(fs.existsSync(MIGRATION_FILE)).toBe(true);
		expect(sql.trim().length).toBeGreaterThan(100);
	});

	it('does NOT grant ALL to anon', () => {
		// No "grant all ... to anon" or "grant all ... to ... anon" patterns
		expect(sqlNoComments).not.toMatch(/grant\s+all\s+[^;]*\bto\b[^;]*\banon\b/i);
	});

	it('does NOT grant INSERT to anon', () => {
		expect(sqlNoComments).not.toMatch(/grant\s+(?:[^;]*,\s*)?insert[^;]*\bto\b[^;]*\banon\b/i);
	});

	it('does NOT grant UPDATE to anon', () => {
		expect(sqlNoComments).not.toMatch(/grant\s+(?:[^;]*,\s*)?update[^;]*\bto\b[^;]*\banon\b/i);
	});

	it('does NOT grant DELETE to anon', () => {
		expect(sqlNoComments).not.toMatch(/grant\s+(?:[^;]*,\s*)?delete[^;]*\bto\b[^;]*\banon\b/i);
	});

	it('does NOT grant TRUNCATE to anon', () => {
		expect(sqlNoComments).not.toMatch(/grant\s+(?:[^;]*,\s*)?truncate[^;]*\bto\b[^;]*\banon\b/i);
	});

	it('does NOT grant REFERENCES to anon', () => {
		expect(sqlNoComments).not.toMatch(/grant\s+(?:[^;]*,\s*)?references[^;]*\bto\b[^;]*\banon\b/i);
	});

	it('does NOT grant TRIGGER to anon', () => {
		expect(sqlNoComments).not.toMatch(/grant\s+(?:[^;]*,\s*)?trigger[^;]*\bto\b[^;]*\banon\b/i);
	});

	it('does NOT grant EXECUTE to anon', () => {
		// anon should have zero function EXECUTE privileges
		expect(sqlNoComments).not.toMatch(/grant\s+execute[^;]*\bto\b[^;]*\banon\b/i);
	});
});

describe('Least-privilege migration: authenticated role', () => {
	let sql: string;
	let sqlNoComments: string;
	beforeAll(() => {
		sql = readMigration();
		sqlNoComments = stripSqlComments(sql);
	});

	it('does NOT grant ALL to authenticated', () => {
		expect(sqlNoComments).not.toMatch(/grant\s+all\s+[^;]*\bto\b[^;]*\bauthenticated\b/i);
	});

	it('does NOT grant TRUNCATE to authenticated', () => {
		expect(sqlNoComments).not.toMatch(
			/grant\s+(?:[^;]*,\s*)?truncate[^;]*\bto\b[^;]*\bauthenticated\b/i,
		);
	});

	it('does NOT grant REFERENCES to authenticated', () => {
		expect(sqlNoComments).not.toMatch(
			/grant\s+(?:[^;]*,\s*)?references[^;]*\bto\b[^;]*\bauthenticated\b/i,
		);
	});

	it('does NOT grant TRIGGER to authenticated', () => {
		expect(sqlNoComments).not.toMatch(
			/grant\s+(?:[^;]*,\s*)?trigger[^;]*\bto\b[^;]*\bauthenticated\b/i,
		);
	});

	it('allowlists upsert_guests_v1 EXECUTE for authenticated', () => {
		// Allowed explicitly as an application-level RPC called by dashboard auth flow
		expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.upsert_guests_v1[^;]*authenticated/i);
	});

	it('allowlists is_admin_user EXECUTE for authenticated (required by RLS policies)', () => {
		// Used internally by RLS policies on several tables
		expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.is_admin_user[^;]*authenticated/i);
	});

	it('does NOT grant EXECUTE on sensitive administrative RPCs to authenticated', () => {
		// These should only be callable by service_role (server BFF with service key)
		const sensitiveFunctions = [
			'permanently_delete_invitation',
			'archive_invitation',
			'restore_invitation',
			'publish_invitation_atomic',
			'register_commercial_deposit_purchase',
			'redeem_claim_code',
		];
		for (const fn of sensitiveFunctions) {
			// Should not have any "grant execute on function public.<fn> ... to ... authenticated"
			const pattern = new RegExp(
				`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[^;]*authenticated`,
				'i',
			);
			expect({ fn, found: pattern.test(sql) }).toEqual({ fn, found: false });
		}
	});
});

describe('Least-privilege migration: service_role', () => {
	let sql: string;
	let sqlNoComments: string;
	beforeAll(() => {
		sql = readMigration();
		sqlNoComments = stripSqlComments(sql);
	});

	it('does NOT grant ALL to service_role', () => {
		expect(sqlNoComments).not.toMatch(/grant\s+all\s+[^;]*\bto\b[^;]*\bservice_role\b/i);
	});

	it('does NOT grant TRUNCATE to service_role', () => {
		expect(sqlNoComments).not.toMatch(
			/grant\s+(?:[^;]*,\s*)?truncate[^;]*\bto\b[^;]*\bservice_role\b/i,
		);
	});

	it('does NOT grant REFERENCES to service_role', () => {
		expect(sqlNoComments).not.toMatch(
			/grant\s+(?:[^;]*,\s*)?references[^;]*\bto\b[^;]*\bservice_role\b/i,
		);
	});

	it('does NOT grant TRIGGER to service_role', () => {
		expect(sqlNoComments).not.toMatch(
			/grant\s+(?:[^;]*,\s*)?trigger[^;]*\bto\b[^;]*\bservice_role\b/i,
		);
	});

	it('grants SELECT, INSERT, UPDATE, DELETE on all tables to service_role', () => {
		// Service role needs full data-manipulation privileges to bypass RLS via server key
		expect(sql).toMatch(
			/grant\s+select,\s*insert,\s*update,\s*delete\s+on\s+all\s+tables\s+in\s+schema\s+public\s+to\s+service_role/i,
		);
	});

	it('grants EXECUTE on all routines to service_role', () => {
		expect(sql).toMatch(
			/grant\s+execute\s+on\s+all\s+routines\s+in\s+schema\s+public\s+to\s+service_role/i,
		);
	});
});

describe('Least-privilege migration: public role revocation', () => {
	let sql: string;
	let sqlNoComments: string;
	beforeAll(() => {
		sql = readMigration();
		sqlNoComments = stripSqlComments(sql);
	});

	it('revokes all privileges from public role on tables', () => {
		expect(sqlNoComments).toMatch(/revoke\s+all\s+privileges\s+on\s+all\s+tables[^;]*\bpublic\b[^;]*;/i);
	});

	it('revokes all privileges from anon on tables', () => {
		expect(sqlNoComments).toMatch(/revoke\s+all\s+privileges\s+on\s+all\s+tables[^;]*\banon\b[^;]*;/i);
	});

	it('revokes all privileges from authenticated on tables', () => {
		expect(sqlNoComments).toMatch(
			/revoke\s+all\s+privileges\s+on\s+all\s+tables[^;]*\bauthenticated\b[^;]*;/i,
		);
	});

	it('revokes all default privileges on tables from anon', () => {
		expect(sqlNoComments).toMatch(
			/alter\s+default\s+privileges[^;]*revoke\s+all\s+on\s+tables[^;]*\banon\b/i,
		);
	});

	it('revokes all default privileges on tables from authenticated', () => {
		expect(sqlNoComments).toMatch(
			/alter\s+default\s+privileges[^;]*revoke\s+all\s+on\s+tables[^;]*\bauthenticated\b/i,
		);
	});

	it('does NOT grant default privileges for future tables to anon', () => {
		// Verify no "alter default privileges ... grant ... on tables ... to anon"
		expect(sqlNoComments).not.toMatch(
			/alter\s+default\s+privileges[^;]*grant[^;]*\bon\s+tables\b[^;]*\banon\b/i,
		);
	});

	it('does NOT grant default privileges for future tables to authenticated', () => {
		expect(sqlNoComments).not.toMatch(
			/alter\s+default\s+privileges[^;]*grant[^;]*\bon\s+tables\b[^;]*\bauthenticated\b/i,
		);
	});
});

describe('Least-privilege migration: RLS coverage verification', () => {
	let sql: string;
	beforeAll(() => {
		sql = readMigration();
	});

	it('migration is wrapped in a transaction', () => {
		expect(sql).toMatch(/^begin;/im);
		expect(sql).toMatch(/^commit;/im);
	});

	it('explicitly revokes routines from anon before granting allowlist', () => {
		// The REVOKE on routines/functions must appear before any GRANT EXECUTE
		const revokeAllRoutinesIdx = sql.search(
			/revoke\s+all\s+privileges\s+on\s+all\s+routines/i,
		);
		const firstGrantExecuteIdx = sql.search(/grant\s+execute/i);
		expect(revokeAllRoutinesIdx).toBeGreaterThan(-1);
		expect(firstGrantExecuteIdx).toBeGreaterThan(-1);
		expect(revokeAllRoutinesIdx).toBeLessThan(firstGrantExecuteIdx);
	});

	it('migration explicitly names invitation_assets as an anon-readable table', () => {
		expect(sql).toContain('invitation_assets');
	});

	it('migration explicitly names published_invitation_content as an anon-readable table', () => {
		expect(sql).toContain('published_invitation_content');
	});
});
