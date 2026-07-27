import { describe, it, expect } from '@jest/globals';
import {
	detectDatabaseSensitiveChanges,
	filterDatabaseSensitivePaths,
	isDatabaseSensitivePath,
	normalizeRepoPath,
} from '../../scripts/db/database-sensitive-paths';
import {
	compareMigrationTrees,
	formatBranchMigrationParityReport,
	hashContent,
	parseMigrationTree,
	runBranchMigrationParity,
	type GitRunner,
} from '../../scripts/db/branch-migration-parity';

describe('database-sensitive path classifier', () => {
	it('normalizes backslashes to forward slashes', () => {
		expect(normalizeRepoPath('supabase\\migrations\\a.sql')).toBe(
			'supabase/migrations/a.sql',
		);
	});

	it('treats migrations and DB ops paths as sensitive', () => {
		expect(isDatabaseSensitivePath('supabase/migrations/20260101000000_init.sql')).toBe(true);
		expect(isDatabaseSensitivePath('supabase/config.toml')).toBe(true);
		expect(isDatabaseSensitivePath('scripts/db/audit-db.ts')).toBe(true);
		expect(isDatabaseSensitivePath('scripts/manual/production-patches/x.sql')).toBe(true);
		expect(isDatabaseSensitivePath('docs/database-workflow.md')).toBe(true);
		expect(isDatabaseSensitivePath('.agent/rules/database.md')).toBe(true);
		expect(isDatabaseSensitivePath('docs/domains/database/overview.md')).toBe(true);
	});

	it('does not treat app runtime or content Zod paths as sensitive', () => {
		expect(isDatabaseSensitivePath('src/lib/repositories/guests.ts')).toBe(false);
		expect(isDatabaseSensitivePath('src/lib/schemas/content/event.ts')).toBe(false);
		expect(isDatabaseSensitivePath('docs/core/content-schema.md')).toBe(false);
		expect(isDatabaseSensitivePath('package.json')).toBe(false);
	});

	it('reports no sensitive hits for non-database branch sync paths', () => {
		const result = detectDatabaseSensitiveChanges([
			'src/pages/index.astro',
			'CHANGELOG.md',
			'tests/e2e/demo-routing-parity.spec.ts',
		]);
		expect(result.sensitive).toBe(false);
		expect(result.files).toEqual([]);
		expect(result.totalCompared).toBe(3);
	});

	it('filters and sorts sensitive hits deterministically', () => {
		expect(
			filterDatabaseSensitivePaths([
				'src/lib/x.ts',
				'scripts/db/z.ts',
				'supabase/migrations/a.sql',
				'scripts/db/a.ts',
			]),
		).toEqual(['scripts/db/a.ts', 'scripts/db/z.ts', 'supabase/migrations/a.sql']);
	});
});

