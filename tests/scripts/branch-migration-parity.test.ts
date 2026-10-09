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
	main as branchParityMain,
	parseMigrationTree,
	runBranchMigrationParity,
	toBranchParityJson,
	type GitRunner,
} from '../../scripts/db/branch-migration-parity';
import {
	selectBranchLaneMode,
	BRANCH_LANE_STATUSES,
	createFinding,
} from '../../scripts/db/branch-lane-status';
function makeGit(opts: {
	changed: string[];
	baseFiles: Map<string, string>;
	headFiles: Map<string, string>;
}): GitRunner {
	return (args) => {
		if (args[0] === 'diff' && args.includes('--name-only')) {
			return { status: 0, stdout: `${opts.changed.join('\n')}\n`, stderr: '' };
		}
		if (args[0] === 'ls-tree') {
			const ref = args[3];
			const files = ref === 'base' ? opts.baseFiles : opts.headFiles;
			return { status: 0, stdout: `${[...files.keys()].join('\n')}\n`, stderr: '' };
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
}

describe('database-sensitive path classifier', () => {
	it('normalizes backslashes to forward slashes', () => {
		expect(normalizeRepoPath('supabase\\migrations\\a.sql')).toBe('supabase/migrations/a.sql');
	});

	it('treats migrations and DB ops paths as sensitive', () => {
		expect(isDatabaseSensitivePath('supabase/migrations/20260101000000_init.sql')).toBe(true);
		expect(isDatabaseSensitivePath('scripts/db/audit-db.ts')).toBe(true);
	});

	it('does not treat app runtime paths as sensitive', () => {
		expect(isDatabaseSensitivePath('src/lib/repositories/guests.ts')).toBe(false);
		expect(filterDatabaseSensitivePaths(['src/lib/x.ts'])).toEqual([]);
	});

	it('reports no sensitive hits for non-database branch sync paths', () => {
		const result = detectDatabaseSensitiveChanges(['src/pages/index.astro', 'CHANGELOG.md']);
		expect(result.sensitive).toBe(false);
	});
});

describe('branch migration parity JSON + exit semantics', () => {
	const baseMigrations = new Map([['supabase/migrations/20260101000000_base.sql', 'base']]);

	it('no database-sensitive changes → identity pass, requiresParityAudit false, exit 0', () => {
		const result = runBranchMigrationParity({
			baseRef: 'base',
			headRef: 'head',
			git: makeGit({
				changed: ['src/pages/index.astro'],
				baseFiles: baseMigrations,
				headFiles: baseMigrations,
			}),
		});
		const json = toBranchParityJson(result);
		expect(json.identityStatus).toBe('pass');
		expect(json.sensitiveChanges).toBe(false);
		expect(json.requiresParityAudit).toBe(false);
		expect(
			branchParityMain(
				['--base', 'base', '--head', 'head', '--json'],
				makeGit({
					changed: ['src/pages/index.astro'],
					baseFiles: baseMigrations,
					headFiles: baseMigrations,
				}),
			),
		).toBe(0);
	});

	it('sensitive changes with valid identity → requiresParityAudit true, exit 0 (not failure)', () => {
		const head = new Map([
			['supabase/migrations/20260101000000_base.sql', 'base'],
			['supabase/migrations/20260102000000_new.sql', 'new'],
		]);
		const git = makeGit({
			changed: ['supabase/migrations/20260102000000_new.sql'],
			baseFiles: baseMigrations,
			headFiles: head,
		});
		const result = runBranchMigrationParity({ baseRef: 'base', headRef: 'head', git });
		const json = toBranchParityJson(result);
		expect(json.identityStatus).toBe('pass');
		expect(json.sensitiveChanges).toBe(true);
		expect(json.requiresParityAudit).toBe(true);
		expect(json.sensitiveFiles).toContain('supabase/migrations/20260102000000_new.sql');
		expect(branchParityMain(['--base', 'base', '--head', 'head'], git)).toBe(0);
		expect(formatBranchMigrationParityReport(result)).toContain('Parity routing required');
	});

	it('marks automatic database-parity routing via requiresParityAudit finding', () => {
		const head = new Map([
			['supabase/migrations/20260101000000_base.sql', 'base'],
			['supabase/migrations/20260102000000_new.sql', 'new'],
		]);
		const result = runBranchMigrationParity({
			baseRef: 'base',
			headRef: 'head',
			git: makeGit({
				changed: ['supabase/migrations/20260102000000_new.sql'],
				baseFiles: baseMigrations,
				headFiles: head,
			}),
		});
		expect(result.findings.some((f) => f.id === 'database-sensitive-paths')).toBe(true);
		expect(result.requiresParityAudit).toBe(true);
	});

	it('duplicate migration identity → Hard blocked finding and exit 1', () => {
		const parsed = parseMigrationTree([
			{ path: 'supabase/migrations/20260101000000_a.sql', content: 'a' },
			{ path: 'supabase/migrations/20260101000000_b.sql', content: 'b' },
		]);
		const compared = compareMigrationTrees(parsed, parseMigrationTree([]));
		expect(compared.identityOk).toBe(false);
		expect(compared.findings.some((f) => f.status === 'Hard blocked')).toBe(true);
		expect(compared.errors.some((e) => e.toLowerCase().includes('duplicate'))).toBe(true);
	});

	it('malformed migration filename → Hard blocked', () => {
		const parsed = parseMigrationTree([
			{ path: 'supabase/migrations/not-a-migration.sql', content: 'x' },
		]);
		const compared = compareMigrationTrees(parsed, parseMigrationTree([]));
		expect(compared.identityOk).toBe(false);
		expect(compared.findings[0]!.status).toBe('Hard blocked');
	});

	it('mutated applied migration content → Hard blocked and never Pass', () => {
		const base = parseMigrationTree([
			{ path: 'supabase/migrations/20260101000000_shared.sql', content: 'original' },
		]);
		const head = parseMigrationTree([
			{ path: 'supabase/migrations/20260101000000_shared.sql', content: 'mutated' },
		]);
		const compared = compareMigrationTrees(base, head);
		expect(compared.identityOk).toBe(false);
		expect(compared.contentMutations).toHaveLength(1);
		expect(compared.findings.every((f) => f.status === 'Hard blocked')).toBe(true);
		expect(hashContent('original')).not.toBe(hashContent('mutated'));
	});

	it('CLI exit 1 on identity failure even with --json', () => {
		const badHead = new Map([['supabase/migrations/20260101000000_base.sql', 'mutated']]);
		const code = branchParityMain(
			['--base', 'base', '--head', 'head', '--json'],
			makeGit({
				changed: ['supabase/migrations/20260101000000_base.sql'],
				baseFiles: baseMigrations,
				headFiles: badHead,
			}),
		);
		expect(code).toBe(1);
	});
});

describe('branch-lane mode selection', () => {
	it('selects promote when develop is ahead and FF is possible', () => {
		const result = selectBranchLaneMode({
			mainIsAncestorOfDevelop: true,
			developAheadOfMain: true,
			mainHasExclusiveCommits: false,
			tipsEqual: false,
		});
		expect(result.mode).toBe('promote-develop-to-main');
		expect(result.status).toBe('Pass');
	});

	it('selects sync when main has exclusive commits', () => {
		const result = selectBranchLaneMode({
			mainIsAncestorOfDevelop: false,
			developAheadOfMain: false,
			mainHasExclusiveCommits: true,
			tipsEqual: false,
		});
		expect(result.mode).toBe('sync-main-into-develop');
	});

	it('returns ambiguous Needs decision when branches diverged both ways', () => {
		const result = selectBranchLaneMode({
			mainIsAncestorOfDevelop: false,
			developAheadOfMain: true,
			mainHasExclusiveCommits: true,
			tipsEqual: false,
		});
		expect(result.mode).toBe('ambiguous');
		expect(result.status).toBe('Needs decision');
	});

	it('no-op Pass when tips are equal', () => {
		const result = selectBranchLaneMode({
			mainIsAncestorOfDevelop: true,
			developAheadOfMain: false,
			mainHasExclusiveCommits: false,
			tipsEqual: true,
		});
		expect(result.mode).toBe('no-op');
		expect(result.status).toBe('Pass');
	});

	it('exposes the full status vocabulary for reports', () => {
		expect(BRANCH_LANE_STATUSES).toEqual([
			'Pass',
			'Needs decision',
			'Needs authorization',
			'Needs manual action',
			'Fail',
			'Hard blocked',
			'Skipped',
		]);
	});
});
describe('finding status mapping for interrupted paths', () => {
	it('maps missing credentials style finding to Needs manual action', () => {
		const finding = createFinding({
			id: 'missing-preview-credentials',
			status: 'Needs manual action',
			cause: 'PREVIEW_DB_URL not resolved.',
			impact: 'Preview audit Skipped until credentials exist.',
			owner: 'human',
			remediation: 'Set PREVIEW_DB_URL or .env.preview.local, then resume branch-lane.',
			nextStep: 'Add credentials, re-invoke branch-lane.',
		});
		expect(finding.status).toBe('Needs manual action');
	});

	it('maps intentional non-critical drift to Needs decision', () => {
		const finding = createFinding({
			id: 'non-critical-drift',
			status: 'Needs decision',
			cause: 'Documented non-critical Preview lag.',
			impact: 'Promote may proceed only with explicit acceptance.',
			owner: 'human',
			remediation: 'Accept limitation or complete Preview audit.',
			nextStep: 'Choose accept or run Preview audit.',
		});
		expect(finding.status).toBe('Needs decision');
	});

	it('maps write-ready backup to Needs authorization', () => {
		const finding = createFinding({
			id: 'prod-backup-ready',
			status: 'Needs authorization',
			cause: 'No recent Production backup for guest/RSVP coverage.',
			impact: 'Migration/promote window lacks independent backup evidence.',
			owner: 'human',
			remediation: 'Authorize pnpm db:prod:backup.',
			nextStep: 'Approve backup command execution.',
		});
		expect(finding.status).toBe('Needs authorization');
	});

	it('maps skipped deferred validation with explicit reason', () => {
		const finding = createFinding({
			id: 'pipeline-skipped',
			status: 'Skipped',
			cause: 'db:validate:pipeline deferred by authorized lighter substitute.',
			impact: 'Full pipeline confidence not claimed.',
			owner: 'agent',
			remediation: 'Run pipeline before production migrate if required.',
			nextStep: 'Continue with documented substitute.',
		});
		expect(finding.status).toBe('Skipped');
	});
});
