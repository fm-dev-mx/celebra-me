#!/usr/bin/env node
/**
 * validate-staged.mjs
 *
 * Selects validation inputs from staged paths before commit.
 *
 * Scope: staged paths, including deletions, from shared-changed-files.mjs.
 * - Tools read working-tree contents; this is not an isolated index snapshot.
 * - No-ops successfully when there are no staged matching files.
 * - Never auto-formats or modifies any file (read-only by design).
 *
 * Steps performed, each on the staged subset only through the shared runner:
 *   1. ESLint (with cache) on staged JS/TS/TSX/Astro files.
 *   2. Stylelint (with cache) on staged SCSS/CSS files.
 *   3. Prettier `--check` on staged supported files (advisory — see notes).
 *   4. Shared Jest selection, including full-suite fallback for data/config/deletions.
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
