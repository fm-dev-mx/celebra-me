import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { CliArgs } from './types';
import type { Database, DbClient } from './types';
import { REQUIRED_ENV_VARS } from './types';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export function parseArgs(): CliArgs {
	const dryRun = process.argv.includes('--dry-run');
	const apply = process.argv.includes('--apply');

	if (dryRun && apply) {
		console.error('Cannot specify both --dry-run and --apply. Choose one mode.');
		process.exit(1);
	}
	if (!dryRun && !apply) {
		console.error('Usage:');
		console.error(
			'  pnpm invitation:prod:provision -- --dry-run --owner-user-id <UUID> --source-dir <PATH>',
		);
		console.error(
			'  pnpm invitation:prod:provision -- --apply   --owner-user-id <UUID> --source-dir <PATH>',
		);
		process.exit(1);
	}

	const ownerIdx = process.argv.indexOf('--owner-user-id');
	const ownerUserId = ownerIdx >= 0 ? process.argv[ownerIdx + 1] : undefined;
	const sourceIdx = process.argv.indexOf('--source-dir');
	const sourceDir = sourceIdx >= 0 ? process.argv[sourceIdx + 1] : undefined;

	if (!ownerUserId) {
		console.error('--owner-user-id is required.');
		process.exit(1);
	}
	if (!sourceDir) {
		console.error('--source-dir is required.');
		process.exit(1);
	}

	const resolved = resolve(sourceDir);
	if (!existsSync(resolved)) {
		console.error(`Source directory does not exist: ${resolved}`);
		process.exit(1);
	}
	if (!statSync(resolved).isDirectory()) {
		console.error(`Source path is not a directory: ${resolved}`);
		process.exit(1);
	}

	return { mode: dryRun ? 'dry-run' : 'apply', ownerUserId, sourceDir: resolved };
}

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

export function validateEnvironment(): { supabaseUrl: string; serviceRoleKey: string } {
	const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]?.trim());
	if (missing.length > 0) {
		console.error(`Missing required environment variables: ${missing.join(', ')}`);
		console.error('Set them in a gitignored file (.env.prod.local or similar) and re-run.');
		process.exit(1);
	}

	const supabaseUrl = process.env.SUPABASE_URL!.trim().replace(/\/+$/, '');
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

	let parsed: URL;
	try {
		parsed = new URL(supabaseUrl);
	} catch {
		console.error('SUPABASE_URL is not a valid URL.');
		process.exit(1);
	}

	if (parsed.protocol !== 'https:') {
		console.error('SUPABASE_URL must use HTTPS protocol.');
		process.exit(1);
	}
	if (parsed.username || parsed.password) {
		console.error('SUPABASE_URL must not contain embedded credentials.');
		process.exit(1);
	}
	if (!parsed.hostname.endsWith('.supabase.co')) {
		console.error(
			`SUPABASE_URL hostname must be a Supabase project (.supabase.co), got: ${parsed.hostname}`,
		);
		process.exit(1);
	}

	if (serviceRoleKey.startsWith('sb_publishable_')) {
		console.error(
			'SUPABASE_SERVICE_ROLE_KEY appears to be a publishable/anon key. Use the secret service-role key.',
		);
		process.exit(1);
	}

	return { supabaseUrl, serviceRoleKey };
}

// ---------------------------------------------------------------------------
// Supabase client creation
// ---------------------------------------------------------------------------

export function createSupabaseClient(supabaseUrl: string, serviceRoleKey: string): DbClient {
	return createClient<Database>(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
}
