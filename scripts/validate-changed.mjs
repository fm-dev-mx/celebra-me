#!/usr/bin/env node
/**
 * validate-changed.mjs
 *
 * Validates **working-tree** changes: tracked edits vs HEAD, the staged
 * index, and untracked files. Use this for broader local feedback when
 * the user is mid-edit and has not yet staged anything.
 *
 * This is a wider scope than `pnpm validate:staged`. Both run the same
 * steps; only the file set differs.
 *
 * CI equivalent: `pnpm ci` (full pipeline) or with VALIDATION_BASE_SHA /
 * VALIDATION_HEAD_SHA env vars set, the explicit PR range.
 */

import { spawnSync } from 'node:child_process';
import { getChangedFilesInWorkingTree } from './shared-changed-files.mjs';

const REPO_ROOT = process.cwd();

const PATTERNS = {
	lintable: /\.(?:ts|tsx|js|jsx|mjs|cjs|astro)$/u,
	stylesheet: /\.(?:css|scss)$/u,
	prettier: /\.(?:ts|tsx|js|jsx|mjs|cjs|astro|json|md|yml|yaml|scss|css)$/u,
	source: /\.(?:ts|tsx|js|jsx|mjs|cjs|astro)$/u,
};
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
		console.error(`\n✖ validate:changed failed at step: ${step} (exit ${code})`);
		process.exit(code);
	}
}

const changedFiles = getChangedFilesInWorkingTree().filter((file) => !IGNORE_FILES.test(file));

if (changedFiles.length === 0) {
	console.log('No changed files to validate.');
	process.exit(0);
}

console.log(`Validating ${changedFiles.length} changed file(s) (working tree):`);
for (const file of changedFiles) console.log(`  - ${file}`);

const lintableFiles = filter(changedFiles, PATTERNS.lintable);
if (lintableFiles.length > 0) {
	fail('eslint', runStep('ESLint (changed files)', 'pnpm', ['exec', 'eslint', '--cache', ...lintableFiles]));
} else {
	console.log('\n→ ESLint: no matching changed files, skipping.');
}

const stylesheetFiles = filter(changedFiles, PATTERNS.stylesheet);
if (stylesheetFiles.length > 0) {
	fail(
		'stylelint',
		runStep('Stylelint (changed files)', 'pnpm', ['exec', 'stylelint', '--cache', ...stylesheetFiles]),
	);
} else {
	console.log('\n→ Stylelint: no matching changed files, skipping.');
}

const prettierFiles = filter(changedFiles, PATTERNS.prettier);
if (prettierFiles.length > 0) {
	const code = runStep('Prettier check (changed files, advisory)', 'pnpm', [
		'exec',
		'prettier',
		'--check',
		...prettierFiles,
	]);
	if (code !== 0) {
		console.warn('\n⚠ Prettier reported formatting differences in one or more changed files.');
		console.warn('  This is reported as advisory only.');
	}
} else {
	console.log('\n→ Prettier: no matching changed files, skipping.');
}

const sourceFiles = filter(changedFiles, PATTERNS.source);
if (sourceFiles.length > 0) {
	const { getRelatedTestFiles } = await import('./related-test-files.mjs');
	const testFileList = getRelatedTestFiles(sourceFiles);
	if (testFileList.length > 0) {
		console.log('\n→ Jest (related tests for changed source files):');
		for (const file of testFileList) console.log(`  - ${file}`);
		fail(
			'jest-related',
			runStep('Jest related tests', 'pnpm', [
				'exec',
				'jest',
				'--findRelatedTests',
				...testFileList,
			]),
		);
	} else {
		console.log('\n→ Jest related tests: no co-located test files found, skipping.');
	}
} else {
	console.log('\n→ Jest related tests: no source files in changeset, skipping.');
}

console.log('\n✓ validate:changed passed.');
