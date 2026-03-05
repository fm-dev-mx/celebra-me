#!/usr/bin/env node

/**
 * rsvp-db-remote-runbook.mjs
 * Syncs the schema over Supabase locally, and migrates to the remote project.
 * Converted from a .ps1 legacy script.
 */

import { parseArgs } from 'node:util';
import { execSync } from 'node:child_process';

const { values } = parseArgs({
	options: {
		help: { type: 'boolean', short: 'h' },
		'dry-run': { type: 'boolean' },
		'skip-tests': { type: 'boolean' },
		'project-ref': { type: 'string' },
	},
	strict: false,
});

if (values.help) {
	console.log(`
Ejecuta la rotación/configuración del Runbook de RSVP apuntando a remote Supabase.

Usage:
  pnpm ops rsvp-db-remote-runbook [options]

Options:
  --help, -h          Muestra este texto de ayuda
  --dry-run           Simula comandos sin mutar base de datos
  --skip-tests        Omitir suite de testing de API RSVP
  --project-ref <id>  Fuerza un ref-id en lugar de extraerlo de SUPABASE_URL
	`);
	process.exit(0);
}

const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

function step(msg) {
	console.log(`\n${cyan}==> ${msg}${reset}`);
}

function assertEnv(key) {
	if (!process.env[key]) {
		console.error(`Missing required environment variable: ${key}`);
		process.exit(1);
	}
}

step('Validating required environment variables');
assertEnv('SUPABASE_URL');
assertEnv('SUPABASE_SERVICE_ROLE_KEY');
assertEnv('RSVP_TOKEN_SECRET');

let projectRef = values['project-ref'];
if (!projectRef) {
	try {
		const url = new URL(process.env.SUPABASE_URL);
		projectRef = url.hostname.split('.')[0];
	} catch {
		console.error(
			'Could not resolve project ref from SUPABASE_URL. Pass --project-ref explicitly.',
		);
		process.exit(1);
	}
}

step('Checking Supabase CLI availability');
try {
	execSync('vpx supabase --version', { stdio: 'ignore' });
} catch {
	try {
		execSync('supabase --version', { stdio: 'ignore' });
	} catch {
		console.error("Command 'supabase' not found in PATH.");
		process.exit(1);
	}
}

step(`Linking remote project (${projectRef})`);
if (values['dry-run']) {
	console.log(`[DRY RUN] supabase link --project-ref ${projectRef}`);
} else {
	execSync(`supabase link --project-ref ${projectRef}`, { stdio: 'inherit' });
}

step('Listing available projects (quick auth sanity check)');
if (!values['dry-run']) {
	execSync(`supabase projects list`, { stdio: 'inherit' });
}

step('Applying migrations to remote (db push)');
if (values['dry-run']) {
	console.log(`[DRY RUN] supabase db push`);
} else {
	execSync(`supabase db push`, { stdio: 'inherit' });
}

step('Reminder: run SQL verification in Supabase SQL Editor');
console.log(`${yellow}Use: supabase/verification/rsvp_schema_checks.sql${reset}`);

if (!values['skip-tests']) {
	step('Running RSVP critical API test suite');
	if (values['dry-run']) {
		console.log(`[DRY RUN] pnpm test -- --runInBand tests/api/rsvp.*.test.ts`);
	} else {
		execSync(
			`pnpm test -- --runInBand tests/api/rsvp.context.test.ts tests/api/rsvp.post-canonical.test.ts tests/api/rsvp.channel.test.ts tests/api/rsvp.admin.test.ts tests/api/rsvp.export.test.ts`,
			{ stdio: 'inherit' },
		);
	}
}

step('Runbook completed');
console.log(
	`${green}Next: verify RLS/policies/constraints in SQL editor and do manual API smoke.${reset}`,
);
