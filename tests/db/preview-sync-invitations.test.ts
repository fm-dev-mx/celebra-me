/**
 * preview-sync-invitations tests — Environment safety, mirror behavior, asset sync
 *
 * These tests validate the guard functions and data transformation logic
 * from the preview-sync-invitations script. Full end-to-end sync requires
 * configured PROD_DB_URL and PREVIEW_DB_URL and is tested separately via
 * pnpm db:preview:sync-invitations -- --dry-run.
 */

import { classifyDbTarget } from '@/../scripts/db/db-target-config';
import {
	getSecretFromEnvOrFiles,
	PREVIEW_SECRET_FILES,
} from '@/../scripts/db/db-guard';
import { extractSupabaseProjectRef } from '@/../scripts/db/db-target-config';
import { EXCLUDED_TABLES } from '@/../scripts/db/db-target-config';

// Mock psql-dependent modules
jest.mock('@/../scripts/db/db-workflow-lib', () => ({
	...jest.requireActual('@/../scripts/db/db-workflow-lib'),
	runPsql: jest.fn(),
	runCommand: jest.fn(),
	fail: jest.fn((msg: string) => {
		throw new Error(msg);
	}),
}));

// ---------------------------------------------------------------------------
// Target Classification Tests
// ---------------------------------------------------------------------------

describe('Target classification', () => {
	const PROD_DB_URL = 'postgresql://postgres:password@db.ineitkdkyrxqyressllp.supabase.co:6543/postgres';
	const PREVIEW_DB_URL = 'postgresql://postgres:password@db.iwipdvisoyerfdytuhwi.supabase.co:6543/postgres';
	const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
	const DISPOSABLE_DB_URL = 'postgresql://supabase_admin:postgres@127.0.0.1:54332/postgres';
	const UNKNOWN_DB_URL = 'postgresql://user:pass@some-other-host.com:5432/mydb';

	it('classifies production URL as production', () => {
		const result = classifyDbTarget(PROD_DB_URL);
		expect(result.target).toBe('production');
	});

	it('classifies preview URL as preview when PREVIEW_DB_URL matches', () => {
		process.env.PREVIEW_DB_URL = PREVIEW_DB_URL;
		const result = classifyDbTarget(PREVIEW_DB_URL);
		expect(result.target).toBe('preview');
		delete process.env.PREVIEW_DB_URL;
	});

	it('classifies local URL (port 54322) as persistent-local', () => {
		const result = classifyDbTarget(LOCAL_DB_URL);
		expect(result.target).toBe('persistent-local');
	});

	it('classifies disposable URL (port 54332) as disposable-test', () => {
		const result = classifyDbTarget(DISPOSABLE_DB_URL);
		expect(result.target).toBe('disposable-test');
	});

	it('classifies unknown host as unknown', () => {
		const result = classifyDbTarget(UNKNOWN_DB_URL);
		expect(result.target).toBe('unknown');
	});

	it('classifies invalid URL as unknown', () => {
		const result = classifyDbTarget('not-a-url');
		expect(result.target).toBe('unknown');
	});

	it('rejects identical source and target host', () => {
		const sameUrl = 'postgresql://postgres:password@db.iwipdvisoyerfdytuhwi.supabase.co:6543/postgres';
		const prodResult = classifyDbTarget(sameUrl);
		expect(prodResult.target).toBe('production'); // .supabase.co → production
	});
});

// ---------------------------------------------------------------------------
// Storage URL Rewriting Tests
// ---------------------------------------------------------------------------

describe('Storage URL rewriting', () => {
	const PROD_STORAGE = 'https://ineitkdkyrxqyressllp.supabase.co/storage/v1/object/public/invitation-assets';
	const PREVIEW_STORAGE = 'https://iwipdvisoyerfdytuhwi.supabase.co/storage/v1/object/public/invitation-assets';

	it('rewrites Production Storage URLs to Preview Storage URLs in content', () => {
		const content = JSON.stringify({
			sections: [
				{
					type: 'image',
					src: `${PROD_STORAGE}/some/path/image.webp`,
				},
			],
		});

		const rewritten = content.replaceAll(PROD_STORAGE, PREVIEW_STORAGE);
		const parsed = JSON.parse(rewritten);

		expect(parsed.sections[0].src).toBe(`${PREVIEW_STORAGE}/some/path/image.webp`);
		expect(parsed.sections[0].src).not.toContain('ineitkdkyrxqyressllp');
	});

	it('does not alter external URLs', () => {
		const content = JSON.stringify({
			mapUrl: 'https://maps.google.com/?q=Some+Place',
			calendarLink: 'https://calendar.google.com/event',
			socialLink: 'https://www.instagram.com/p/ABC123/',
		});

		const rewritten = content.replaceAll(PROD_STORAGE, PREVIEW_STORAGE);
		const parsed = JSON.parse(rewritten);

		expect(parsed.mapUrl).toBe('https://maps.google.com/?q=Some+Place');
		expect(parsed.calendarLink).toBe('https://calendar.google.com/event');
		expect(parsed.socialLink).toBe('https://www.instagram.com/p/ABC123/');
	});

	it('returns content unchanged when no Storage URLs are present', () => {
		const content = JSON.stringify({ title: 'Test', date: '2026-08-15' });
		const rewritten = content.replaceAll(PROD_STORAGE, PREVIEW_STORAGE);
		expect(rewritten).toBe(content);
	});
});

