#!/usr/bin/env node
/**
 * related-test-files.mjs
 *
 * Single source of truth for "which Jest tests cover this source file?".
 * Used by `pnpm test:changed` and `pnpm validate:staged` so both entry
 * points stay in sync.
 *
 * Public API:
 *   getRelatedTestFiles(sourceFiles: string[]): string[]
 *     - For each source file, returns the path of its co-located
 *       `.test.ts`/`.test.tsx`, filtered to those that exist on disk.
 *     - If a source file IS a test file, it is included directly.
 */

import { existsSync } from 'node:fs';

const SOURCE_PATTERN = /\.(?:ts|tsx|js|jsx|mjs|cjs|astro)$/u;
const TEST_PATTERN = /\.test\.(?:ts|tsx)$/u;

export function getRelatedTestFiles(sourceFiles) {
	const candidates = new Set();

	for (const file of sourceFiles.filter((f) => SOURCE_PATTERN.test(f))) {
		const base = file.replace(SOURCE_PATTERN, '');
		candidates.add(`${base}.test.ts`);
		candidates.add(`${base}.test.tsx`);
		if (TEST_PATTERN.test(file)) candidates.add(file);
	}

	return [...candidates].filter((candidate) => existsSync(candidate));
}
