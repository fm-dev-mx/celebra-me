#!/usr/bin/env node
/**
 * run-related-tests.mjs
 *
 * Launcher for `pnpm test:changed`. Resolves the list of co-located Jest
 * tests for staged source files (mirroring `validate:staged`'s scope), then
 * invokes Jest with `--findRelatedTests` on that list.
 *
 * Why staged: the natural place to run `pnpm test:changed` is right before
 * `git commit`. Working-tree drift that the user has not yet committed
 * would be noise here. The dedicated working-tree feedback command is
 * `pnpm validate:changed`.
 *
 * Exits 0 when no related tests are found (no-op).
 */

import { spawnSync } from 'node:child_process';
import { getStagedFiles } from './shared-changed-files.mjs';
import { getRelatedTestFiles } from './related-test-files.mjs';

const REPO_ROOT = process.cwd();
const SOURCE_PATTERN = /\.(?:ts|tsx|js|jsx|mjs|cjs|astro)$/u;

const stagedFiles = getStagedFiles().filter((file) => SOURCE_PATTERN.test(file));
const related = getRelatedTestFiles(stagedFiles);

if (related.length === 0) {
	console.log('No related tests for staged files. Skipping.');
	process.exit(0);
}

console.log(`Running related tests for staged changes:\n- ${related.join('\n- ')}`);

const result = spawnSync('pnpm', ['exec', 'jest', '--findRelatedTests', ...related], {
	cwd: REPO_ROOT,
	stdio: 'inherit',
	env: process.env,
	shell: process.platform === 'win32',
	maxBuffer: 10 * 1024 * 1024,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
