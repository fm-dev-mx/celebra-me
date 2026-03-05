#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Centralized mapping of available ops commands
const SCRIPTS = {
	'check-links': 'check-links.mjs',
	'find-stale': 'find-stale.mjs',
	'rotate-credentials': 'rotate-credentials.mjs',
	'sync-runner': 'sync-runner.mjs',
	'optimize-assets': 'optimize-assets.mjs',
	'smoke-test': 'smoke-test.mjs',
	'validate-schema': 'validate-schema.mjs',
	'validate-commits': 'validate-commits.mjs',
	'remove-env-from-history': 'remove-env-from-history.mjs',
	'rsvp-db-remote-runbook': 'rsvp-db-remote-runbook.mjs',
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

Global Options:
  --help, -h     Show this help message
  --dry-run      Run command without mutating state / side-effects

Run \`pnpm ops <command> --help\` for specific command info.
	`);
	process.exit(0);
}

const command = args[0];
if (!SCRIPTS[command]) {
	console.error(`❌ Unknown command: ${command}`);
	console.log(`Use 'pnpm ops --help' to see available commands.`);
	process.exit(1);
}

const scriptPath = path.join(__dirname, SCRIPTS[command]);
const childProcessArgs = args.slice(1);

const child = spawn(process.execPath, [scriptPath, ...childProcessArgs], {
	stdio: 'inherit',
});

child.on('exit', (code) => {
	process.exit(code || 0);
});
