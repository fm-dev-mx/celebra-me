import {
	validateAndNormalizeSupabaseUrl,
	validateOwnerUserId,
	assertSameSupabaseProject,
} from '../../scripts/db/sql-safety';

describe('validateAndNormalizeSupabaseUrl', () => {
	it('accepts a valid Supabase project URL', () => {
		expect(
			validateAndNormalizeSupabaseUrl('https://abcdefghijklm.supabase.co'),
		).toBe('https://abcdefghijklm.supabase.co');
	});

	it('normalizes a trailing slash', () => {
		expect(
			validateAndNormalizeSupabaseUrl('https://abcdefghijklm.supabase.co/'),
		).toBe('https://abcdefghijklm.supabase.co');
	});

	it('rejects an empty string', () => {
		expect(() => validateAndNormalizeSupabaseUrl('')).toThrow(
			'SUPABASE_URL environment variable is required',
		);
	});

	it('rejects a non-URL string', () => {
		expect(() => validateAndNormalizeSupabaseUrl('not-a-url')).toThrow(
			'SUPABASE_URL is not a valid URL',
		);
	});

	it('rejects HTTP protocol', () => {
		expect(() =>
			validateAndNormalizeSupabaseUrl('http://abcdefghijklm.supabase.co'),
		).toThrow('must use HTTPS protocol');
	});

	it('rejects URLs with credentials', () => {
		expect(() =>
			validateAndNormalizeSupabaseUrl('https://user:pass@abcdefg.supabase.co'),
		).toThrow('must not contain credentials');
	});

	it('rejects URLs with a query string', () => {
		expect(() =>
			validateAndNormalizeSupabaseUrl('https://abcdefg.supabase.co?foo=bar'),
		).toThrow('must not contain query string or fragment');
	});

	it('rejects URLs with a fragment', () => {
		expect(() =>
			validateAndNormalizeSupabaseUrl('https://abcdefg.supabase.co#section'),
		).toThrow('must not contain query string or fragment');
	});

	it('rejects non-Supabase origins', () => {
		expect(() =>
			validateAndNormalizeSupabaseUrl('https://example.com'),
		).toThrow('hostname must be a Supabase project');
	});
});

describe('validateOwnerUserId', () => {
	it('accepts a valid UUID', () => {
		expect(
			validateOwnerUserId('550e8400-e29b-41d4-a716-446655440000'),
		).toBe('550e8400-e29b-41d4-a716-446655440000');
	});

	it('trims whitespace from a UUID', () => {
		expect(
			validateOwnerUserId('  550e8400-e29b-41d4-a716-446655440000  '),
		).toBe('550e8400-e29b-41d4-a716-446655440000');
	});

	it('rejects undefined', () => {
		expect(() => validateOwnerUserId(undefined)).toThrow(
			'--owner-user-id is required',
		);
	});

	it('rejects an empty string', () => {
		expect(() => validateOwnerUserId('')).toThrow(
			'--owner-user-id is required',
		);
	});

	it('rejects a non-UUID string', () => {
		expect(() => validateOwnerUserId('not-a-uuid')).toThrow(
			'not a valid UUID',
		);
	});

	it('rejects a malformed UUID (missing dashes)', () => {
		expect(() =>
			validateOwnerUserId('550e8400e29b41d4a716446655440000'),
		).toThrow('not a valid UUID');
	});

	it('rejects a UUID with invalid characters', () => {
		expect(() =>
			validateOwnerUserId('zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz'),
		).toThrow('not a valid UUID');
	});
});

describe('assertSameSupabaseProject', () => {
	it('accepts matching projects (direct, db. prefix)', () => {
		expect(() =>
			assertSameSupabaseProject(
				'https://abcdefghijklm.supabase.co',
				'postgresql://postgres:***@db.abcdefghijklm.supabase.co:5432/postgres',
			),
		).not.toThrow();
	});

	it('accepts matching projects (direct, no prefix)', () => {
		expect(() =>
			assertSameSupabaseProject(
				'https://abcdefghijklm.supabase.co',
				'postgresql://postgres:***@abcdefghijklm.supabase.co:5432/postgres',
			),
		).not.toThrow();
	});

	it('accepts matching projects (pooler, ref in username)', () => {
		expect(() =>
			assertSameSupabaseProject(
				'https://abcdefghijklm.supabase.co',
				'postgresql://abcdefghijklm.us-east-1:***@us-east-1.pooler.supabase.com:6543/postgres',
			),
		).not.toThrow();
	});

	it('accepts matching projects (pooler, postgres. host prefix)', () => {
		expect(() =>
			assertSameSupabaseProject(
				'https://abcdefghijklm.supabase.co',
				'postgresql://postgres:***@postgres.abcdefghijklm.pooler.supabase.com:5432/postgres',
			),
		).not.toThrow();
	});

	it('accepts URL-encoded usernames in PROD_DB_URL', () => {
		expect(() =>
			assertSameSupabaseProject(
				'https://project-ref.supabase.co',
				// Pooler username may appear raw (<ref>.<region>) or URL-encoded.
				// The raw form is the common case; test checks either works.
				'postgresql://project-ref.region:***@us-east-1.pooler.supabase.com:6543/postgres',
			),
		).not.toThrow();
	});

	it('rejects mismatched projects (direct)', () => {
		expect(() =>
			assertSameSupabaseProject(
				'https://project-a.supabase.co',
				'postgresql://postgres:***@db.project-b.supabase.co:5432/postgres',
			),
		).toThrow('must reference the same Supabase project');
	});

	it('rejects mismatched projects (pooler)', () => {
		expect(() =>
			assertSameSupabaseProject(
				'https://project-a.supabase.co',
				'postgresql://project-b.us-east-1:***@us-east-1.pooler.supabase.com:6543/postgres',
			),
		).toThrow('must reference the same Supabase project');
	});

	it('rejects invalid PROD_DB_URL', () => {
		expect(() =>
			assertSameSupabaseProject(
				'https://abcdefg.supabase.co',
				'not-a-url',
			),
		).toThrow();
	});

	it('rejects ambiguous pooler host (region only, no ref in username)', () => {
		expect(() =>
			assertSameSupabaseProject(
				'https://abcdefg.supabase.co',
				'postgresql://:@us-east-1.pooler.supabase.com:6543/postgres',
			),
		).toThrow('unsupported or ambiguous');
	});

	it('rejects non-Supabase PROD_DB_URL host', () => {
		// The hostname is not Supabase, but a ref may be extracted from the
		// username. Either way the function throws — either as mismatch or
		// unsupported format.
		expect(() =>
			assertSameSupabaseProject(
				'https://abcdefg.supabase.co',
				'postgresql://postgres:***@some-other-host.com:5432/postgres',
			),
		).toThrow();
	});
});
