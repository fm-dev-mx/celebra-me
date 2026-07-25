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

import { getChangedFilesInWorkingTree } from './shared-changed-files.mjs';
import { runValidation } from './validation-runner.mjs';

process.exit(
	runValidation({
		files: getChangedFilesInWorkingTree(),
		scope: 'changed',
		scopeDescription: 'working-tree',
	}),
);