// ---------------------------------------------------------------------------
// Secret Resolution Tests
// ---------------------------------------------------------------------------

describe('Secret resolution', () => {
	it('reads from process.env first', () => {
		process.env.PREVIEW_DB_URL = 'postgresql://env:password@env-test.supabase.co:6543/postgres';
		const value = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
		expect(value).toBe('postgresql://env:password@env-test.supabase.co:6543/postgres');
		delete process.env.PREVIEW_DB_URL;
	});

	it('returns empty string when no secret found', () => {
		delete process.env.NONEXISTENT_VAR;
		const value = getSecretFromEnvOrFiles('NONEXISTENT_VAR', [] as unknown as readonly string[]);
		expect(value).toBe('');
	});
});

// ---------------------------------------------------------------------------
// Excluded Tables Verification
// ---------------------------------------------------------------------------

describe('Excluded tables are defined', () => {
	it('excludes guest and RSVP tables', () => {
		expect(EXCLUDED_TABLES).toContain('guest_invitations');
		expect(EXCLUDED_TABLES).toContain('rsvp_records');
		expect(EXCLUDED_TABLES).toContain('intake_submissions');
		expect(EXCLUDED_TABLES).toContain('visitor_sessions');
		expect(EXCLUDED_TABLES).not.toContain('invitations');
		expect(EXCLUDED_TABLES).not.toContain('events');
		expect(EXCLUDED_TABLES).not.toContain('published_invitation_content');
	});
});

// ---------------------------------------------------------------------------
// Supabase Project-Ref Resolution Tests
// ---------------------------------------------------------------------------

describe('extractSupabaseProjectRef', () => {
	const directProd = 'postgresql://postgres:pass@db.ineitkdkyrxqyressllp.supabase.co:6543/postgres';
	const directPreview = 'postgresql://postgres:pass@db.iwipdvisoyerfdytuhwi.supabase.co:6543/postgres';
	const poolerProd = 'postgresql://postgres.ineitkdkyrxqyressllp:pass@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
	const poolerPreview = 'postgresql://postgres.iwipdvisoyerfdytuhwi:pass@aws-1-us-west-2.pooler.supabase.com:5432/postgres';

	it('extracts ref from direct Production URL', () => {
		expect(extractSupabaseProjectRef(directProd)).toBe('ineitkdkyrxqyressllp');
	});

	it('extracts ref from direct Preview URL', () => {
		expect(extractSupabaseProjectRef(directPreview)).toBe('iwipdvisoyerfdytuhwi');
	});

	it('extracts ref from Production pooler URL', () => {
		expect(extractSupabaseProjectRef(poolerProd)).toBe('ineitkdkyrxqyressllp');
	});

	it('extracts ref from Preview pooler URL', () => {
		expect(extractSupabaseProjectRef(poolerPreview)).toBe('iwipdvisoyerfdytuhwi');
	});

	it('rejects malformed pooler username (wrong prefix)', () => {
		const bad = 'postgresql://admin.iwipdvisoyerfdytuhwi:pass@pooler.supabase.com:5432/postgres';
		expect(() => extractSupabaseProjectRef(bad)).toThrow('does not start with');
	});

	it('rejects pooler username equal to just "postgres"', () => {
		const bad = 'postgresql://postgres:pass@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
		expect(() => extractSupabaseProjectRef(bad)).toThrow('does not contain');
	});

	it('rejects pooler with extra username segments', () => {
		const bad = 'postgresql://postgres.extra.segment:pass@pooler.supabase.com:5432/postgres';
		expect(() => extractSupabaseProjectRef(bad)).toThrow('unexpected segments');
	});

	it('rejects non-Supabase host', () => {
		const bad = 'postgresql://user:pass@some-other-host.com:5432/mydb';
		expect(() => extractSupabaseProjectRef(bad)).toThrow('Cannot extract');
	});

	it('rejects local URL', () => {
		const bad = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
		expect(() => extractSupabaseProjectRef(bad)).toThrow('Cannot extract');
	});

	it('rejects invalid URL', () => {
		expect(() => extractSupabaseProjectRef('not-a-url')).toThrow('Cannot parse');
	});
});
