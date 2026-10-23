import { readFileSync } from 'node:fs';
import {
	classifyBackupAge,
	classifyProductionVariables,
	classifyReleaseCheckEvidence,
	collectGitSection,
	parseRemoteTags,
	splitUntagged,
	worstStatus,
	type GitSection,
	type OpsCommit,
	type PreflightSection,
} from '../../scripts/ops/ops-console-snapshot.ts';
import {
	formatOpsItem,
	formatOpsSection,
	formatOpsStatus,
	parseOpsStatusArgs,
} from '../../scripts/ops/ops-status.ts';
import type { ReleaseCheckEvidence } from '../../scripts/db/release-check.ts';

const NOW = Date.parse('2026-10-21T20:00:00Z');
const commit = (sha: string, hoursAgo: number): OpsCommit => ({
	sha,
	date: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
	ageHours: hoursAgo,
	subject: `Merge ${sha}`,
});

describe('ops status git snapshot', () => {
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

describe('ops status prod:apply pre-flight', () => {
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

describe('ops status text output', () => {
	const git: GitSection = {
		section: 'git',
		generatedAt: new Date(NOW).toISOString(),
		originFetchedAt: null,
		tagSource: 'origin',
		latestTag: { name: 'v0.1.0', sha: 'm1', date: commit('m1', 30).date },
		untaggedMainCommits: [commit('m2', 3)],
		developAhead: 2,
		developBehind: 0,
		developAheadCommits: [],
		items: [
			{
				id: 'main-tags',
				label: 'Uniones a main sin tag',
				status: 'block',
				detail: '1 unión lleva 3 h sin tag.',
				fix: 'pnpm release:tag',
			},
			{
				id: 'develop-vs-main',
				label: 'develop frente a main',
				status: 'ok',
				detail: '+2/-0.',
			},
		],
	};
	const preflight: PreflightSection = {
		section: 'preflight',
		generatedAt: new Date(NOW).toISOString(),
		checkout: 'celebra-me',
		branch: 'develop',
		headSha: 'a'.repeat(40),
		verdict: 'warn',
		items: [{ id: 'checkout', label: 'Checkout', status: 'warn', detail: 'Rama develop.' }],
	};

	it('prints one line per item with the status, label, detail and optional command', () => {
		expect(formatOpsItem(git.items[0]!)).toBe(
			'[block] Uniones a main sin tag: 1 unión lleva 3 h sin tag.  → pnpm release:tag',
		);
		expect(formatOpsItem(git.items[1]!)).toBe('[ok] develop frente a main: +2/-0.');
	});

	it('prints each section under a heading and both sections separated by a blank line', () => {
		const text = formatOpsStatus([git, preflight]);
		const lines = text.split('\n');
		expect(lines[0]).toBe('== git · develop +2/-0 frente a main · tags de origin');
		expect(lines[1]).toBe(formatOpsItem(git.items[0]!));
		expect(lines[3]).toBe('');
		expect(lines[4]).toBe('== preflight · celebra-me (develop en aaaaaaaaa) · veredicto: warn');
		expect(lines[5]).toBe('[warn] Checkout: Rama develop.');
		expect(formatOpsSection(preflight)).toBe(lines.slice(4).join('\n'));
	});

	it('runs the local sections by default, adds migrations with --remote and one with --section', () => {
		const local = ['git', 'preflight', 'worktrees', 'dbs'];
		expect(parseOpsStatusArgs([])).toEqual({ sections: local, json: false, remote: false });
		expect(parseOpsStatusArgs(['--json'])).toEqual({
			sections: local,
			json: true,
			remote: false,
		});
		expect(parseOpsStatusArgs(['--remote'])).toEqual({
			sections: [...local, 'migrations'],
			json: false,
			remote: true,
		});
		expect(parseOpsStatusArgs(['--section', 'preflight'])).toEqual({
			sections: ['preflight'],
			json: false,
			remote: false,
		});
		expect(() => parseOpsStatusArgs(['--section', 'deploys'])).toThrow(/--section debe ser/);
		expect(() => parseOpsStatusArgs(['--section', 'migrations'])).toThrow(/agregue --remote/);
		expect(parseOpsStatusArgs(['--section', 'migrations', '--remote']).sections).toEqual([
			'migrations',
		]);
	});

	it('is the script behind pnpm ops:status and the VS Code task', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts['ops:status']).toBe('tsx scripts/ops/ops-status.ts');
		expect(pkg.scripts['ops:console']).toBeUndefined();
		expect(pkg.scripts['build:app']).toBe('astro build');
		expect(readFileSync('.vscode/tasks.json', 'utf8')).toContain('"Estado (ops:status)"');
	});
});
