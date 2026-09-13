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
 * `pnpm run ci` covers static/build, Jest and browser checks. The remote workflow
 * additionally owns repository policy, disposable DB contracts and aggregation.
 */

import { getChangedFilesInWorkingTree } from './shared-changed-files.mjs';
import { runValidation } from './validation-runner.mjs';

process.exit(
	runValidation({
		files: getChangedFilesInWorkingTree(),
		scope: 'changed',
		scopeDescription: 'working-tree',
	}),
);
