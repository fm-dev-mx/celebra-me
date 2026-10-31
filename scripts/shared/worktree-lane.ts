/**
 * Persistent worktree lane detection for Celebra-me.
 * Path/lane identity is never authorization for mutations.
 *
 * Canonical layout (parent directory is machine-local; tooling derives paths):
 *   <parent>/
 *   ├── <repo>/                   (repo root / Integration lane, Win + F5)
 *   └── <repo>-worktrees/         (external worktree root)
 *       ├── f05-plataforma/       (retiring, no hotkey)
 *       ├── f06-landing/          (Win + F6)
 *       ├── …
 *       └── f12-release/          (Win + F12)
 *
 * WORKTREE_LANES is the single source of truth for lane ids, keys, folders,
 * runtimes and ports. Win + F4 opens the separate board project, not a lane.
 * A lane's role is a default, not a restriction; folders under
 * `<repo>-worktrees/` are never created ad hoc — change this table in a pull
 * request instead.
 */

import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

export type WorktreeRuntimeDefault = 'local' | 'preview';

interface WorktreeLaneEntry {
	readonly id: string;
	/** Function key that opens the lane (Win + F<key>); null for a retiring lane. */
	readonly key: number | null;
	/** Stable Astro/Vite dev server port. */
	readonly port: number;
	/** Segment name under the external worktree root (null for Integration). */
	readonly segment: string | null;
	readonly displayName: string;
	readonly runtimeDefault: WorktreeRuntimeDefault;
}

export const WORKTREE_LANES = Object.freeze([
	{
		id: 'integration',
		key: 5,
		port: 4321,
		segment: null,
		displayName: 'Integration',
		runtimeDefault: 'local',
	},
	{
		// Retiring: its hotkey moved to Integration; removed once its last task merges.
		id: 'f05-plataforma',
		key: null,
		port: 4325,
		segment: 'f05-plataforma',
		displayName: 'Plataforma (en retiro)',
		runtimeDefault: 'local',
	},
	{
		id: 'f06-landing',
		key: 6,
		port: 4326,
		segment: 'f06-landing',
		displayName: 'F6 Landing',
		runtimeDefault: 'local',
	},
	{
		id: 'f07-invitaciones',
		key: 7,
		port: 4327,
		segment: 'f07-invitaciones',
		displayName: 'F7 Invitaciones',
		runtimeDefault: 'local',
	},
	{
		id: 'f08-demos',
		key: 8,
		port: 4328,
		segment: 'f08-demos',
		displayName: 'F8 Demos',
		runtimeDefault: 'local',
	},
	{
		id: 'f09-docs',
		key: 9,
		port: 4329,
		segment: 'f09-docs',
		displayName: 'F9 Docs',
		runtimeDefault: 'local',
	},
	{
		id: 'f10-libre',
		key: 10,
		port: 4330,
		segment: 'f10-libre',
		displayName: 'F10 Libre',
		runtimeDefault: 'local',
	},
	{
		id: 'f11-preview',
		key: 11,
		port: 4331,
		segment: 'f11-preview',
		displayName: 'F11 Preview',
		runtimeDefault: 'preview',
	},
	{
		id: 'f12-release',
		key: 12,
		port: 4332,
		segment: 'f12-release',
		displayName: 'F12 Release',
		runtimeDefault: 'preview',
	},
] as const satisfies readonly WorktreeLaneEntry[]);

export type KnownWorktreeLaneId = (typeof WORKTREE_LANES)[number]['id'];
export type WorktreeLaneId = KnownWorktreeLaneId | 'unknown';

export interface WorktreeLaneDefinition {
	id: WorktreeLaneId;
	/** Function key (Win + F<key>); null for the unknown lane. */
	key: number | null;
	displayName: string;
	runtimeDefault: WorktreeRuntimeDefault;
	/** Segment name under the external worktree root (null for Integration). */
	segment: string | null;
}

// 4399: never collides with a canonical lane (4321, 4325–4332) or the typical
// 4324 fallback; surface the non-canonical cwd via detectWorktreeLane callers.
const UNKNOWN_LANE_PORT = 4399;

