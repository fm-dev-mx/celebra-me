import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGACY_WORKTREE_SEGMENTS, findRepoRoot, listExpectedLanePaths } from '../shared/worktree-lane';

export type InspectionState = 'ok' | 'unavailable';
export type WorktreeState = 'clean' | 'dirty' | 'unknown';

export interface GitCommandResult {
	status: number;
	stdout: string;
	stderr: string;
}

export interface LaneConfig {
	name: string;
	path: string;
	runtimeDefault: 'local' | 'preview';
	defaultBranch: string;
}

export interface LaneStatus {
	name: string;
	path: string;
	exists: boolean;
	inspection: InspectionState;
	state: WorktreeState;
	branch: string;
	head: string;
	relation: string;
	runtimeDefault: 'local' | 'preview';
	diagnostics: string[];
	modifiedCount: number;
}

export type GitRunner = (args: string[], cwd: string) => GitCommandResult;

const REPO_ROOT = findRepoRoot();

export const LANES: LaneConfig[] = listExpectedLanePaths(REPO_ROOT).map((lane) => ({
	name: lane.displayName,
	path: lane.path,
	runtimeDefault: lane.runtimeDefault,
	defaultBranch: lane.id === 'integration' ? 'develop' : 'ephemeral',
}));

function runGit(args: string[], cwd: string): GitCommandResult {
	const result = spawnSync('git', args, {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	return {
		status: result.status ?? 1,
		stdout: String(result.stdout ?? '').trim(),
		stderr: String(result.stderr ?? '').trim(),
	};
}

function firstSuccessful(runner: GitRunner, commands: string[][], cwd: string): GitCommandResult {
	for (const args of commands) {
		const result = runner(args, cwd);
		if (result.status === 0 && result.stdout) return result;
	}
	return { status: 1, stdout: '', stderr: 'all candidate git commands failed' };
}

function getDevelopRelation(
	branch: string,
	head: string,
	cwd: string,
	runner: GitRunner,
	diagnostics: string[],
): string {
	if (branch === 'unknown') return 'UNVERIFIED';
	if (branch === 'HEAD') return `detached at ${head}`;

	const develop = firstSuccessful(
		runner,
		[
			['rev-parse', '--short', 'origin/develop'],
			['rev-parse', '--short', 'develop'],
		],
		cwd,
	);
	if (develop.status !== 0) {
		diagnostics.push('develop ref unavailable; relation is UNVERIFIED');
		return 'UNVERIFIED';
	}

	const counts = firstSuccessful(
		runner,
		[
			['rev-list', '--left-right', '--count', `${branch}...origin/develop`],
			['rev-list', '--left-right', '--count', `${branch}...develop`],
		],
		cwd,
	);
	if (counts.status !== 0) {
		diagnostics.push('branch relation unavailable');
		return 'UNVERIFIED';
	}

	const [aheadStr, behindStr] = counts.stdout.split(/\s+/u);
	const ahead = Number(aheadStr);
	const behind = Number(behindStr);
	if (!Number.isFinite(ahead) || !Number.isFinite(behind)) {
		diagnostics.push('branch relation returned invalid counts');
		return 'UNVERIFIED';
	}

	if (ahead === 0 && behind === 0) return 'up to date with develop';
	if (ahead > 0 && behind === 0)
		return `ahead of develop by ${ahead} commit${ahead > 1 ? 's' : ''}`;
	if (ahead === 0 && behind > 0)
		return `behind develop by ${behind} commit${behind > 1 ? 's' : ''}`;
	return `diverged from develop (+${ahead}, -${behind})`;
}

export function inspectLane(lane: LaneConfig, runner: GitRunner = runGit): LaneStatus {
	if (!existsSync(lane.path)) {
		return {
			name: lane.name,
			path: lane.path,
			exists: false,
			inspection: 'unavailable',
			state: 'unknown',
			branch: 'unknown',
			head: 'unknown',
			relation: 'UNVERIFIED',
			runtimeDefault: lane.runtimeDefault,
			diagnostics: ['directory missing'],
			modifiedCount: 0,
		};
	}

	const diagnostics: string[] = [];
	const branchResult = runner(['rev-parse', '--abbrev-ref', 'HEAD'], lane.path);
	const headResult = runner(['rev-parse', '--short', 'HEAD'], lane.path);
	const statusResult = runner(['status', '--short'], lane.path);
	const branch = branchResult.status === 0 && branchResult.stdout ? branchResult.stdout : 'unknown';
	const head = headResult.status === 0 && headResult.stdout ? headResult.stdout : 'unknown';

	if (branchResult.status !== 0) diagnostics.push('branch inspection failed');
	if (headResult.status !== 0) diagnostics.push('HEAD inspection failed');
	if (statusResult.status !== 0) diagnostics.push('working-tree inspection failed');

	const inspection: InspectionState = diagnostics.length === 0 ? 'ok' : 'unavailable';
	const statusLines = statusResult.status === 0 ? statusResult.stdout.split('\n').filter(Boolean) : [];
	const state: WorktreeState = statusResult.status !== 0 ? 'unknown' : statusLines.length ? 'dirty' : 'clean';
	const relation =
		inspection === 'ok'
			? getDevelopRelation(branch, head, lane.path, runner, diagnostics)
			: 'UNVERIFIED';

	return {
		name: lane.name,
		path: lane.path,
		exists: true,
		inspection,
		state,
		branch,
		head,
		relation,
		runtimeDefault: lane.runtimeDefault,
		diagnostics,
		modifiedCount: statusLines.length,
	};
}

function printHuman(statuses: LaneStatus[]): void {
	console.log('\n=============================================================');
	console.log(' Celebra-me Four-Lane Worktree Status (Read-Only)');
	console.log('=============================================================\n');

	for (const info of statuses) {
		console.log(`📌 ${info.name}`);
		console.log(`   Path:        ${info.path}`);
		console.log(`   Inspection:  ${info.inspection}`);
		console.log(`   State:       ${info.state}${info.modifiedCount ? ` (${info.modifiedCount} modified/untracked)` : ''}`);
		console.log(`   Branch:      ${info.branch === 'HEAD' ? '(detached HEAD)' : info.branch}`);
		console.log(`   HEAD:        ${info.head}`);
		console.log(`   Runtime:     ${info.runtimeDefault} default`);
		console.log(`   Develop:     ${info.relation}`);
		for (const diagnostic of info.diagnostics) console.log(`   Diagnostic:  ${diagnostic}`);
		console.log('');
	}
}

function parseJsonFlag(argv: string[]): boolean {
	return argv.includes('--json');
}

export function collectStatus(
	lanes: LaneConfig[] = LANES,
	runner: GitRunner = runGit,
): LaneStatus[] {
	return lanes.map((lane) => inspectLane(lane, runner));
}

function main(): void {
	const statuses = collectStatus();
	if (parseJsonFlag(process.argv.slice(2))) {
		console.log(JSON.stringify({ generatedAt: new Date().toISOString(), lanes: statuses }, null, 2));
	} else {
		printHuman(statuses);
	}

	const unavailable = statuses.filter((status) => status.inspection === 'unavailable');
	if (unavailable.length > 0) process.exitCode = 2;

	const legacyPresent = LEGACY_WORKTREE_SEGMENTS.filter((segment) =>
		existsSync(resolve(REPO_ROOT, '.worktrees', segment)),
	);
	if (legacyPresent.length > 0 && !parseJsonFlag(process.argv.slice(2))) {
		console.log('⚠️  Legacy worktree directories still present (should be migrated):');
		for (const segment of legacyPresent) console.log(`   - ${resolve(REPO_ROOT, '.worktrees', segment)}`);
	}
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('worktree-status.ts')) main();
