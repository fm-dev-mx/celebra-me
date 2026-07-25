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
 * Steps performed, each on the staged subset only through the shared runner:
 *   1. ESLint (with cache) on staged JS/TS/TSX/Astro files.
 *   2. Stylelint (with cache) on staged SCSS/CSS files.
 *   3. Prettier `--check` on staged supported files (advisory — see notes).
 *   4. Jest `--findRelatedTests` for staged source/test files.
 *
 * Use `pnpm validate:changed` for broader working-tree feedback.
 */

import { getStagedFiles } from './shared-changed-files.mjs';
import { runValidation } from './validation-runner.mjs';

process.exit(
	runValidation({
		files: getStagedFiles(),
		scope: 'staged',
		scopeDescription: 'staged',
	}),
);
