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
