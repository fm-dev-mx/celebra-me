#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

import { getChangedFiles } from './shared-changed-files.mjs';

const stylesheetFiles = getChangedFiles().filter((file) => /\.(css|scss)$/u.test(file));

if (stylesheetFiles.length === 0) {
	console.log('No changed stylesheet files to lint.');
	process.exit(0);
}

console.log(`Linting changed stylesheet files:\n- ${stylesheetFiles.join('\n- ')}`);

const result = spawnSync('pnpm', ['exec', 'stylelint', ...stylesheetFiles], {
	cwd: process.cwd(),
	stdio: 'inherit',
	env: process.env,
	shell: process.platform === 'win32',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
