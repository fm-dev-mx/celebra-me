import { resolve } from 'node:path';
import {
	checkSweep,
	parseWorktreeList,
	type SweepDeps,
} from '../../scripts/agent/worktree-doctor.ts';
import {
	classifySchema,
	collectDbsSection,
	collectMigrationsSection,
	dbsLocalItems,
	sweepToItems,
	type DbsEnvironmentSummary,
	type DbsSnapshot,
} from '../../scripts/ops/ops-console-snapshot.ts';
import { formatOpsSection } from '../../scripts/ops/ops-status.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-22T20:00:00Z');
const REPO = resolve('/work/celebra-me');
const LANES = resolve('/work/celebra-me-worktrees');
const slash = (path: string) => resolve(path).replaceAll('\\', '/');

function porcelain(entries: Array<{ path: string; branch?: string }>): string {
	return entries
		.map(({ path, branch }) =>
			[
				`worktree ${slash(path)}`,
				'HEAD 0000000000000000000000000000000000000000',
				branch ? `branch refs/heads/${branch}` : 'detached',
			].join('\n'),
		)
		.join('\n\n');
}

function fakeDeps(overrides: Partial<SweepDeps> & { merged?: string[] } = {}): SweepDeps {
	const worktrees = porcelain([
		{ path: REPO, branch: 'develop' },
		{ path: resolve(REPO, '.claude/worktrees/old-task'), branch: 'fix/old-task' },
		{ path: resolve(REPO, '.claude/worktrees/live-task'), branch: 'feat/live-task' },
		{ path: resolve(LANES, 'f08-demos'), branch: 'chore/current' },
		{ path: resolve(LANES, 'dev-ci') },
	]);
	const merged = overrides.merged ?? [
		'develop',
		'main',
		'fix/old-task',
		'chore/current',
		'feat/merged-alone',
		'feat/merged-with-pr',
	];
	const files: Record<string, string[]> = {
		[resolve(LANES, 'f08-demos', '.agent', 'tmp')]: [
			'git-safety-baseline.old.json',
			'git-safety-baseline.fresh.json',
			'release-check.json',
		],
	};
	const createdAt: Record<string, number> = {
		[resolve(LANES, 'f08-demos/.agent/tmp/git-safety-baseline.old.json')]: NOW - 9 * DAY_MS,
		[resolve(LANES, 'f08-demos/.agent/tmp/git-safety-baseline.fresh.json')]: NOW - DAY_MS,
	};
	return {
		git: (args) => {
			if (args[0] === 'worktree') return worktrees;
			if (args[0] === 'for-each-ref') return merged.join('\n');
			throw new Error(`unexpected git ${args.join(' ')}`);
		},
		openPrBranches: () => new Set(['feat/merged-with-pr']),
		listDirs: (path) =>
			resolve(path) === LANES
				? ['dev-ci', 'f08-demos', 'f10-libre', 'f12-release', 'scratch']
				: [],
		listFiles: (path) => files[resolve(path)] ?? [],
		baselineCreatedAt: (path) => createdAt[resolve(path)] ?? null,
		nowMs: NOW,
		...overrides,
	};
}

describe('worktree sweep', () => {
	it('parses branches and detached worktrees from git worktree list --porcelain', () => {
		expect(
			parseWorktreeList(porcelain([{ path: REPO, branch: 'develop' }, { path: LANES }])),
		).toEqual([
			{ path: slash(REPO), branch: 'develop' },
			{ path: slash(LANES), branch: null },
		]);
	});

	it('lists merged worktrees, merged branches, stale baselines and non-lane folders with commands', () => {
		const sweep = checkSweep(REPO, fakeDeps());
		const root = slash(REPO);
		expect(sweep.map((finding) => [finding.kind, finding.subject, finding.command])).toEqual([
			[
				'worktree',
				slash(resolve(REPO, '.claude/worktrees/old-task')),
				`git -C "${root}" worktree remove "${slash(resolve(REPO, '.claude/worktrees/old-task'))}"`,
			],
			['branch', 'feat/merged-alone', `git -C "${root}" branch -d feat/merged-alone`],
			[
				'baseline',
				slash(resolve(LANES, 'f08-demos/.agent/tmp/git-safety-baseline.old.json')),
				`rm "${slash(resolve(LANES, 'f08-demos/.agent/tmp/git-safety-baseline.old.json'))}"`,
			],
			[
				'folder',
				slash(resolve(LANES, 'dev-ci')),
				`git -C "${root}" worktree remove "${slash(resolve(LANES, 'dev-ci'))}"`,
			],
			['folder', slash(resolve(LANES, 'scratch')), undefined],
		]);
		expect(sweep.every((finding) => finding.prChecked)).toBe(true);
	});

	it('never offers develop, main, a checked-out branch or one with an open PR', () => {
		const subjects = checkSweep(REPO, fakeDeps()).map((finding) => finding.subject);
		for (const kept of [
			'develop',
			'main',
			'chore/current',
			'feat/merged-with-pr',
			'fix/old-task',
		]) {
			expect(subjects).not.toContain(kept);
		}
		expect(subjects).not.toContain(slash(resolve(REPO, '.claude/worktrees/live-task')));
	});

	it('degrades to «sin comprobar» without gh instead of failing', () => {
		const sweep = checkSweep(REPO, fakeDeps({ openPrBranches: () => null }));
		const branch = sweep.find((finding) => finding.subject === 'feat/merged-with-pr');
		expect(branch?.prChecked).toBe(false);
		expect(branch?.detail).toContain('PR sin comprobar');
		const items = sweepToItems(sweep);
		expect(items.find((item) => item.id === 'sweep-branch:feat/merged-with-pr')?.status).toBe(
			'unknown',
		);
		expect(items.find((item) => item.id.startsWith('sweep-baseline'))?.status).toBe('warn');
	});

	it('reports a clean sweep as a single ok line', () => {
		const sweep = checkSweep(
			REPO,
			fakeDeps({
				merged: ['develop', 'main'],
				listDirs: () => [],
				listFiles: () => [],
			}),
		);
		expect(sweep).toEqual([]);
		expect(sweepToItems(sweep)).toEqual([
			expect.objectContaining({ id: 'sweep', status: 'ok' }),
		]);
	});
});

