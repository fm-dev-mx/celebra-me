#!/usr/bin/env node
/**
 * run-related-tests.mjs
 *
 * Launcher for `pnpm test:changed`. Uses the same staged-input selector as
 * `validate:staged`: related Jest for sources, full Jest for data/config/deletions.
 *
 * Why staged: the natural place to run `pnpm test:changed` is right before
 * `git commit`. Unrelated unstaged paths are not selected, but Jest still reads
 * working-tree contents of selected paths. The working-tree feedback command
 * is `pnpm validate:changed`.
 *
 * Visual references are covered by visual certification, not Jest dependency discovery.
 * Exits 0 when there are no staged Jest inputs; other validation tiers still apply.
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

const cleanEnv = { ...process.env };
for (const key of Object.keys(cleanEnv)) {
	if (
		/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|PREFIX)$/iu.test(
			key,
		)
	) {
		delete cleanEnv[key];
	}
}

const result = spawnSync('pnpm', jestArgs, {
	cwd: REPO_ROOT,
	stdio: 'inherit',
	env: cleanEnv,
	shell: process.platform === 'win32',
	maxBuffer: 10 * 1024 * 1024,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
