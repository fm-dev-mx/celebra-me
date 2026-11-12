/**
 * Persistent worktree lane detection for Celebra-me.
 * Path/lane identity is never authorization for mutations.
 *
 * Canonical layout (parent directory is machine-local; tooling derives paths):
 *   <parent>/
 *   ├── <repo>/                   (repo root / Integration lane, Win + F5)
 *   └── <repo>-worktrees/         (external worktree root)
 *       ├── f06-landing/          (Win + F6)
 *       ├── …
 *       ├── f12-release/          (Win + F12)
 *       └── agente-claude/        (agent lane, no key)
 *
 * `.agent/carriles.json` is the single source of truth for the task lanes:
 * `carriles` gives each lane's id, folder, port, key (`tecla`), name and runtime
 * (`entorno`); agent lanes (`agente-<name>`) have no key and are opened by the
 * board's bridges, not by a person. `carrilesRetirados` lists folders that stay
 * on disk but take no tasks (detected as `unknown`, so the guards refuse
 * sessions there). The board config points at the same file. Integration is not a board lane and stays here.
 * Win + F4 opens the separate board project (`tablero`), not a lane. A lane's
 * role is a default, not a restriction; folders under `<repo>-worktrees/` are
 * never created ad hoc — change `.agent/carriles.json` in a pull request instead.
 */

import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import laneFile from '../../.agent/carriles.json' with { type: 'json' };

export type WorktreeRuntimeDefault = 'local' | 'preview';

interface WorktreeLaneEntry {
	readonly id: string;
	/** Function key that opens the lane (Win + F<key>); null for agent lanes. */
	readonly key: number | null;
	/** Stable Astro/Vite dev server port. */
	readonly port: number;
	/** Segment name under the external worktree root (null for Integration). */
	readonly segment: string | null;
	readonly displayName: string;
	readonly runtimeDefault: WorktreeRuntimeDefault;
}

interface BoardLaneConfig {
	id?: unknown;
	carpeta?: unknown;
	puerto?: unknown;
	tecla?: unknown;
	nombre?: unknown;
	entorno?: unknown;
}

const INTEGRATION_LANE: WorktreeLaneEntry = Object.freeze({
	id: 'integration',
	key: 5,
	port: 4321,
	segment: null,
	displayName: 'Integration',
	runtimeDefault: 'local',
});

/** Agent lanes take tasks from the board's bridges and have no function key. */
const AGENT_LANE_PREFIX = 'agente-';
const LANE_ID_PATTERN = /^(?:f\d{2}|agente)-[a-z0-9-]+$/;

function laneConfigError(detail: string): Error {
	return new Error(`Invalid lane config in .agent/carriles.json: ${detail}`);
}

function parseBoardLane(raw: BoardLaneConfig, index: number): WorktreeLaneEntry {
	const { id, carpeta, puerto, tecla, nombre, entorno } = raw;
	if (typeof id !== 'string' || !LANE_ID_PATTERN.test(id)) {
		throw laneConfigError(
			`carriles[${index}].id must look like "f06-landing" or "agente-codex"`,
		);
	}
	if (typeof carpeta !== 'string' || basename(carpeta.replaceAll('\\', '/')) !== id) {
		throw laneConfigError(`carriles[${index}].carpeta must end in "${id}"`);
	}
	const agentLane = id.startsWith(AGENT_LANE_PREFIX);
	if (!Number.isInteger(puerto)) {
		throw laneConfigError(`carriles[${index}] needs an integer "puerto"`);
	}
	if (agentLane ? tecla !== undefined : !Number.isInteger(tecla)) {
		throw laneConfigError(
			agentLane
				? `carriles[${index}] is an agent lane and takes no "tecla"`
				: `carriles[${index}] needs an integer "tecla"`,
		);
	}
	if (typeof nombre !== 'string' || !nombre.trim()) {
		throw laneConfigError(`carriles[${index}].nombre is required`);
	}
	if (entorno !== 'local' && entorno !== 'preview') {
		throw laneConfigError(`carriles[${index}].entorno must be "local" or "preview"`);
	}
	return Object.freeze({
		id,
		key: agentLane ? null : (tecla as number),
		port: puerto as number,
		segment: id,
		displayName: nombre,
		runtimeDefault: entorno,
	});
}

