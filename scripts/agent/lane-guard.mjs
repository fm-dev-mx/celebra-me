#!/usr/bin/env node

/**
 * Worktree lane guard shared by `.husky/pre-commit` and `git-safety start`.
 *
 * Mutable work runs only in a canonical lane (`scripts/shared/worktree-lane.ts`), and the
 * Integration checkout only completes merges on `develop`; session start allows merge preparation.
 * There is intentionally no environment variable or flag to skip it.
 *
 * Usage: node scripts/agent/lane-guard.mjs [--commit]
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { checkLaneWorkPolicy, detectWorktreeLane, findRepoRoot } from '../shared/worktree-lane.ts';

/** @param {string} cwd @param {string[]} args */
function gitOutput(cwd, args) {
	const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
	return result.status === 0 ? String(result.stdout).trim() : null;
}

/**
 * @param {string} [cwd] checkout to inspect (defaults to the current Git top level)
 * @param {'session' | 'commit'} [operation]
 * @returns {{ ok: boolean, laneId: string, branch: string | null, message: string | null }}
 */
export function evaluateLaneGuard(cwd = process.cwd(), operation = 'session') {
	const topLevel = gitOutput(cwd, ['rev-parse', '--show-toplevel']) ?? cwd;
	const checkout = resolve(topLevel);
	const lane = detectWorktreeLane(checkout, findRepoRoot(checkout));
	const branch = gitOutput(checkout, ['symbolic-ref', '--quiet', '--short', 'HEAD']) || null;
	const merging = gitOutput(checkout, ['rev-parse', '-q', '--verify', 'MERGE_HEAD']) !== null;
	const message = checkLaneWorkPolicy({ lane, branch, merging, operation });
	return { ok: message === null, laneId: lane.id, branch, message };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const verdict = evaluateLaneGuard(
		process.cwd(),
		process.argv.includes('--commit') ? 'commit' : 'session',
	);
	if (!verdict.ok) {
		console.error(`❌ Error: ${verdict.message}`);
		process.exitCode = 1;
	}
}
