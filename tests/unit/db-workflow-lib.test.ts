import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sqlLiteral, createProdBackup } from '../../scripts/db/db-workflow-lib.ts';

jest.mock('node:child_process', () => ({
	spawnSync: jest.fn(() => ({ status: 0, stdout: '', stderr: '', error: undefined })),
}));

jest.mock('node:fs', () => {
	const actual = jest.requireActual('node:fs');
	return {
		...actual,
		mkdirSync: jest.fn(),
	};
});

const { spawnSync } = jest.requireMock('node:child_process') as {
	spawnSync: jest.Mock;
};

describe('sqlLiteral', () => {
	it('wraps a plain string in single quotes', () => {
		expect(sqlLiteral('hello')).toBe("'hello'");
	});

	it('returns empty quoted string for empty input', () => {
		expect(sqlLiteral('')).toBe("''");
	});

	it('escapes embedded single quotes by doubling them', () => {
		expect(sqlLiteral("it's")).toBe("'it''s'");
		expect(sqlLiteral("a''b")).toBe("'a''''b'");
	});

	it('preserves newlines inside the literal', () => {
		expect(sqlLiteral('line1\nline2')).toBe("'line1\nline2'");
	});

	it('preserves unicode characters', () => {
		expect(sqlLiteral('celebra-me \u00f1')).toBe("'celebra-me \u00f1'");
		expect(sqlLiteral('\u{1F600}')).toBe("'\u{1F600}'");
	});

	it('preserves backslashes', () => {
		expect(sqlLiteral('path\\to\\file')).toBe("'path\\to\\file'");
	});

	it('handles multiple special characters together', () => {
		expect(sqlLiteral("O'Brien\n\u00e9\\x")).toBe("'O''Brien\n\u00e9\\x'");
	});
});

describe('createProdBackup', () => {
	const fakeUrl = 'postgresql://user:pass@db.example.supabase.co:5432/postgres';

	beforeEach(() => {
		spawnSync.mockClear();
	});

	it('passes --data-only and --use-copy for data backup (schemaOnly=false)', () => {
		createProdBackup(fakeUrl, '/tmp/dump.sql', false);
		expect(spawnSync).toHaveBeenCalledTimes(1);
		const args = spawnSync.mock.calls[0][1] as string[];
		expect(args).toContain('--data-only');
		expect(args).toContain('--use-copy');
		expect(args).not.toContain('--schema-only');
	});

	it('passes --schema-only for schema backup (schemaOnly=true)', () => {
		createProdBackup(fakeUrl, '/tmp/dump.sql', true);
		expect(spawnSync).toHaveBeenCalledTimes(1);
		const args = spawnSync.mock.calls[0][1] as string[];
		expect(args).toContain('--schema-only');
		expect(args).not.toContain('--data-only');
		expect(args).not.toContain('--use-copy');
	});

	it('includes --schema public and -f output in both modes', () => {
		createProdBackup(fakeUrl, '/tmp/data.sql', false);
		let args = spawnSync.mock.calls[0][1] as string[];
		expect(args).toContain('--schema');
		expect(args).toContain('public');
		expect(args).toContain('-f');
		expect(args).toContain('/tmp/data.sql');

		spawnSync.mockClear();
		createProdBackup(fakeUrl, '/tmp/schema.sql', true);
		args = spawnSync.mock.calls[0][1] as string[];
		expect(args).toContain('--schema');
		expect(args).toContain('public');
		expect(args).toContain('-f');
		expect(args).toContain('/tmp/schema.sql');
	});

	it('passes the db-url via --db-url arg', () => {
		createProdBackup(fakeUrl, '/tmp/dump.sql', false);
		const args = spawnSync.mock.calls[0][1] as string[];
		expect(args).toContain('--db-url');
		expect(args).toContain(fakeUrl);
	});
});

describe('refresh-copy.sql placeholder guard', () => {
	it('contains only the known placeholders __STAGING_SCHEMA__ and __STORAGE_BUCKET_SIZE_LIMIT__', () => {
		const sqlPath = resolve(process.cwd(), 'scripts', 'db', 'sql', 'refresh-copy.sql');
		const template = readFileSync(sqlPath, 'utf8');
		const placeholders = template.match(/__[A-Z_]+__/g) ?? [];
		const known = new Set(['__STAGING_SCHEMA__', '__STORAGE_BUCKET_SIZE_LIMIT__']);
		const unknown = placeholders.filter((p) => !known.has(p));
		expect(unknown).toEqual([]);
	});

	it('has all known placeholders fully replaced after loadCopySql logic', () => {
		const sqlPath = resolve(process.cwd(), 'scripts', 'db', 'sql', 'refresh-copy.sql');
		const template = readFileSync(sqlPath, 'utf8');
		const replaced = template
			.replaceAll('__STAGING_SCHEMA__', 'refresh_staging')
			.replaceAll('__STORAGE_BUCKET_SIZE_LIMIT__', '10485760');
		const remaining = replaced.match(/__[A-Z_]+__/g);
		expect(remaining).toBeNull();
	});
});
