#!/usr/bin/env node
/**
 * Vercel ignored build step (`vercel.json` → `ignoreCommand`).
 *
 * Exit 0 tells Vercel to skip the build; exit 1 builds. Only Preview deployments may be skipped,
 * and only when no application input changed since the previous deployed commit of the same
 * branch (`VERCEL_GIT_PREVIOUS_SHA`). Production and every uncertain case build (fail-open), so
 * release tooling that waits for a Production deployment per SHA keeps its contract.
 */

import { spawnSync } from 'node:child_process';
import { basename } from 'node:path';

/** Paths Astro reads at build time: application sources, served assets and the config graph. */
export const APPLICATION_INPUT_PATTERNS = [
	/^src\//u,
	/^public\//u,
	/^scripts\/shared\//u,
	/^(?:astro\.config\.mjs|vercel\.json|package\.json|pnpm-lock\.yaml|tsconfig\.json|\.npmrc)$/u,
];

const EXACT_SHA = /^[0-9a-f]{40}$/u;

export function normalizeInputPath(path) {
	return String(path || '').replaceAll('\\', '/');
}

export function isApplicationInput(path) {
	return APPLICATION_INPUT_PATTERNS.some((pattern) => pattern.test(normalizeInputPath(path)));
}

/**
 * @param {{ environment: string | undefined, previousSha: string | undefined, changedPaths: string[] | null }} input
 * @returns {{ build: boolean, reason: string }}
 */
export function decideBuild({ environment, previousSha, changedPaths }) {
	if (environment !== 'preview') {
		return { build: true, reason: `${environment || 'unknown'} deployments always build.` };
	}
	if (!EXACT_SHA.test(previousSha || '')) {
		return { build: true, reason: 'No previous deployed commit is known for this branch.' };
	}
	if (!Array.isArray(changedPaths)) {
		return { build: true, reason: 'The diff against the previous deployment is unavailable.' };
	}
	const inputs = changedPaths.map(normalizeInputPath).filter(isApplicationInput);
	if (inputs.length > 0) {
		return {
			build: true,
			reason: `Application inputs changed since ${previousSha}: ${inputs.join(', ')}`,
		};
	}
	return {
		build: false,
		reason: `No application input changed since ${previousSha}; the previous Preview build still serves this tree.`,
	};
}

function git(args) {
	const result = spawnSync('git', args, { encoding: 'utf8', stdio: 'pipe' });
	return { status: result.error ? 1 : (result.status ?? 1), stdout: String(result.stdout || '') };
}

function changedPathsSince(previousSha) {
	if (git(['cat-file', '-e', `${previousSha}^{commit}`]).status !== 0) return null;
	const diff = git(['diff', '--name-only', '--diff-filter=ACMRD', previousSha, 'HEAD']);
	if (diff.status !== 0) return null;
	return diff.stdout
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter(Boolean);
}

function main() {
	const environment = process.env.VERCEL_ENV;
	const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA;
	const changedPaths =
		environment === 'preview' && EXACT_SHA.test(previousSha || '')
			? changedPathsSince(previousSha)
			: null;
	const decision = decideBuild({ environment, previousSha, changedPaths });
	console.log(`[vercel-ignore-build] ${decision.build ? 'build' : 'skip'}: ${decision.reason}`);
	process.exit(decision.build ? 1 : 0);
}

if (process.argv[1] && /^vercel-ignore-build\.mjs$/u.test(basename(process.argv[1]))) main();