function assertUnique(lanes: readonly WorktreeLaneEntry[], field: 'key' | 'port'): void {
	const seen = new Set<number>();
	for (const lane of lanes) {
		const value = lane[field];
		if (value === null) continue;
		if (seen.has(value)) throw laneConfigError(`duplicate ${field} ${value}`);
		seen.add(value);
	}
}

function loadLaneConfig(config: { carriles?: unknown; carrilesRetirados?: unknown }): {
	lanes: readonly WorktreeLaneEntry[];
	retired: readonly string[];
} {
	if (!Array.isArray(config.carriles)) throw laneConfigError('"carriles" must be an array');
	const lanes = [
		INTEGRATION_LANE,
		...config.carriles.map((raw: BoardLaneConfig, index) => parseBoardLane(raw, index)),
	];
	assertUnique(lanes, 'key');
	assertUnique(lanes, 'port');
	const retired = config.carrilesRetirados ?? [];
	if (!Array.isArray(retired) || retired.some((segment) => typeof segment !== 'string')) {
		throw laneConfigError('"carrilesRetirados" must be an array of folder names');
	}
	const live = retired.find((segment) => lanes.some((lane) => lane.segment === segment));
	if (live) throw laneConfigError(`"${live}" is both a lane and retired`);
	return { lanes: Object.freeze(lanes), retired: Object.freeze([...retired]) };
}

const LANE_CONFIG = loadLaneConfig(laneFile);

/** Integration first, then the board lanes in `.agent/carriles.json` order. */
export const WORKTREE_LANES: readonly WorktreeLaneEntry[] = LANE_CONFIG.lanes;

/** Folders kept under `<repo>-worktrees/` that take no tasks (`carrilesRetirados`). */
export const RETIRED_LANE_SEGMENTS: readonly string[] = LANE_CONFIG.retired;

export type KnownWorktreeLaneId = string;
export type WorktreeLaneId = KnownWorktreeLaneId | 'unknown';

export interface WorktreeLaneDefinition {
	id: WorktreeLaneId;
	/** Function key (Win + F<key>); null for agent lanes and the unknown lane. */
	key: number | null;
	displayName: string;
	runtimeDefault: WorktreeRuntimeDefault;
	/** Segment name under the external worktree root (null for Integration). */
	segment: string | null;
}

// 4399: never collides with a canonical lane (4321, 4326–4336) or the typical
// 4324 fallback; surface the non-canonical cwd via detectWorktreeLane callers.
const UNKNOWN_LANE_PORT = 4399;

/**
 * Stable Astro/Vite ports per lane, derived from WORKTREE_LANES, so parallel
 * worktrees do not share :4321 and then 403 `/@fs/` asset requests that encode
 * another worktree's absolute path. Integration keeps 4321; each board lane uses its `puerto`.
 *
 * Override with PORT or ASTRO_PORT when needed (tests, one-off binds).
 */
export const WORKTREE_DEV_SERVER_PORTS: Readonly<Record<WorktreeLaneId, number>> = Object.freeze({
	...Object.fromEntries(WORKTREE_LANES.map((lane) => [lane.id, lane.port])),
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
 * bypass: change .agent/carriles.json in a pull request when a task needs another lane.
 *
 * Returns null when allowed, otherwise the refusal message.
 */
export function checkLaneWorkPolicy(input: {
	lane: WorktreeLaneDefinition;
	branch: string | null;
	merging?: boolean;
	operation?: 'session' | 'commit';
}): string | null {
	const freeLanes = WORKTREE_LANES.filter((lane) => lane.segment)
		.map((lane) => (lane.key === null ? lane.segment : `${lane.segment} (Win + F${lane.key})`))
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
