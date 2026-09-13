#!/usr/bin/env node
/**
 * related-test-files.mjs
 *
 * Single source of truth for the changed files passed to Jest
 * `--findRelatedTests`.
 *
 * Public API:
 *   getRelatedTestSourceFiles(changedFiles: string[]): string[]
 *     - Returns changed JavaScript, TypeScript, and Astro source files.
 *     - Directly changed test files remain in the list so Jest runs them.
 *     - Missing paths are excluded (for example, deleted working-tree files).
 */

import { existsSync } from 'node:fs';

const SOURCE_PATTERN = /\.(?:ts|tsx|js|jsx|mjs|cjs|astro)$/u;

export function getRelatedTestSourceFiles(changedFiles, pathExists = existsSync) {
	return [
		...new Set(changedFiles.filter((file) => SOURCE_PATTERN.test(file) && pathExists(file))),
	];
}

/** Deleted sources and data/config inputs have no reliable import graph. */
export function buildRelatedTestArgs(changedFiles, pathExists = existsSync) {
	const files = [...new Set(changedFiles.map((file) => file.replaceAll('\\', '/')))];
	const needsFullSuite = files.some(
		(file) =>
			(/\.(?:json|ya?ml)$/u.test(file) && !file.startsWith('docs/')) ||
			(SOURCE_PATTERN.test(file) && !file.startsWith('tests/e2e/') && !pathExists(file)),
	);
	if (needsFullSuite) return ['exec', 'jest'];
	const sources = getRelatedTestSourceFiles(files, pathExists).filter(
		(file) => !file.startsWith('tests/e2e/'),
	);
	return sources.length
		? ['exec', 'jest', '--findRelatedTests', '--passWithNoTests', ...sources]
		: [];
}
