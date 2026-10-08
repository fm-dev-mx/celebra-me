/**
 * The disposable proof receipt is shared by every worktree, while `core.autocrlf` and editors
 * materialize the same committed migration as LF, CRLF or mixed per checkout. The proof must
 * bind to content, never to one checkout's line endings. Uses the real digest functions.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

let migrationsDir = '';
const VERSIONS = ['20260101000000', '20260102000000'];
const SQL: Record<string, string> = {
	'20260101000000': 'create table t (id int);\ncomment on table t is $$multi\nline$$;\n',
	'20260102000000': 'alter table t add column note text;\n',
};

jest.mock('../../scripts/db/apply-migrations.ts', () => ({
	getValidatedMigrationFiles: () =>
		VERSIONS.map((version) => ({
			version,
			// Absolute paths resolve as-is against the digest functions' migrations directory.
			filename: join(migrationsDir, `${version}_m.sql`),
			name: 'm',
		})),
}));

jest.mock('../../scripts/db/release-check.ts', () => ({
	readGitWorktreeState: () => ({ sha: 'a'.repeat(40), clean: true }),
}));

jest.mock('../../scripts/shared/git-paths.ts', () => ({
	gitCommonPath: () => {
		throw new Error('tests must pass an explicit proof path');
	},
}));

type Checkout = 'lf' | 'crlf' | 'mixed' | 'bom';

function materialize(checkout: Checkout, overrides: Record<string, string> = {}): void {
	for (const version of VERSIONS) {
		const sql = overrides[version] ?? SQL[version];
		let bytes = sql;
		if (checkout === 'crlf') bytes = sql.replace(/\n/g, '\r\n');
		if (checkout === 'mixed') {
			const index = sql.indexOf('\n');
			bytes = index >= 0 ? `${sql.slice(0, index)}\r\n${sql.slice(index + 1)}` : sql;
		}
		if (checkout === 'bom') bytes = `\uFEFF${sql.replace(/\n/g, '\r\n')}`;
		writeFileSync(join(migrationsDir, `${version}_m.sql`), bytes, 'utf8');
	}
}

describe('disposable migration proof across line-ending checkouts', () => {
	let dir: string;
	let path: string;
	const live = () => ({
		container: { name: 'celebra-me-test-db', id: 'c1', createdAt: '2026-10-01' },
		appliedVersions: [...VERSIONS],
	});

	beforeEach(() => {
		jest.resetModules();
		dir = mkdtempSync(join(tmpdir(), 'proof-eol-'));
		migrationsDir = mkdtempSync(join(dir, 'migrations-'));
		path = join(dir, 'db-evidence', 'disposable-migration-proof.json');
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	async function load() {
		jest.resetModules();
		return import('../../scripts/db/disposable-migration-proof.ts');
	}

	it.each<[Checkout, Checkout]>([
		['crlf', 'lf'],
		['lf', 'crlf'],
		['mixed', 'crlf'],
		['bom', 'lf'],
	])(
		'a receipt written from a %s checkout validates from a %s checkout',
		async (writer, reader) => {
			materialize(writer);
			(await load()).writeDisposableMigrationProof({
				appliedVersions: VERSIONS,
				path,
				readLive: live,
			});

			materialize(reader);
			const reloaded = await load();
			const result = reloaded.assertCurrentDisposableMigrationProof({ path, readLive: live });
			expect(result.reason).toMatch(/matches the current migration set/);
			expect(result.ok).toBe(true);
			expect(() =>
				reloaded.writeDisposableMigrationProof({
					appliedVersions: VERSIONS,
					path,
					readLive: live,
				}),
			).not.toThrow();
		},
	);

	it('still detects a real content edit of an applied migration', async () => {
		materialize('crlf');
		(await load()).writeDisposableMigrationProof({
			appliedVersions: VERSIONS,
			path,
			readLive: live,
		});

		materialize('lf', { '20260101000000': 'create table t (id bigint);\n' });
		const result = (await load()).assertCurrentDisposableMigrationProof({
			path,
			readLive: live,
		});
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/edited in place \(20260101000000\)/);
	});
});