describe('branch migration parity (identity + content)', () => {
	it('parses migration trees by version identity, not filename sort alone', () => {
		const parsed = parseMigrationTree([
			{
				path: 'supabase/migrations/20260102000000_later.sql',
				content: 'select 2;',
			},
			{
				path: 'supabase/migrations/20260101000000_earlier.sql',
				content: 'select 1;',
			},
		]);
		expect(parsed.malformed).toEqual([]);
		expect(parsed.duplicates).toEqual([]);
		expect(parsed.entries.map((e) => e.version)).toEqual([
			'20260101000000',
			'20260102000000',
		]);
		expect(parsed.entries[0]!.contentHash).toBe(hashContent('select 1;'));
	});

	it('detects duplicate migration identifiers', () => {
		const parsed = parseMigrationTree([
			{ path: 'supabase/migrations/20260101000000_a.sql', content: 'a' },
			{ path: 'supabase/migrations/20260101000000_b.sql', content: 'b' },
		]);
		expect(parsed.duplicates).toEqual([
			{
				version: '20260101000000',
				filenames: ['20260101000000_a.sql', '20260101000000_b.sql'],
			},
		]);
		const compared = compareMigrationTrees(parsed, parseMigrationTree([]));
		expect(compared.ok).toBe(false);
		// Duplicates make ok=false but don't push error messages (dedicated sections in the report)
		expect(compared.errors).toEqual([]);
	});

	it('detects malformed migration filenames', () => {
		const parsed = parseMigrationTree([
			{ path: 'supabase/migrations/not-a-migration.sql', content: 'x' },
		]);
		expect(parsed.malformed).toEqual(['not-a-migration.sql']);
		const compared = compareMigrationTrees(parsed, parseMigrationTree([]));
		expect(compared.ok).toBe(false);
	});

	it('detects new unapplied (head-only) migrations', () => {
		const base = parseMigrationTree([
			{ path: 'supabase/migrations/20260101000000_base.sql', content: 'base' },
		]);
		const head = parseMigrationTree([
			{ path: 'supabase/migrations/20260101000000_base.sql', content: 'base' },
			{ path: 'supabase/migrations/20260102000000_new.sql', content: 'new' },
		]);
		const compared = compareMigrationTrees(base, head);
		expect(compared.headOnly.map((e) => e.version)).toEqual(['20260102000000']);
		expect(compared.baseOnly).toEqual([]);
		expect(compared.contentMutations).toEqual([]);
		expect(compared.ok).toBe(true);
	});

	it('detects migration content changed after shared application identity', () => {
		const base = parseMigrationTree([
			{ path: 'supabase/migrations/20260101000000_shared.sql', content: 'original' },
		]);
		const head = parseMigrationTree([
			{ path: 'supabase/migrations/20260101000000_shared.sql', content: 'mutated' },
		]);
		const compared = compareMigrationTrees(base, head);
		expect(compared.contentMutations).toHaveLength(1);
		expect(compared.contentMutations[0]!.version).toBe('20260101000000');
		expect(compared.ok).toBe(false);
	});

	it('does not flag non-database changes as sensitive', () => {
		const baseMigrations = new Map([
			['supabase/migrations/20260101000000_base.sql', 'base'],
		]);

		const makeGit = (opts: {
			changed: string[];
			baseFiles: Map<string, string>;
			headFiles: Map<string, string>;
		}): GitRunner => {
			return (args) => {
				if (args[0] === 'diff' && args.includes('--name-only')) {
					return { status: 0, stdout: `${opts.changed.join('\n')}\n`, stderr: '' };
				}
				if (args[0] === 'ls-tree') {
					const ref = args[3];
					const files = ref === 'base' ? opts.baseFiles : opts.headFiles;
					return {
						status: 0,
						stdout: `${[...files.keys()].join('\n')}\n`,
						stderr: '',
					};
				}
				if (args[0] === 'show') {
					const [ref, path] = String(args[1]).split(':');
					const files = ref === 'base' ? opts.baseFiles : opts.headFiles;
					const content = files.get(path!);
					if (content === undefined) {
						return { status: 1, stdout: '', stderr: `missing ${args[1]}` };
					}
					return { status: 0, stdout: content, stderr: '' };
				}
				return { status: 1, stdout: '', stderr: `unexpected git ${args.join(' ')}` };
			};
		};

		const result = runBranchMigrationParity({
			baseRef: 'base',
			headRef: 'head',
			git: makeGit({
				changed: ['src/pages/index.astro', 'CHANGELOG.md'],
				baseFiles: baseMigrations,
				headFiles: baseMigrations,
			}),
		});
		expect(result.sensitiveDetection.sensitive).toBe(false);
		expect(result.ok).toBe(true);
		expect(result.headOnly).toEqual([]);
	});

	it('detects migration-sensitive changes and reports head-only versions', () => {
		const baseMigrations = new Map([
			['supabase/migrations/20260101000000_base.sql', 'base'],
		]);
		const headMigrations = new Map([
			['supabase/migrations/20260101000000_base.sql', 'base'],
			['supabase/migrations/20260102000000_new.sql', 'new'],
		]);

		const makeGit = (opts: {
			changed: string[];
			baseFiles: Map<string, string>;
			headFiles: Map<string, string>;
		}): GitRunner => {
			return (args) => {
				if (args[0] === 'diff' && args.includes('--name-only')) {
					return { status: 0, stdout: `${opts.changed.join('\n')}\n`, stderr: '' };
				}
				if (args[0] === 'ls-tree') {
					const ref = args[3];
					const files = ref === 'base' ? opts.baseFiles : opts.headFiles;
					return {
						status: 0,
						stdout: `${[...files.keys()].join('\n')}\n`,
						stderr: '',
					};
				}
				if (args[0] === 'show') {
					const [ref, path] = String(args[1]).split(':');
					const files = ref === 'base' ? opts.baseFiles : opts.headFiles;
					const content = files.get(path!);
					if (content === undefined) {
						return { status: 1, stdout: '', stderr: `missing ${args[1]}` };
					}
					return { status: 0, stdout: content, stderr: '' };
				}
				return { status: 1, stdout: '', stderr: `unexpected git ${args.join(' ')}` };
			};
		};

		const result = runBranchMigrationParity({
			baseRef: 'base',
			headRef: 'head',
			git: makeGit({
				changed: [
					'supabase/migrations/20260102000000_new.sql',
					'src/pages/index.astro',
				],
				baseFiles: baseMigrations,
				headFiles: headMigrations,
			}),
		});
		expect(result.sensitiveDetection.sensitive).toBe(true);
		expect(result.sensitiveDetection.files).toEqual([
			'supabase/migrations/20260102000000_new.sql',
		]);
		expect(result.headOnly.map((e) => e.version)).toEqual(['20260102000000']);
		expect(result.ok).toBe(true);
	});

	it('includes migration-sensitive details in the formatted report', () => {
		const baseMigrations = new Map([
			['supabase/migrations/20260101000000_base.sql', 'base'],
		]);
		const headMigrations = new Map([
			['supabase/migrations/20260101000000_base.sql', 'base'],
			['supabase/migrations/20260102000000_new.sql', 'new'],
		]);

		const makeGit = (opts: {
			changed: string[];
			baseFiles: Map<string, string>;
			headFiles: Map<string, string>;
		}): GitRunner => {
			return (args) => {
				if (args[0] === 'diff' && args.includes('--name-only')) {
					return { status: 0, stdout: `${opts.changed.join('\n')}\n`, stderr: '' };
				}
				if (args[0] === 'ls-tree') {
					const ref = args[3];
					const files = ref === 'base' ? opts.baseFiles : opts.headFiles;
					return {
						status: 0,
						stdout: `${[...files.keys()].join('\n')}\n`,
						stderr: '',
					};
				}
				if (args[0] === 'show') {
					const [ref, path] = String(args[1]).split(':');
					const files = ref === 'base' ? opts.baseFiles : opts.headFiles;
					const content = files.get(path!);
					if (content === undefined) {
						return { status: 1, stdout: '', stderr: `missing ${args[1]}` };
					}
					return { status: 0, stdout: content, stderr: '' };
				}
				return { status: 1, stdout: '', stderr: `unexpected git ${args.join(' ')}` };
			};
		};

		const result = runBranchMigrationParity({
			baseRef: 'base',
			headRef: 'head',
			git: makeGit({
				changed: [
					'supabase/migrations/20260102000000_new.sql',
					'src/pages/index.astro',
				],
				baseFiles: baseMigrations,
				headFiles: headMigrations,
			}),
		});
		const report = formatBranchMigrationParityReport(result);
		expect(report).toContain('Database-sensitive changes detected');
		expect(report).toContain('20260102000000_new.sql');
	});
});