/**
 * Stable Astro/Vite ports per lane, derived from WORKTREE_LANES, so parallel
 * worktrees do not share :4321 and then 403 `/@fs/` asset requests that encode
 * another worktree's absolute path. Integration keeps 4321; other lanes use 4320 + key.
 *
 * Override with PORT or ASTRO_PORT when needed (tests, one-off binds).
 */
export const WORKTREE_DEV_SERVER_PORTS: Readonly<Record<WorktreeLaneId, number>> = Object.freeze({
	...(Object.fromEntries(WORKTREE_LANES.map((lane) => [lane.id, lane.port])) as Record<
		KnownWorktreeLaneId,
		number
	>),
	unknown: UNKNOWN_LANE_PORT,
});

export function getWorktreeDevServerPort(laneId: WorktreeLaneId): number {
	return WORKTREE_DEV_SERVER_PORTS[laneId] ?? UNKNOWN_LANE_PORT;
}

/**
 * Returns the canonical external worktree root path based on the repo root.
 * Convention: sibling directory named `<repo-dir-name>-worktrees`.
 * Example: `<parent>/<repo>` → `<parent>/<repo>-worktrees`
 */
export function getExternalWorktreeRoot(repoRoot: string): string {
	const resolved = resolve(repoRoot).replaceAll('\\', '/');
	const parent = dirname(resolved);
	const dirName = basename(resolved);
	return resolve(parent, `${dirName}-worktrees`);
}

/**
 * Returns the canonical lane path for a lane entry.
 * Integration returns the repo root; the other lanes return paths under
 * the external worktree root.
 */
function getExpectedLanePath(lane: WorktreeLaneEntry, repoRoot: string): string {
	if (!lane.segment) return resolve(repoRoot);
	const externalRoot = getExternalWorktreeRoot(repoRoot);
	return resolve(externalRoot, lane.segment);
}

/**
 * Resolve the true repository root regardless of which worktree we run from.
 * Uses `git rev-parse --git-common-dir` which returns the main repo's `.git`
 * directory even when running from a linked worktree.
 */
export function findRepoRoot(cwd?: string): string {
	try {
		const commonDir = execSync('git rev-parse --git-common-dir', {
			cwd: cwd ?? process.cwd(),
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			env: gitInspectionEnv(),
		}).trim();
		return resolve(cwd ?? process.cwd(), commonDir, '..');
	} catch {
		return resolve(cwd ?? process.cwd());
	}
}

/** Inspect the named cwd, even when invoked from a hook with inherited Git location variables. */
export function gitInspectionEnv(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	for (const key of [
		'GIT_DIR',
		'GIT_WORK_TREE',
		'GIT_COMMON_DIR',
		'GIT_INDEX_FILE',
		'GIT_OBJECT_DIRECTORY',
		'GIT_ALTERNATE_OBJECT_DIRECTORIES',
	])
		delete env[key];
	return env;
}

// ─── Detection helpers (extracted for complexity limits) ───────────────────────

function toDefinition(lane: WorktreeLaneEntry): WorktreeLaneDefinition {
	return {
		id: lane.id as KnownWorktreeLaneId,
		key: lane.key,
		displayName: lane.displayName,
		runtimeDefault: lane.runtimeDefault,
		segment: lane.segment,
	};
}

function unknownLane(): WorktreeLaneDefinition {
	return {
		id: 'unknown',
		key: null,
		displayName: 'Unknown worktree',
		runtimeDefault: 'local',
		segment: null,
	};
}

function detectExternalPath(lower: string, externalRoots: string[]): WorktreeLaneEntry | null {
	// Without a repo root hint, match the canonical sibling directory by exact segment.
	for (const lane of WORKTREE_LANES) {
		if (!lane.segment) continue;
		const laneDir = `/celebra-me-worktrees/${lane.segment.toLowerCase()}`;
		if (lower.endsWith(laneDir) || lower.includes(`${laneDir}/`)) {
			return lane;
		}
	}
	// Specific external root match
	for (const ext of externalRoots) {
		for (const lane of WORKTREE_LANES) {
			if (!lane.segment) continue;
			const expected = `${ext}/${lane.segment}`.toLowerCase();
			if (lower === expected || lower.startsWith(expected + '/')) {
				return lane;
			}
		}
	}
	return null;
}

