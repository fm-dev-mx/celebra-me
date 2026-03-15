#!/usr/bin/env node

import { spawnSync } from 'child_process';

function run(cmd, args, options = {}) {
	const isWin = process.platform === 'win32';
	const result = spawnSync(cmd, args, {
		encoding: 'utf8',
		shell: options.shell ?? isWin,
		stdio: options.stdio ?? 'pipe',
		...options,
	});
	if (result.error) throw result.error;
	return {
		status: result.status ?? 1,
		stdout: String(result.stdout || '').trim(),
		stderr: String(result.stderr || '').trim(),
	};
}

function fail(message) {
	console.error(`❌ ${message}`);
	process.exit(1);
}

function parseArgs(argv) {
	const args = { createBranch: null, passthrough: [] };
	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (token === '--create-branch') {
			args.createBranch = argv[i + 1] || null;
			i += 1;
			continue;
		}
		args.passthrough.push(token);
	}
	return args;
}

function assertBranchName(name) {
	return /^[a-z0-9]+(?:[-_/][a-z0-9]+)*$/i.test(name || '');
}

function createBranch(name) {
	if (!assertBranchName(name)) {
		fail(
			'Invalid branch name. Use letters, numbers, "-", "_" or "/" (example: feat/gatekeeper-hardening).',
		);
	}
	const result = run('git', ['switch', '-c', name], { stdio: 'inherit' });
	if (result.status !== 0) {
		fail(`Could not create branch "${name}".`);
	}
}

function runInspect(passthrough) {
	const isWin = process.platform === 'win32';
	const result = spawnSync(
		'node',
		['.agent/governance/bin/gatekeeper-workflow.mjs', 'inspect', ...passthrough],
		{
			encoding: 'utf8',
			shell: isWin,
			stdio: 'inherit',
		},
	);
	process.exit(result.status ?? 1);
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.createBranch) {
		createBranch(args.createBranch);
	}
	runInspect(args.passthrough);
}

main();
