#!/usr/bin/env node
/**
 * run-related-tests.mjs
 *
 * Launcher for `pnpm test:changed`. Passes staged source files directly to
 * Jest `--findRelatedTests`, matching `validate:staged`'s source selection.
 *
 * Why staged: the natural place to run `pnpm test:changed` is right before
 * `git commit`. Working-tree drift that the user has not yet committed
 * would be noise here. The dedicated working-tree feedback command is
 * `pnpm validate:changed`.
 *
 * Exits 0 when no staged source files are found (no-op).
 */

import { spawnSync } from 'node:child_process';
import { getStagedFiles } from './shared-changed-files.mjs';
import { getRelatedTestSourceFiles } from './related-test-files.mjs';

const REPO_ROOT = process.cwd();
const relatedSources = getRelatedTestSourceFiles(getStagedFiles());

if (relatedSources.length === 0) {
	console.log('No staged source files for related tests. Skipping.');
	process.exit(0);
}

console.log(`Finding tests related to staged source files:\n- ${relatedSources.join('\n- ')}`);

const result = spawnSync(
	'pnpm',
	['exec', 'jest', '--findRelatedTests', '--passWithNoTests', ...relatedSources],
	{
		cwd: REPO_ROOT,
		stdio: 'inherit',
		env: process.env,
		shell: process.platform === 'win32',
		maxBuffer: 10 * 1024 * 1024,
	},
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
