#!/usr/bin/env node

import { spawnSync } from 'child_process';

function main() {
	const msgFile = process.argv[2] || '.git/COMMIT_EDITMSG';
	const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
	const result = spawnSync(executable, ['commitlint', '--edit', msgFile], {
		stdio: 'inherit',
		shell: process.platform === 'win32',
	});

	if (result.error) {
		console.error(result.error.message);
		process.exit(1);
	}
	process.exit(result.status ?? 1);
}

main();
