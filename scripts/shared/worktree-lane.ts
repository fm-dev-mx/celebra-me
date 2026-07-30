/**
 * Persistent worktree lane detection for Celebra-me.
 * Path/lane identity is never authorization for mutations.
 *
 * Canonical layout:
 *   D:\code\
 *   ├── celebra-me\               (repo root / Integration lane)
 *   └── celebra-me-worktrees\     (external worktree root)
 *       ├── dev-local\
 *       ├── dev-preview\
 *       └── dev-extra\
 *
 * The old `.worktrees/` layout is detected as legacy and tooling warns about it
 * but does not treat those directories as active canonical lanes.
 */

import { execSync } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';

export type WorktreeLaneId = 'integration' | 'dev-local' | 'dev-preview' | 'dev-extra' | 'unknown';

export interface WorktreeLaneDefinition {
	id: WorktreeLaneId;
	displayName: string;
	runtimeDefault: 'local' | 'preview';
	/** Segment name under the external worktree root (null for Integration). */
	segment: string | null;
}

/** Segment names for legacy `.worktrees/` directories that tooling warns about. */
export const LEGACY_WORKTREE_SEGMENTS = Object.freeze([
	'dev-lane',
	'val-lane',
]);

/** Names of lanes that are still in the old `.worktrees/` location and need migration. */
export const DEPRECATED_DOT_WORKTREES_SEGMENTS = Object.freeze([
	'dev-local',
	'dev-preview',
	'dev-extra',
]);

export const WORKTREE_LANES: readonly WorktreeLaneDefinition[] = Object.freeze([
	{
		id: 'integration',
		displayName: 'Integration',
		runtimeDefault: 'local',
		segment: null,
	},
	{
		id: 'dev-local',
		displayName: 'Development Local',
		runtimeDefault: 'local',
		segment: 'dev-local',
	},
	{
		id: 'dev-preview',
		displayName: 'Development Preview',
		runtimeDefault: 'preview',
		segment: 'dev-preview',
	},
	{
		id: 'dev-extra',
		displayName: 'Development Extra',
		runtimeDefault: 'local',
		segment: 'dev-extra',
	},
]);

/**
 * Stable Astro/Vite ports per lane so parallel worktrees do not share :4321 and
 * then 403 `/@fs/` asset requests that encode another worktree's absolute path.
 *
 * Override with PORT or ASTRO_PORT when needed (tests, one-off binds).
 */
export const WORKTREE_DEV_SERVER_PORTS: Readonly<Record<WorktreeLaneId, number>> = Object.freeze({
	integration: 4321,
	'dev-local': 4321,
	'dev-extra': 4322,
	'dev-preview': 4323,
	// 4399: never collide with canonical lanes (4321/4322/4323) or typical 4324
	// fallbacks; surface the non-canonical cwd via detectWorktreeLane callers.
	unknown: 4399,
});

export function getWorktreeDevServerPort(laneId: WorktreeLaneId): number {
	return WORKTREE_DEV_SERVER_PORTS[laneId] ?? WORKTREE_DEV_SERVER_PORTS.unknown;
}

/**
 * Returns the canonical external worktree root path based on the repo root.
 * Convention: sibling directory named `<repo-dir-name>-worktrees`.
 * Example: `D:\code\celebra-me` → `D:\code\celebra-me-worktrees`
 */
export function getExternalWorktreeRoot(repoRoot: string): string {
	const resolved = resolve(repoRoot).replaceAll('\\', '/');
	const parent = dirname(resolved);
	const dirName = basename(resolved);
	return resolve(parent, `${dirName}-worktrees`);
}

/**
 * Returns the canonical lane path for a lane definition.
 * Integration returns the repo root; development lanes return paths under
 * the external worktree root.
 */
export function getExpectedLanePath(lane: WorktreeLaneDefinition, repoRoot: string): string {
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
		}).trim();
		return resolve(cwd ?? process.cwd(), commonDir, '..');
	} catch {
		return resolve(cwd ?? process.cwd());
	}
}

// ─── Detection helpers (extracted for complexity limits) ───────────────────────

function detectExternalPath(lower: string, externalRoots: string[]): WorktreeLaneDefinition | null {
	// Check if cwd directly contains any expected segment under celebre-me-worktrees
	const worktreesDirPattern = /celebra-me-worktrees/i;
	if (worktreesDirPattern.test(lower)) {
		for (const lane of WORKTREE_LANES) {
			if (!lane.segment) continue;
			const seg = lane.segment.toLowerCase();
			if (
				lower.includes(`/celebra-me-worktrees/${seg}`) ||
				lower.endsWith(`/celebra-me-worktrees/${seg}`)
			) {
				return lane;
			}
		}
	}
	// Specific external root match
	for (const ext of externalRoots) {
		const extNormalized = ext.replaceAll('\\', '/');
		for (const lane of WORKTREE_LANES) {
			if (!lane.segment) continue;
			const expected = `${extNormalized}/${lane.segment}`.toLowerCase();
			if (lower === expected || lower.startsWith(expected + '/')) {
				return lane;
			}
		}
	}
	return null;
}

function detectOldDotWorktrees(lower: string): WorktreeLaneDefinition | null {
	for (const lane of WORKTREE_LANES) {
		if (!lane.segment) continue;
		const marker = `/.worktrees/${lane.segment}`.toLowerCase();
		if (lower.includes(marker) || lower.endsWith(`.worktrees/${lane.segment}`)) {
			return lane;
		}
	}
	// Check legacy-only segments (not in WORKTREE_LANES)
	for (const legacy of LEGACY_WORKTREE_SEGMENTS) {
		const marker = `/.worktrees/${legacy}`.toLowerCase();
		if (lower.includes(marker)) {
			return {
				id: 'unknown' as WorktreeLaneId,
				displayName: `Legacy worktree (${legacy})`,
				runtimeDefault: 'local' as const,
				segment: `.worktrees/${legacy}`,
			};
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
		return WORKTREE_LANES[0]!;
	}

	// Build external root candidates
	const externalRoots: string[] = [];
	if (root) {
		externalRoots.push(getExternalWorktreeRoot(root).replaceAll('\\', '/').toLowerCase());
	}

	// Check canonical external paths
	const externalMatch = detectExternalPath(lower, externalRoots);
	if (externalMatch) return externalMatch;

	// Check old .worktrees/ layout (legacy)
	const dotWorktreesMatch = detectOldDotWorktrees(lower);
	if (dotWorktreesMatch) return dotWorktreesMatch;

	// Fallback: Integration lane guess by basename
	if (root && lower === root.toLowerCase()) {
		return WORKTREE_LANES[0]!;
	}
	const leaf = basename(normalized);
	if (
		leaf.toLowerCase() === 'celebra-me' ||
		leaf === basename(resolve(normalized, '..', '..', 'package.json'))
	) {
		return WORKTREE_LANES[0]!;
	}

	return {
		id: 'unknown',
		displayName: 'Unknown worktree',
		runtimeDefault: 'local',
		segment: null,
	};
}

export function listExpectedLanePaths(repoRoot: string): Array<{
	id: WorktreeLaneId;
	displayName: string;
	runtimeDefault: 'local' | 'preview';
	path: string;
}> {
	return WORKTREE_LANES.map((lane) => ({
		id: lane.id,
		displayName: lane.displayName,
		runtimeDefault: lane.runtimeDefault,
		path: getExpectedLanePath(lane, repoRoot),
	}));
}
