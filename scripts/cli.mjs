#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Centralized mapping of available ops commands
const SCRIPTS = {
	'optimize-assets': { script: 'optimize-assets.mjs', runtime: 'node' },
	'check-links': { script: 'check-links.mjs', runtime: 'node' },
	'validate-schema': { script: 'validate-schema.mjs', runtime: 'node' },
	'validate-event-parity': { script: 'validate-event-parity.ts', runtime: 'tsx' },
	'validate-commits': { script: 'validate-commits.mjs', runtime: 'node' },
	'graphify-views': { script: 'graphify/entry.ts', runtime: 'tsx' },
	'new-invitation': { script: 'new-invitation.mjs', runtime: 'node' },
	'data-audit-events-invitations': {
		script: 'data-audit-events-invitations.mjs',
		runtime: 'node',
	},
	'adopt-legacy-events': { script: 'adopt-legacy-events.mjs', runtime: 'node' },
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