function env(overrides: Partial<DbsEnvironmentSummary> = {}): DbsEnvironmentSummary {
	return {
		environment: 'local',
		schemaLifecycle: 'CURRENT',
		migrationHead: '20261020130000',
		pendingMigrations: [],
		extraMigrations: [],
		identityConflictsCount: 0,
		schemaNextAction: null,
		evidence: 'LIVE',
		...overrides,
	};
}

describe('dbs and migrations sections', () => {
	it('classifies each environment schema with a read-only review command', () => {
		expect(classifySchema('preview', env()).status).toBe('ok');
		expect(
			classifySchema('preview', env({ pendingMigrations: ['20261022120000'] })),
		).toMatchObject({
			status: 'warn',
			detail: '1 pendiente(s): 20261022120000.',
			fix: 'pnpm db:migrate -- --target preview',
		});
		expect(
			classifySchema('production', env({ pendingMigrations: ['20261022120000'] })).fix,
		).toBe('pnpm prod:apply -- --schema');
		expect(
			classifySchema('production', env({ extraMigrations: ['20991231000000'] })).status,
		).toBe('block');
		expect(classifySchema('production', null).status).toBe('unknown');
	});

	it('lists local publication drift with the canonical command next to it', () => {
		const snapshot: DbsSnapshot = {
			environments: { local: env() },
			operationalPlan: {
				actions: [
					{
						id: 'publication-america',
						title: 'Publicación · Mis XV años — América',
						why: 'Local está behind.',
						steps: [
							{ command: 'pnpm dbs --verbose', optional: true },
							{
								command:
									'pnpm invitation:release -- --slug america --targets local --apply',
							},
						],
					},
				],
			},
		};
		const items = dbsLocalItems(snapshot);
		expect(items[0]).toMatchObject({ id: 'schema-local', status: 'ok' });
		expect(items[1]).toMatchObject({
			status: 'warn',
			detail: 'Local está behind.',
			fix: 'pnpm invitation:release -- --slug america --targets local --apply',
		});
	});

	it('says Local is in sync when dbs has nothing to do', () => {
		const items = dbsLocalItems({
			environments: { local: env() },
			operationalPlan: { actions: [] },
		});
		expect(items.map((item) => item.status)).toEqual(['ok', 'ok']);
	});

	it('degrades to unknown when dbs cannot run, without throwing', () => {
		const fail = () => {
			throw Object.assign(new Error('Command failed'), {
				stderr: 'loading…\nconnect ECONNREFUSED 127.0.0.1:54322\n',
			});
		};
		const dbs = collectDbsSection(fail, NOW);
		expect(dbs.items).toEqual([
			expect.objectContaining({
				status: 'unknown',
				detail: expect.stringContaining('ECONNREFUSED'),
			}),
		]);
		const migrations = collectMigrationsSection(fail, NOW);
		expect(migrations.items.map((item) => [item.id, item.status])).toEqual([
			['schema-preview', 'unknown'],
			['schema-production', 'unknown'],
		]);
	});

	it('reads Preview and Production only and prints a heading with the pending count', () => {
		const targets: string[][] = [];
		const section = collectMigrationsSection((requested) => {
			targets.push([...requested]);
			return {
				environments: {
					preview: env({ environment: 'preview', pendingMigrations: ['20261022120000'] }),
					production: env({ environment: 'production' }),
				},
				operationalPlan: { actions: [] },
			};
		}, NOW);
		expect(targets).toEqual([['preview', 'production']]);
		expect(formatOpsSection(section).split('\n')).toEqual([
			'== migraciones · Preview y Production (--remote, solo lectura) · 1 pendiente(s)',
			'[warn] Migraciones en Preview: 1 pendiente(s): 20261022120000.  → pnpm db:migrate -- --target preview',
			'[ok] Migraciones en Production: Al día (última: 20261020130000).',
		]);
	});
});