export function detectWorktreeLane(
	cwd = process.cwd(),
	repoRootHint?: string,
): WorktreeLaneDefinition {
	const normalized = resolve(cwd).replaceAll('\\', '/');
	const lower = normalized.toLowerCase();

	// Check if exactly the repo root (Integration lane)
	const root = repoRootHint ? resolve(repoRootHint).replaceAll('\\', '/') : null;
	if (root && lower === root.toLowerCase()) {
		return toDefinition(WORKTREE_LANES[0]);
	}

	// Build external root candidates
	const externalRoots: string[] = [];
	if (root) {
		externalRoots.push(getExternalWorktreeRoot(root).replaceAll('\\', '/').toLowerCase());
	}

	// Check canonical external paths
	const externalMatch = detectExternalPath(lower, externalRoots);
	if (externalMatch) return toDefinition(externalMatch);

	// Fallback: Integration lane guess by basename. A `.git` file marks a linked
	// worktree (for example a tool-managed checkout), which is never Integration.
	const linkedWorktree = statSync(resolve(normalized, '.git'), {
		throwIfNoEntry: false,
	})?.isFile();
	if (basename(normalized).toLowerCase() === 'celebra-me' && !linkedWorktree) {
		return toDefinition(WORKTREE_LANES[0]);
	}

	return unknownLane();
}

export function listExpectedLanePaths(repoRoot: string): Array<{
	id: KnownWorktreeLaneId;
	key: number | null;
	displayName: string;
	runtimeDefault: WorktreeRuntimeDefault;
	port: number;
	path: string;
}> {
	return WORKTREE_LANES.map((lane) => ({
		id: lane.id,
		key: lane.key,
		displayName: lane.displayName,
		runtimeDefault: lane.runtimeDefault,
		port: lane.port,
		path: getExpectedLanePath(lane, repoRoot),
	}));
}

/**
 * Lane guard shared by the pre-commit hook and `git-safety start`: mutable work
 * runs only in a canonical lane, and Integration only on `develop`. Commits on
 * develop are refused everywhere except a merge completed in Integration; session
 * start on develop allows the authorized integration to begin. There is no
 * bypass: change WORKTREE_LANES in a pull request when a task needs another lane.
 *
 * Returns null when allowed, otherwise the refusal message.
 */
export function checkLaneWorkPolicy(input: {
	lane: WorktreeLaneDefinition;
	branch: string | null;
	merging?: boolean;
	operation?: 'session' | 'commit';
}): string | null {
	const freeLanes = WORKTREE_LANES.filter((lane) => lane.segment && lane.key !== null)
		.map((lane) => `${lane.segment} (Win + F${lane.key})`)
		.join(', ');
	const hint = `Request an explicit task assignment to a lane under <repo>-worktrees/: ${freeLanes}. Do not switch checkouts automatically.`;
	if (input.lane.id === 'unknown') {
		return `This checkout is not a canonical lane (lane: unknown). ${hint} Folders such as .claude/worktrees/* are for read-only subagents only.`;
	}
	if (input.lane.id === 'integration' && input.branch !== 'develop') {
		const branch = input.branch ?? 'detached HEAD';
		return `Integration (Win + F5) only takes commits on develop (current: ${branch}). ${hint}`;
	}
	if (input.lane.id === 'integration' && input.operation === 'commit' && !input.merging) {
		return `Integration only completes merges on develop; direct task commits are forbidden. ${hint}`;
	}
	if (
		input.lane.id !== 'integration' &&
		input.operation === 'commit' &&
		input.branch === 'develop'
	) {
		return 'Direct task commits on develop are forbidden. Create a task branch from develop in this lane.';
	}
	return null;
}
