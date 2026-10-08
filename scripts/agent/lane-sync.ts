/**
 * lane-sync.ts — Canonical lane synchronization + managed-status observability.
 *
 *   sync task branch against develop → Git succeeds → pnpm dbs --compact
 *
 * Never blocks Git success on remote DB availability. Honors CELEBRA_SKIP_MANAGED_STATUS.
 *
 * Usage:
 *   pnpm lane:sync                 # read-only plan using local refs (+ --apply preflight report)
 *   pnpm lane:sync -- --apply      # fetch and synchronize (requires preflight)
 *   pnpm lane:sync -- --dry-run
 *   pnpm lane:sync -- --skip-status
 *   pnpm lane:sync -- --ff-only
 *   pnpm lane:sync -- --rebase     # only for branches never pushed to origin
 *
 * The default merges origin/develop into the task branch, so published history is never rewritten.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface LaneSyncOptions {
	cwd?: string;
	apply?: boolean;
	dryRun?: boolean;
	skipStatus?: boolean;
	ffOnly?: boolean;
	/** Opt-in rebase; refused when the branch exists on origin. */
	rebase?: boolean;
	/** Injected for tests. */
	runGit?: (args: string[], cwd: string) => { status: number; stdout: string; stderr: string };
	runStatus?: (cwd: string) => { status: number; stdout: string; stderr: string };
}

export interface LaneSyncResult {
	gitOk: boolean;
	gitMode: 'merge' | 'ff-only' | 'rebase' | 'already-aligned' | 'dry-run' | 'skipped';
	statusRan: boolean;
	statusSkippedReason?: string;
	/** Dry-run only: the read-only result of the --apply preflight (clean lane, branch, baseline). */
	applyPreflight?: { ok: boolean; reason?: string };
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
	const apply = argv.includes('--apply');
	return {
		apply,
		dryRun: !apply || argv.includes('--dry-run'),
		skipStatus: argv.includes('--skip-status'),
		ffOnly: argv.includes('--ff-only'),
		rebase: argv.includes('--rebase'),
	};
}

type SyncMode = 'merge' | 'ff-only' | 'rebase';

const SYNC_COMMANDS: Record<SyncMode, { args: string[]; failure: string; success: string }> = {
	merge: {
		args: ['merge', '--no-edit', 'origin/develop'],
		failure: 'git-merge-failed',
		success: '[lane:sync] merged origin/develop',
	},
	'ff-only': {
		args: ['merge', '--ff-only', 'origin/develop'],
		failure: 'git-ff-failed',
		success: '[lane:sync] fast-forwarded onto origin/develop',
	},
	rebase: {
		args: ['rebase', 'origin/develop'],
		failure: 'git-rebase-failed',
		success: '[lane:sync] rebased onto origin/develop',
	},
};

export function resolveSyncMode(options: { ffOnly?: boolean; rebase?: boolean }): SyncMode {
	if (options.ffOnly && options.rebase)
		throw new Error('Choose only one of --ff-only or --rebase.');
	return options.ffOnly ? 'ff-only' : options.rebase ? 'rebase' : 'merge';
}

function syncOntoDevelop(input: {
	cwd: string;
	dryRun?: boolean;
	mode: SyncMode;
	runGit: GitRunner;
}): Pick<LaneSyncResult, 'gitOk' | 'gitMode' | 'statusSkippedReason'> & { lines: string[] } {
	const { cwd, dryRun = true, mode, runGit } = input;
	const lines: string[] = [];

	if (!dryRun) {
		const fetch = runGit(['fetch', 'origin', 'develop'], cwd);
		if (fetch.status !== 0) {
			lines.push(
				fetch.stderr.trim() || fetch.stdout.trim() || 'git fetch origin develop failed',
			);
			return {
				gitOk: false,
				gitMode: 'skipped',
				statusSkippedReason: 'git-fetch-failed',
				lines,
			};
		}
	}

	const behind = runGit(['rev-list', '--count', 'HEAD..origin/develop'], cwd);
	if (behind.status !== 0) {
		lines.push(
			'UNVERIFIED: origin/develop is unavailable locally; no synchronization performed',
		);
		return {
			gitOk: false,
			gitMode: 'skipped',
			statusSkippedReason: 'develop-ref-unavailable',
			lines,
		};
	}
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

	if (mode === 'rebase') {
		// Rewriting history is only safe while the branch exists nowhere but this checkout.
		const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd).stdout.trim();
		const published = runGit(
			['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`],
			cwd,
		);
		if (published.status === 0) {
			lines.push(
				`BLOCKED: ${branch} exists on origin; --rebase would rewrite published history. Use the default merge.`,
			);
			return {
				gitOk: false,
				gitMode: 'rebase',
				statusSkippedReason: 'rebase-published',
				lines,
			};
		}
	}

	const command = SYNC_COMMANDS[mode];
	const sync = runGit(command.args, cwd);
	lines.push(sync.stdout.trim(), sync.stderr.trim());
	if (sync.status !== 0) {
		return { gitOk: false, gitMode: mode, statusSkippedReason: command.failure, lines };
	}
	lines.push(command.success);
	return { gitOk: true, gitMode: mode, lines };
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
	lines.push(statusText || '[lane:sync] managed status produced no output (read-only; ignored)');
	return { statusRan: true };
}

