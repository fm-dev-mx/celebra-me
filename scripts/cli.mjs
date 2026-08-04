#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Centralized mapping of available ops commands.
// Invitation lifecycle commands are first-class package.json scripts (invitation:* / dbs).
const SCRIPTS = {
	'check-links': { script: 'check-links.mjs', runtime: 'node' },
	'validate-schema': { script: 'validate-schema.mjs', runtime: 'node' },
	'validate-commits': { script: 'validate-commits.mjs', runtime: 'node' },
	'graphify-views': { script: 'graphify/entry.ts', runtime: 'tsx' },
	'graphify-refresh': { script: 'graphify/refresh.ts', runtime: 'tsx' },
	'graphify-doctor': { script: 'graphify/doctor.ts', runtime: 'tsx' },
	'data-audit-events-invitations': {
		script: 'data-audit-events-invitations.mjs',
		runtime: 'node',
	},
	'worktree-status': { script: 'agent/worktree-status.ts', runtime: 'tsx' },
	'worktree-bootstrap': { script: 'agent/worktree-bootstrap.ts', runtime: 'tsx' },
	'worktree-doctor': { script: 'agent/worktree-doctor.ts', runtime: 'tsx' },
};

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
	console.log(`
Ops Automation CLI Dispatcher
=============================
Usage: pnpm ops <command> [options]

Available Commands:
${Object.keys(SCRIPTS)
	.map((c) => `  - ${c}`)
	.join('\n')}

Canonical invitation / environment status commands (not via ops):
  - pnpm dbs
  - pnpm invitation:update
  - pnpm invitation:reconcile
  - pnpm invitation:content-parity
  - pnpm invitation:promote

Global Options:
  --help, -h     Show this help message
  --dry-run      Run command without mutating state / side-effects

Run \`pnpm ops <command> --help\` for specific command info.
	`);
	process.exit(0);
}

const command = args[0];
if (command === 'dbs') {
	console.error(
		'Removed alias: use `pnpm dbs` (canonical). `pnpm ops dbs` is no longer registered.',
	);
	process.exit(1);
}
if (
	command === 'optimize-assets' ||
	command === 'new-invitation' ||
	command === 'adopt-legacy-events'
) {
	console.error(
		`Removed command: pnpm ops ${command}. This one-shot/legacy path is no longer registered.`,
	);
	process.exit(1);
}
if (!SCRIPTS[command]) {
	console.error(`❌ Unknown command: ${command}`);
	console.log(`Use 'pnpm ops --help' to see available commands.`);
	process.exit(1);
}

const entry = SCRIPTS[command];
const scriptPath = path.join(__dirname, entry.script);
const childProcessArgs = args.slice(1);

let runtime;
let runtimeArgs;
if (entry.runtime === 'tsx') {
	const tsxCli = path.join(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs');
	runtime = process.execPath;
	runtimeArgs = [tsxCli, scriptPath];
} else {
	runtime = process.execPath;
	runtimeArgs = [scriptPath];
}

const child = spawn(runtime, [...runtimeArgs, ...childProcessArgs], {
	stdio: 'inherit',
});

child.on('exit', (code) => {
	process.exit(code || 0);
});
