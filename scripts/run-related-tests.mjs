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
import { buildRelatedTestArgs } from './related-test-files.mjs';

const REPO_ROOT = process.cwd();
const stagedFiles = getStagedFiles();
const jestArgs = buildRelatedTestArgs(stagedFiles);

if (jestArgs.length === 0) {
	console.log(
		'No staged Jest inputs. Browser specs and layout changes require their applicable checks.',
	);
	process.exit(0);
}

console.log(`Validating staged inputs with Jest:\n- ${stagedFiles.join('\n- ')}`);

const result = spawnSync('pnpm', jestArgs, {
	cwd: REPO_ROOT,
	stdio: 'inherit',
	env: process.env,
	shell: process.platform === 'win32',
	maxBuffer: 10 * 1024 * 1024,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
