import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGACY_WORKTREE_SEGMENTS, findRepoRoot, listExpectedLanePaths } from '../shared/worktree-lane';

interface LaneConfig {
	name: string;
	path: string;
	runtimeDefault: 'local' | 'preview';
	defaultBranch: string;
}

const REPO_ROOT = findRepoRoot();

const LANES: LaneConfig[] = listExpectedLanePaths(REPO_ROOT).map((lane) => ({
	name: lane.displayName,
	path: lane.path,
	runtimeDefault: lane.runtimeDefault,
	defaultBranch: lane.id === 'integration' ? 'develop' : 'ephemeral',
}));

function runGit(args: string[], cwd: string): string {
	try {
		return execSync(`git ${args.join(' ')}`, {
			cwd,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
	} catch {
		return '';
	}
}

function getDevelopRelation(branch: string, headSha: string, lanePath: string): string {
	if (branch === 'unknown') return 'N/A';
	if (branch === 'HEAD') return `detached at ${headSha}`;

	const developSha =
		runGit(['rev-parse', '--short', 'origin/develop'], lanePath) ||
		runGit(['rev-parse', '--short', 'develop'], lanePath);
	if (!developSha) return 'N/A';

	const counts = runGit(['rev-list', '--left-right', '--count', `${branch}...develop`], lanePath);
	if (!counts) return 'N/A';

	const [aheadStr, behindStr] = counts.split(/\s+/);
	const ahead = parseInt(aheadStr ?? '0', 10);
	const behind = parseInt(behindStr ?? '0', 10);

	if (ahead === 0 && behind === 0) return 'up to date with develop';
	if (ahead > 0 && behind === 0)
		return `ahead of develop by ${ahead} commit${ahead > 1 ? 's' : ''}`;
	if (ahead === 0 && behind > 0)
		return `behind develop by ${behind} commit${behind > 1 ? 's' : ''}`;
	return `diverged from develop (+${ahead}, -${behind})`;
}

function inspectLane(lane: LaneConfig) {
	if (!existsSync(lane.path)) {
		return {
			name: lane.name,
			path: lane.path,
			exists: false,
			branch: 'N/A',
			headSha: 'N/A',
			status: 'Directory missing',
			relation: 'N/A',
			runtimeDefault: lane.runtimeDefault,
		};
	}

	const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], lane.path) || 'unknown';
	const headSha = runGit(['rev-parse', '--short', 'HEAD'], lane.path) || 'unknown';
	const rawStatus = runGit(['status', '--short'], lane.path);
	const isClean = rawStatus.length === 0;

	let statusSummary = isClean ? 'clean' : 'dirty';
	if (!isClean) {
		const lines = rawStatus.split('\n').filter(Boolean);
		statusSummary += ` (${lines.length} modified/untracked file${lines.length > 1 ? 's' : ''})`;
	}

	const relation = getDevelopRelation(branch, headSha, lane.path);

	return {
		name: lane.name,
		path: lane.path,
		exists: true,
		branch: branch === 'HEAD' ? '(detached HEAD)' : branch,
		headSha,
		status: statusSummary,
		relation,
		runtimeDefault: lane.runtimeDefault,
	};
}

function main() {
	console.log('\n=============================================================');
	console.log(' Celebra-me Four-Lane Worktree Status (Read-Only)');
	console.log('=============================================================\n');

	for (const lane of LANES) {
		const info = inspectLane(lane);
		console.log(`📌 ${info.name}`);
		console.log(`   Path:     ${info.path}`);
		if (!info.exists) {
			console.log(`   Status:   Directory missing`);
		} else {
			console.log(`   Branch:   ${info.branch}`);
			console.log(`   HEAD:     ${info.headSha}`);
			console.log(`   State:    ${info.status}`);
			console.log(`   Runtime:  ${info.runtimeDefault} default`);
			console.log(`   Develop:  ${info.relation}`);
		}
		console.log('');
	}

	const legacyPresent = LEGACY_WORKTREE_SEGMENTS.filter((segment) =>
		existsSync(resolve(REPO_ROOT, '.worktrees', segment)),
	);
	if (legacyPresent.length > 0) {
		console.log('⚠️  Legacy worktree directories still present (should be migrated):');
		for (const segment of legacyPresent) {
			console.log(`   - ${resolve(REPO_ROOT, '.worktrees', segment)}`);
		}
		console.log('');
	}
}

main();
