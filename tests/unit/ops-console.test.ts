import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	classifyBackupAge,
	classifyProductionVariables,
	classifyReleaseCheckEvidence,
	collectGitSection,
	parseRemoteTags,
	splitUntagged,
	worstStatus,
	type OpsCommit,
} from '../../scripts/ops/ops-console-snapshot.ts';
import type { ReleaseCheckEvidence } from '../../scripts/db/release-check.ts';
import { OPS_CONSOLE_SENTINEL } from '../../src/ops-console/sentinel.ts';

const BUNDLE_CHECK = resolve('scripts/check-ops-console-bundle.mjs');
const IMPORT_GUARD_URL = pathToFileURL(resolve('scripts/validate-ops-console-imports.mjs')).href;

function runNode(args: string[]): { status: number | null; output: string } {
	const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
	return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const NOW = Date.parse('2026-10-21T20:00:00Z');
const commit = (sha: string, hoursAgo: number): OpsCommit => ({
	sha,
	date: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
	ageHours: hoursAgo,
	subject: `Merge ${sha}`,
});

describe('ops console git snapshot', () => {
	it('maps annotated tags to the commit they peel to and ignores non-release tags', () => {
		const tags = parseRemoteTags(
			[
				'aaa1\trefs/tags/v0.40.0-beta.1',
				'c0ffee\trefs/tags/v0.40.0-beta.1^{}',
				'bbb2\trefs/tags/archive/old-branch',
			].join('\n'),
		);
		expect([...tags.entries()]).toEqual([['c0ffee', ['v0.40.0-beta.1']]]);
	});

	it('lists main commits above the newest tagged one as untagged', () => {
		const result = splitUntagged(
			[commit('c3', 30), commit('c2', 40), commit('c1', 50), commit('c0', 60)],
			new Map([['c1', ['v0.39.0-beta.1']]]),
		);
		expect(result.untagged.map((entry) => entry.sha)).toEqual(['c3', 'c2']);
		expect(result.latest?.name).toBe('v0.39.0-beta.1');
	});

	it('blocks when a merge to main has waited two hours or more without a tag', () => {
		const git = (args: string[]): string => {
			if (args[0] === 'log' && args.includes('origin/main')) {
				return [
					`m2\t${commit('m2', 3).date}\tMerge pull request #2`,
					`m1\t${commit('m1', 30).date}\tMerge pull request #1`,
				].join('\n');
			}
			if (args[0] === 'log') return '';
			if (args[0] === 'ls-remote') return 'm1\trefs/tags/v0.1.0';
			if (args[0] === 'rev-list') return '0\t0';
			if (args[0] === 'rev-parse') throw new Error('no FETCH_HEAD');
			throw new Error(`unexpected git ${args.join(' ')}`);
		};
		const section = collectGitSection(git, NOW);
		expect(section.untaggedMainCommits.map((entry) => entry.sha)).toEqual(['m2']);
		expect(section.items.find((item) => item.id === 'main-tags')?.status).toBe('block');
		expect(section.items.find((item) => item.id === 'develop-vs-main')?.status).toBe('ok');
	});
});

describe('ops console prod:apply pre-flight', () => {
	const environment = { lockfileSha256: 'lock', nodeVersion: 'v24.14.1' };
	const evidence: ReleaseCheckEvidence = {
		version: 2,
		status: 'pass',
		sha: 'a'.repeat(40),
		clean: true,
		typeCheck: 'pass',
		test: 'pass',
		build: 'pass',
		createdAt: new Date(NOW - 3_600_000).toISOString(),
		...environment,
	};

	it('classifies release-check evidence without clearing it', () => {
		const base = { headSha: 'a'.repeat(40), clean: true, environment, nowMs: NOW };
		expect(classifyReleaseCheckEvidence({ ...base, evidence }).status).toBe('ok');
		expect(classifyReleaseCheckEvidence({ ...base, evidence: null }).status).toBe('warn');
		expect(
			classifyReleaseCheckEvidence({ ...base, headSha: 'b'.repeat(40), evidence }).detail,
		).toMatch(/no del HEAD actual/);
		expect(
			classifyReleaseCheckEvidence({
				...base,
				environment: { ...environment, nodeVersion: 'v22' },
				evidence,
			}).status,
		).toBe('warn');
		expect(classifyReleaseCheckEvidence({ ...base, clean: false, evidence }).status).toBe(
			'block',
		);
	});

	it('warns that an old backup will be replaced right before the owner prompt', () => {
		expect(
			classifyBackupAge({ newestAgeMs: 5 * 60_000, dailyAttention: false, summary: '' })
				.status,
		).toBe('ok');
		const stale = classifyBackupAge({
			newestAgeMs: 3 * 3_600_000,
			dailyAttention: true,
			summary: 'daily 30h',
		});
		expect(stale.status).toBe('warn');
		expect(stale.detail).toMatch(/BACKUP_COVERAGE_EXPIRED/);
	});

	it('reports Production variables by name only and never their values', () => {
		const secret =
			'postgresql://postgres.ineitkdkyrxqyressllp:hunter2@aws-0.pooler.supabase.com:6543/postgres';
		const items = classifyProductionVariables((name) => (name === 'PROD_DB_URL' ? secret : ''));
		expect(items[0]).toMatchObject({ status: 'block' });
		expect(items[0]?.detail).toMatch(/PROD_SUPABASE_URL, PROD_SUPABASE_SERVICE_ROLE_KEY/);
		expect(items[1]).toMatchObject({ id: 'production-project', status: 'ok' });
		expect(JSON.stringify(items)).not.toContain('hunter2');
	});

	it('takes the worst status as the verdict', () => {
		expect(worstStatus([{ id: 'a', label: '', detail: '', status: 'ok' }])).toBe('ok');
		expect(
			worstStatus([
				{ id: 'a', label: '', detail: '', status: 'warn' },
				{ id: 'b', label: '', detail: '', status: 'block' },
			]),
		).toBe('block');
	});
});

describe('ops console isolation guards', () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'ops-console-'));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	const write = (relative: string, content: string): void => {
		const path = join(root, relative);
		mkdirSync(join(path, '..'), { recursive: true });
		writeFileSync(path, content);
	};

	it('keeps the bundle check sentinel equal to the console sentinel', () => {
		expect(readFileSync(BUNDLE_CHECK, 'utf8')).toContain(
			`export const OPS_CONSOLE_SENTINEL = '${OPS_CONSOLE_SENTINEL}';`,
		);
	});

	it('fails the build output check when the console sentinel reaches dist/', () => {
		write('dist/client/index.html', '<p>ok</p>');
		expect(runNode([BUNDLE_CHECK, join(root, 'dist')]).status).toBe(0);
		write('dist/server/chunks/page.mjs', `const a = "${OPS_CONSOLE_SENTINEL}";`);
		const leaked = runNode([BUNDLE_CHECK, join(root, 'dist')]);
		expect(leaked.status).toBe(1);
		expect(leaked.output).toContain(
			`server/chunks/page.mjs contains "${OPS_CONSOLE_SENTINEL}"`,
		);
		expect(runNode([BUNDLE_CHECK, join(root, 'missing')]).status).toBe(1);
	});

	it('rejects imports of src/ops-console/ from pages, components and other bundled code', () => {
		write(
			'src/pages/leak.astro',
			"---\nimport { OPS_CONSOLE_SENTINEL } from '../ops-console/sentinel';\n---\n",
		);
		write(
			'src/components/Leak.ts',
			"export const load = () => import('@/ops-console/run-snapshot');\n",
		);
		write('src/ops-console/OpsConsolePage.astro', "---\nimport './run-snapshot';\n---\n");
		write('src/pages/ok.astro', '---\n---\n<p>ok</p>\n');
		const files = [
			'src/pages/leak.astro',
			'src/components/Leak.ts',
			'src/ops-console/OpsConsolePage.astro',
			'src/pages/ok.astro',
		];
		const result = runNode([
			'--input-type=module',
			'-e',
			`const { validateOpsConsoleImports } = await import(${JSON.stringify(IMPORT_GUARD_URL)});` +
				`console.log(JSON.stringify(validateOpsConsoleImports(${JSON.stringify(root)}, ${JSON.stringify(files)})));`,
		]);
		const errors = JSON.parse(result.output) as string[];
		expect(errors).toHaveLength(2);
		expect(errors[0]).toMatch(/^src\/pages\/leak\.astro:2:/);
		expect(errors[1]).toMatch(/^src\/components\/Leak\.ts:1:/);
	});

	it('is wired into validate:structure and build:app', () => {
		const structure = readFileSync('scripts/validate-structure.mjs', 'utf8');
		expect(structure).toContain('...validateOpsConsoleImports(root, tracked)');
		const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts['build:app']).toBe(
			'astro build && node scripts/check-ops-console-bundle.mjs',
		);
	});
});
