/**
 * lane-sync.ts — Canonical lane synchronization + managed-status observability.
 *
 * Git hooks (post-commit / post-merge / post-rewrite) remain fail-open and may
 * miss fast-forward / already-aligned syncs that perform no meaningful rewrite.
 * This command is the deterministic path:
 *
 *   sync lane against develop → Git succeeds → pnpm dbs --compact
 *
 * Never blocks Git success on remote DB availability. Honors CELEBRA_SKIP_MANAGED_STATUS.
 *
 * Usage:
 *   pnpm lane:sync
 *   pnpm lane:sync -- --dry-run
 *   pnpm lane:sync -- --skip-status
 *   pnpm lane:sync -- --ff-only
 */

import { spawnSync } from 'node:child_process';

export interface LaneSyncOptions {
	cwd?: string;
	dryRun?: boolean;
	skipStatus?: boolean;
	ffOnly?: boolean;
	/** Injected for tests. */
	runGit?: (args: string[], cwd: string) => { status: number; stdout: string; stderr: string };
	runStatus?: (cwd: string) => { status: number; stdout: string; stderr: string };
}

export interface LaneSyncResult {
	gitOk: boolean;
	gitMode: 'ff-only' | 'rebase' | 'already-aligned' | 'dry-run' | 'skipped';
	statusRan: boolean;
	statusSkippedReason?: string;
	stdout: string;
}

type GitRunner = NonNullable<LaneSyncOptions['runGit']>;
type StatusRunner = NonNullable<LaneSyncOptions['runStatus']>;

function defaultRunGit(
	args: string[],
	cwd: string,
): { status: number; stdout: string; stderr: string } {
	const result = spawnSync('git', args, {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	return {
		status: result.status ?? 1,
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? '',
	};
}

function defaultRunStatus(cwd: string): { status: number; stdout: string; stderr: string } {
	const result = spawnSync(
		'pnpm',
		['exec', 'tsx', 'scripts/provision/dbs-cli.ts', '--compact', '--timeout-ms', '2500'],
		{
			cwd,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
			env: process.env,
			shell: process.platform === 'win32',
		},
	);
	return {
		status: result.status ?? 1,
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? '',
	};
}

function parseLaneSyncArgs(argv: string[]): LaneSyncOptions {
	return {
		dryRun: argv.includes('--dry-run'),
		skipStatus: argv.includes('--skip-status'),
		ffOnly: argv.includes('--ff-only'),
	};
}

function syncOntoDevelop(input: {
	cwd: string;
	dryRun?: boolean;
	ffOnly?: boolean;
	runGit: GitRunner;
}): Pick<LaneSyncResult, 'gitOk' | 'gitMode' | 'statusSkippedReason'> & { lines: string[] } {
	const { cwd, dryRun, ffOnly, runGit } = input;
	const lines: string[] = [];

	const fetch = runGit(['fetch', 'origin', 'develop'], cwd);
	if (fetch.status !== 0 && !dryRun) {
		lines.push(fetch.stderr.trim() || fetch.stdout.trim() || 'git fetch origin develop failed');
		return { gitOk: false, gitMode: 'skipped', statusSkippedReason: 'git-fetch-failed', lines };
	}

	const behind = runGit(['rev-list', '--count', 'HEAD..origin/develop'], cwd);
	const behindCount = Number((behind.stdout || '0').trim() || '0');

	if (dryRun) {
		lines.push(
			behindCount === 0
				? '[lane:sync] dry-run: already aligned with origin/develop'
				: `[lane:sync] dry-run: would sync ${behindCount} commit(s) from origin/develop`,
		);
		return { gitOk: true, gitMode: 'dry-run', lines };
	}

	if (behindCount === 0) {
		lines.push('[lane:sync] already aligned with origin/develop');
		return { gitOk: true, gitMode: 'already-aligned', lines };
	}

	const gitMode = ffOnly ? 'ff-only' : 'rebase';
	const sync = ffOnly
		? runGit(['merge', '--ff-only', 'origin/develop'], cwd)
		: runGit(['rebase', 'origin/develop'], cwd);
	lines.push(sync.stdout.trim(), sync.stderr.trim());
	if (sync.status !== 0) {
		return {
			gitOk: false,
			gitMode,
			statusSkippedReason: ffOnly ? 'git-ff-failed' : 'git-rebase-failed',
			lines,
		};
	}
	lines.push(
		ffOnly
			? '[lane:sync] fast-forwarded onto origin/develop'
			: '[lane:sync] rebased onto origin/develop',
	);
	return { gitOk: true, gitMode, lines };
}

function appendManagedStatus(
	lines: string[],
	cwd: string,
	runStatus: StatusRunner,
	options: { skipStatus?: boolean },
): Pick<LaneSyncResult, 'statusRan' | 'statusSkippedReason'> {
	const skipEnv = process.env.CELEBRA_SKIP_MANAGED_STATUS === '1';
	if (options.skipStatus || skipEnv) {
		const reason = options.skipStatus ? 'cli-skip-status' : 'CELEBRA_SKIP_MANAGED_STATUS=1';
		lines.push(`[lane:sync] managed status skipped (${reason})`);
		return { statusRan: false, statusSkippedReason: reason };
	}

	const status = runStatus(cwd);
	const statusText = (status.stdout || status.stderr || '').trim();
	lines.push(
		statusText || '[lane:sync] managed status produced no output (read-only; ignored)',
	);
	return { statusRan: true };
}

/**
 * Fetch origin/develop and fast-forward or rebase the current branch onto it,
 * then print compact managed status (unless opted out).
 */
export function runLaneSync(options: LaneSyncOptions = {}): LaneSyncResult {
	const cwd = options.cwd ?? process.cwd();
	const sync = syncOntoDevelop({
		cwd,
		dryRun: options.dryRun,
		ffOnly: options.ffOnly,
		runGit: options.runGit ?? defaultRunGit,
	});
	if (!sync.gitOk) {
		return {
			gitOk: false,
			gitMode: sync.gitMode,
			statusRan: false,
			statusSkippedReason: sync.statusSkippedReason,
			stdout: sync.lines.filter(Boolean).join('\n'),
		};
	}

	const status = appendManagedStatus(sync.lines, cwd, options.runStatus ?? defaultRunStatus, {
		skipStatus: options.skipStatus,
	});
	return {
		gitOk: true,
		gitMode: sync.gitMode,
		statusRan: status.statusRan,
		statusSkippedReason: status.statusSkippedReason,
		stdout: sync.lines.filter(Boolean).join('\n'),
	};
}

function main(): void {
	const options = parseLaneSyncArgs(process.argv.slice(2));
	const result = runLaneSync(options);
	console.log(result.stdout);
	process.exit(result.gitOk ? 0 : 1);
}

const isMainModule = process.argv[1]?.replaceAll('\\', '/').endsWith('lane-sync.ts');
if (isMainModule) {
	main();
}
