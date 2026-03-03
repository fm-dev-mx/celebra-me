#!/usr/bin/env node

import { spawnSync } from 'child_process';

function run(cmd, args, opts = {}) {
	const isWin = process.platform === 'win32';
	const result = spawnSync(cmd, args, {
		encoding: 'utf8',
		shell: isWin,
		stdio: 'pipe',
		...opts,
	});
	if (result.error) throw result.error;
	return {
		status: result.status ?? 1,
		stdout: (result.stdout || '').trim(),
		stderr: (result.stderr || '').trim(),
	};
}

function fail(message) {
	console.error(`❌ ${message}`);
	process.exit(1);
}

function parseArgs(argv) {
	const args = { createBranch: null };
	for (let i = 0; i < argv.length; i += 1) {
		if (argv[i] === '--create-branch') args.createBranch = argv[i + 1] || null;
	}
	return args;
}

function assertBranchName(name) {
	return /^[a-z0-9]+(?:[-_/][a-z0-9]+)*$/i.test(name || '');
}

function getCurrentBranch() {
	const res = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
	if (res.status !== 0 || !res.stdout) fail('Unable to detect current branch.');
	return res.stdout;
}

function createAndSwitchBranch(name) {
	if (!assertBranchName(name)) {
		fail(
			'Invalid branch name. Use letters, numbers, "-", "_" or "/" (example: feat/gatekeeper-hardening).',
		);
	}
	const res = run('git', ['switch', '-c', name]);
	if (res.status !== 0) fail(`Could not create branch "${name}". ${res.stderr || ''}`);
	console.log(`✅ Branch created: ${name}`);
}

function runGatekeeper() {
	const isWin = process.platform === 'win32';
	const res = spawnSync('pnpm', ['gatekeeper:report'], {
		encoding: 'utf8',
		shell: isWin,
		stdio: 'inherit',
	});
	if ((res.status ?? 1) !== 0) {
		process.exit(res.status ?? 1);
	}
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const current = getCurrentBranch();

	if (current === 'main') {
		if (args.createBranch) {
			createAndSwitchBranch(args.createBranch);
		} else {
			fail(
				'You are on main. Create a branch with --create-branch <name> or run git switch -c <name>.',
			);
		}
	}

	console.log('🛡️ Running Gatekeeper checks...');
	runGatekeeper();
	console.log('✅ Gatekeeper passed. You can run: git commit');
}

main();
