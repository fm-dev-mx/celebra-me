/**
 * Persistent worktree lane detection for Celebra-me.
 * Path/lane identity is never authorization for mutations.
 */

import { basename, resolve } from 'node:path';

export type WorktreeLaneId = 'integration' | 'dev-local' | 'dev-preview' | 'dev-extra' | 'unknown';

export interface WorktreeLaneDefinition {
	id: WorktreeLaneId;
	displayName: string;
	runtimeDefault: 'local' | 'preview';
	relativePath: string | null;
}

export const WORKTREE_LANES: readonly WorktreeLaneDefinition[] = Object.freeze([
	{
		id: 'integration',
		displayName: 'Integration',
		runtimeDefault: 'local',
		relativePath: null,
	},
	{
		id: 'dev-local',
		displayName: 'Development Local',
		runtimeDefault: 'local',
		relativePath: '.worktrees/dev-local',
	},
	{
		id: 'dev-preview',
		displayName: 'Development Preview',
		runtimeDefault: 'preview',
		relativePath: '.worktrees/dev-preview',
	},
	{
		id: 'dev-extra',
		displayName: 'Development Extra',
		runtimeDefault: 'local',
		relativePath: '.worktrees/dev-extra',
	},
]);

/** Legacy path segments that tooling must not treat as active lanes. */
export const LEGACY_WORKTREE_SEGMENTS = Object.freeze(['dev-lane', 'val-lane']);

export function detectWorktreeLane(
	cwd = process.cwd(),
	repoRootHint?: string,
): WorktreeLaneDefinition {
	const normalized = resolve(cwd).replaceAll('\\', '/');
	const lower = normalized.toLowerCase();

	for (const lane of WORKTREE_LANES) {
		if (!lane.relativePath) continue;
		const marker = `/${lane.relativePath.replaceAll('\\', '/')}`.toLowerCase();
		if (lower.includes(marker) || lower.endsWith(marker.slice(1))) {
			return lane;
		}
	}

	for (const legacy of LEGACY_WORKTREE_SEGMENTS) {
		const marker = `/.worktrees/${legacy}`.toLowerCase();
		if (lower.includes(marker)) {
			return {
				id: 'unknown',
				displayName: `Legacy worktree (${legacy})`,
				runtimeDefault: 'local',
				relativePath: `.worktrees/${legacy}`,
			};
		}
	}

	if (repoRootHint) {
		const root = resolve(repoRootHint).replaceAll('\\', '/').toLowerCase();
		if (lower === root) {
			return WORKTREE_LANES[0]!;
		}
	}

	const worktreesIdx = lower.split('/').lastIndexOf('.worktrees');
	if (worktreesIdx === -1) {
		const leaf = basename(normalized);
		if (leaf.toLowerCase() === 'celebra-me' || repoRootHint) {
			return WORKTREE_LANES[0]!;
		}
	}

	return {
		id: 'unknown',
		displayName: 'Unknown worktree',
		runtimeDefault: 'local',
		relativePath: null,
	};
}

export function listExpectedLanePaths(repoRoot: string): Array<{
	id: WorktreeLaneId;
	displayName: string;
	runtimeDefault: 'local' | 'preview';
	path: string;
}> {
	const root = resolve(repoRoot);
	return WORKTREE_LANES.map((lane) => ({
		id: lane.id,
		displayName: lane.displayName,
		runtimeDefault: lane.runtimeDefault,
		path: lane.relativePath ? resolve(root, ...lane.relativePath.split('/')) : root,
	}));
}
