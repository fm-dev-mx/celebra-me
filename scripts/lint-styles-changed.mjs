#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

import { resolve } from 'node:path';
import { getChangedFiles } from './shared-changed-files.mjs';

const stylesheetFiles = getChangedFiles().filter((file) => /\.(css|scss)$/u.test(file));
const STYLELINT_CLI = resolve(process.cwd(), 'node_modules/stylelint/bin/stylelint.mjs');

if (stylesheetFiles.length === 0) {
	console.log('No changed stylesheet files to lint.');
	process.exit(0);
}

console.log(`Linting changed stylesheet files:\n- ${stylesheetFiles.join('\n- ')}`);

const result = spawnSync(process.execPath, [STYLELINT_CLI, '--cache', ...stylesheetFiles], {
	cwd: process.cwd(),
	stdio: 'inherit',
	env: process.env,
	shell: false,
	maxBuffer: 10 * 1024 * 1024,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
