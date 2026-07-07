#!/usr/bin/env node
/**
 * validate-staged.mjs
 *
 * Strictly validates **staged** files (the Git index) before commit.
 *
 * Scope: `git diff --cached --name-only --diff-filter=ACMR`
 * - Ignores unstaged working-tree edits entirely.
 * - No-ops successfully when there are no staged matching files.
 * - Never auto-formats or modifies any file (read-only by design).
 *
 * Steps performed, each on the staged subset only:
 *   1. ESLint (with cache) on staged JS/TS/TSX/Astro files.
 *   2. Stylelint (with cache) on staged SCSS/CSS files.
 *   3. Prettier `--check` on staged supported files (advisory — see notes).
 *   4. Jest `--findRelatedTests` for staged source/test files.
 *
 * Use `pnpm validate:changed` for broader working-tree feedback.
 */

import { spawnSync } from 'node:child_process';
import { getStagedFiles } from './shared-changed-files.mjs';

const REPO_ROOT = process.cwd();

const PATTERNS = {
	lintable: /\.(?:ts|tsx|js|jsx|mjs|cjs|astro)$/u,
	stylesheet: /\.(?:css|scss)$/u,
	prettier: /\.(?:ts|tsx|js|jsx|mjs|cjs|astro|json|md|yml|yaml|scss|css)$/u,
	source: /\.(?:ts|tsx|js|jsx|mjs|cjs|astro)$/u,
};

// Cache artifacts and similar noise must not be validated even if they
// somehow end up in the staged set (e.g. from a wide glob).
const IGNORE_FILES = /(?:\.eslintcache|\.stylelintcache|node_modules|\.git)$/u;

function runStep(name, command, args) {
	console.log(`\n→ ${name}`);
	const result = spawnSync(command, args, {
		cwd: REPO_ROOT,
		stdio: 'inherit',
		env: process.env,
		shell: process.platform === 'win32',
		maxBuffer: 10 * 1024 * 1024,
	});
	if (result.error) throw result.error;
	return result.status ?? 1;
}

function filter(files, regex) {
	return files.filter((file) => regex.test(file));
}

function fail(step, code) {
	if (code !== 0) {
		console.error(`\n✖ validate:staged failed at step: ${step} (exit ${code})`);
		process.exit(code);
	}
}

// Strict: staged files only. Untracked and unstaged edits are ignored.
const stagedFiles = getStagedFiles().filter((file) => !IGNORE_FILES.test(file));

if (stagedFiles.length === 0) {
	console.log('No staged files to validate.');
	process.exit(0);
}

console.log(`Validating ${stagedFiles.length} staged file(s):`);
for (const file of stagedFiles) console.log(`  - ${file}`);

// Step 1 — ESLint on staged JS/TS/TSX/Astro
const lintableFiles = filter(stagedFiles, PATTERNS.lintable);
if (lintableFiles.length > 0) {
	const code = runStep('ESLint (staged files, with cache)', 'pnpm', [
		'exec',
		'eslint',
		'--cache',
		...lintableFiles,
	]);
	fail('eslint', code);
} else {
	console.log('\n→ ESLint: no matching staged files, skipping.');
}

// Step 2 — Stylelint on staged SCSS/CSS
const stylesheetFiles = filter(stagedFiles, PATTERNS.stylesheet);
if (stylesheetFiles.length > 0) {
	const code = runStep('Stylelint (staged files, with cache)', 'pnpm', [
		'exec',
		'stylelint',
		'--cache',
		...stylesheetFiles,
	]);
	fail('stylelint', code);
} else {
	console.log('\n→ Stylelint: no matching staged files, skipping.');
}

// Step 3 — Prettier check on staged supported files.
// Prettier is run in **advisory** mode. This is an intentional transition
// step: the repo has pre-existing prettier debt in files that the user
// has staged but is not part of the workflow change. Blocking the
// workflow commit on that debt would conflate scope. New or modified
// workflow files MUST still be formatted; advisory is not a license to
// commit unformatted code. If a flag is new, fix it in this commit.
const prettierFiles = filter(stagedFiles, PATTERNS.prettier);
if (prettierFiles.length > 0) {
	const code = runStep('Prettier check (staged files, advisory)', 'pnpm', [
		'exec',
		'prettier',
		'--check',
		...prettierFiles,
	]);
	if (code !== 0) {
		console.warn('\n⚠ Prettier reported formatting differences in one or more staged files.');
		console.warn('  This is reported as advisory only. Fix in a dedicated commit if needed:');
		console.warn('  pnpm exec prettier --write <files>');
	}
} else {
	console.log('\n→ Prettier: no matching staged files, skipping.');
}

// Step 4 — Related Jest tests for staged source/test files
const sourceFiles = filter(stagedFiles, PATTERNS.source);
if (sourceFiles.length > 0) {
	const { getRelatedTestFiles } = await import('./related-test-files.mjs');
	const testFileList = getRelatedTestFiles(sourceFiles);

	if (testFileList.length > 0) {
		console.log('\n→ Jest (related tests for staged source files):');
		for (const file of testFileList) console.log(`  - ${file}`);
		const code = runStep('Jest related tests', 'pnpm', [
			'exec',
			'jest',
			'--findRelatedTests',
			...testFileList,
		]);
		if (code !== 0) {
			console.error(
				'\n✖ One or more related Jest tests failed. This is a real regression on staged code;',
			);
			console.error(
				'  it must be fixed (or the failing test must be removed from the staged set) before',
			);
			console.error('  the commit can proceed.');
			process.exit(code);
		}
	} else {
		console.log('\n→ Jest related tests: no co-located test files found, skipping.');
	}
} else {
	console.log('\n→ Jest related tests: no source files staged, skipping.');
}

console.log('\n✓ validate:staged passed.');