function checkApplyPreconditions(
	cwd: string,
	runGit: GitRunner,
): { ok: true } | { ok: false; reason: string; message: string } {
	const status = runGit(['status', '--short'], cwd);
	if (status.status !== 0) {
		return {
			ok: false,
			reason: 'working-tree-unavailable',
			message: 'UNVERIFIED: working-tree state is unavailable; refusing synchronization',
		};
	}
	if (status.stdout.trim()) {
		return {
			ok: false,
			reason: 'working-tree-dirty',
			message: 'BLOCKED: lane must be clean before --apply synchronization',
		};
	}

	const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
	if (branch.status !== 0 || !branch.stdout.trim()) {
		return {
			ok: false,
			reason: 'branch-unavailable',
			message: 'UNVERIFIED: branch state is unavailable; refusing synchronization',
		};
	}
	const branchName = branch.stdout.trim();
	if (branchName === 'main' || branchName === 'develop') {
		return {
			ok: false,
			reason: 'protected-branch',
			message: `BLOCKED: --apply is not allowed on protected branch ${branchName}`,
		};
	}

	// The shared baseline or any per-session baseline (`--session`) may own this checkout.
	const baselineDir = resolve(cwd, '.agent', 'tmp');
	const baselinePaths = existsSync(baselineDir)
		? readdirSync(baselineDir)
				.filter((name) => /^git-safety-baseline(?:\.[A-Za-z0-9._-]+)?\.json$/u.test(name))
				.map((name) => resolve(baselineDir, name))
		: [];
	if (baselinePaths.length === 0) {
		return {
			ok: false,
			reason: 'missing-git-safety-baseline',
			message: 'BLOCKED: run agent:git-safety:start before --apply synchronization',
		};
	}
	const head = runGit(['rev-parse', 'HEAD'], cwd);
	const expectedBaselineBranch = branchName === 'HEAD' ? null : branchName;
	let readable = false;
	for (const baselinePath of baselinePaths) {
		try {
			const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
				branch?: string | null;
				head?: string | null;
			};
			readable = true;
			if (
				head.status === 0 &&
				head.stdout.trim() &&
				baseline.branch === expectedBaselineBranch &&
				baseline.head === head.stdout.trim()
			)
				return { ok: true };
		} catch {
			// An unreadable baseline belongs to no session; keep looking for a matching one.
		}
	}
	return readable
		? {
				ok: false,
				reason: 'git-safety-baseline-mismatch',
				message: 'BLOCKED: no Git Safety baseline matches the current branch and HEAD',
			}
		: {
				ok: false,
				reason: 'invalid-git-safety-baseline',
				message: 'BLOCKED: Git Safety baseline is unreadable; refusing synchronization',
			};
}

/**
 * Describe synchronization using local refs by default. With --apply, fetch origin/develop and
 * merge it into the current branch (or fast-forward / rebase on request), then print compact
 * managed status.
 */
export function runLaneSync(options: LaneSyncOptions = {}): LaneSyncResult {
	const cwd = options.cwd ?? process.cwd();
	if (options.ffOnly && options.rebase) {
		return {
			gitOk: false,
			gitMode: 'skipped',
			statusRan: false,
			statusSkippedReason: 'conflicting-sync-modes',
			stdout: 'BLOCKED: choose only one of --ff-only or --rebase',
		};
	}
	if (options.dryRun === false && options.apply !== true) {
		return {
			gitOk: false,
			gitMode: 'skipped',
			statusRan: false,
			statusSkippedReason: 'apply-required',
			stdout: 'BLOCKED: synchronization mutation requires explicit --apply authorization',
		};
	}
	const dryRun = options.apply !== true || options.dryRun === true;
	const runGit = options.runGit ?? defaultRunGit;
	// The preflight only reads Git state and baseline files, so a dry-run reports it too.
	const preflight = checkApplyPreconditions(cwd, runGit);
	const applyPreflight = dryRun
		? preflight.ok
			? { ok: true }
			: { ok: false, reason: preflight.reason }
		: undefined;
	const preflightLine = preflight.ok
		? '[lane:sync] dry-run: --apply preflight passes (clean lane, task branch, matching Git Safety baseline)'
		: `[lane:sync] dry-run: --apply would be refused (${preflight.reason}): ${preflight.message}`;
	if (!dryRun) {
		if (!preflight.ok) {
			return {
				gitOk: false,
				gitMode: 'skipped',
				statusRan: false,
				statusSkippedReason: preflight.reason,
				stdout: preflight.message,
			};
		}
	}
	const sync = syncOntoDevelop({
		cwd,
		dryRun,
		mode: resolveSyncMode(options),
		runGit,
	});
	if (dryRun) sync.lines.push(preflightLine);
	if (!sync.gitOk) {
		return {
			gitOk: false,
			gitMode: sync.gitMode,
			statusRan: false,
			statusSkippedReason: sync.statusSkippedReason,
			...(applyPreflight ? { applyPreflight } : {}),
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
		...(applyPreflight ? { applyPreflight } : {}),
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
