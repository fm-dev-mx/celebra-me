/**
 * disposable-test-env.ts — Disposable Test Environment (Docker-based)
 *
 * Creates and manages a disposable PostgreSQL container for destructive testing.
 * Uses Docker directly (not Supabase CLI) for predictable, isolated behavior.
 *
 *   - Container:     celebra-me-test-db
 *   - Port:          54332
 *   - Credentials:   postgres / postgres
 *   - Image:         postgis/postgis:17-3.5 (PG 17 + PostGIS)
 *   - Data:          synthetic test data only
 *
 * Usage:
 *   tsx scripts/db/disposable-test-env.ts start
 *   tsx scripts/db/disposable-test-env.ts reset
 *   tsx scripts/db/disposable-test-env.ts run-tests
 *   tsx scripts/db/disposable-test-env.ts stop
 *   tsx scripts/db/disposable-test-env.ts cleanup
 *   tsx scripts/db/disposable-test-env.ts db-url
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunOptions {
	env?: NodeJS.ProcessEnv;
	input?: string;
	throwOnError?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();
const DISPOSABLE_DIR = resolve(PROJECT_ROOT, 'supabase', 'test');
const SYNTHETIC_DATA_SQL = resolve(DISPOSABLE_DIR, 'seed-test-data.sql');

const DISPOSABLE_PORTS = {
	api: 54331,
	db: 54332,
	studio: 54333,
	shadow: 54330,
} as const;

const DISPOSABLE_DB_URL =
	`postgresql://supabase_admin:postgres@127.0.0.1:${DISPOSABLE_PORTS.db}/postgres`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(path: string): void {
	mkdirSync(path, { recursive: true });
}

function sleep(ms: number): void {
	// Synchronous sleep via Atomics.wait (works in Node.js, not browser)
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runCommand(
	command: string,
	args: string[],
	options: RunOptions = {},
): { status: number | null; stdout: string; stderr: string } {
	const isShellRequired = ['npx', 'supabase', 'pnpm', 'npm'].includes(command);
	const spawnOptions: SpawnSyncOptions = {
		cwd: PROJECT_ROOT,
		env: { ...process.env, ...options.env },
		input: options.input,
		encoding: 'utf8',
		stdio: 'pipe',
		shell: isShellRequired && process.platform === 'win32',
	};
	const result = spawnSync(command, args, spawnOptions);
	return {
		status: result.status,
		stdout: typeof result.stdout === 'string' ? result.stdout : '',
		stderr: typeof result.stderr === 'string' ? result.stderr : (result.error?.message ?? ''),
	};
}

function writeTextFile(path: string, content: string): void {
	ensureDir(dirname(path));
	writeFileSync(path, content, 'utf8');
}

function redactCredentials(text: string): string {
	const urlPattern = /(postgres(?:ql)?:\/\/)(?:[^\s@]+@)?(?:[^\s:]+(?::\d+)?\/[^\s]*)/gi;
	return text.replace(urlPattern, (_match, protocol) => `${protocol}<redacted>@<host>`);
}

function fail(message: string): never {
	console.error(`ERROR: ${message}`);
	process.exit(1);
}

function printUsage(): void {
	console.info(`
Usage:
  tsx scripts/db/disposable-test-env.ts start      Create and start the disposable container
  tsx scripts/db/disposable-test-env.ts reset       Reset the disposable database (destructive)
  tsx scripts/db/disposable-test-env.ts run-tests   Run pgTAP and migration tests
  tsx scripts/db/disposable-test-env.ts stop        Stop the disposable container
  tsx scripts/db/disposable-test-env.ts cleanup     Full cleanup (stop + remove container)
  tsx scripts/db/disposable-test-env.ts db-url      Show the disposable DB URL
`);
}

// ---------------------------------------------------------------------------
// Synthetic seed data
// ---------------------------------------------------------------------------

function ensureSeedData(): void {
	if (existsSync(SYNTHETIC_DATA_SQL)) return;

	ensureDir(DISPOSABLE_DIR);

	const sql = `-- Synthetic test data for disposable test environment
-- Generated for testing purposes only. No PII or production data.

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test-admin@celebra-me.test', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test-client@celebra-me.test', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, slug, title, event_type, owner_user_id, status)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'test-xv-event', 'Test XV Event', 'xv', 'a0000000-0000-0000-0000-000000000001', 'published'),
  ('e0000000-0000-0000-0000-000000000002', 'test-wedding-event', 'Test Wedding Event', 'boda', 'a0000000-0000-0000-0000-000000000001', 'published')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, created_by, kind)
VALUES
  ('f0000000-0000-0000-0000-000000000001', 'test-invitation-xv', 'Test XV Invitation', 'xv', 'draft', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, 'a0000000-0000-0000-0000-000000000001', 'client'),
  ('f0000000-0000-0000-0000-000000000002', 'test-invitation-wedding', 'Test Wedding Invitation', 'boda', 'draft', 'demo-wedding-classic', 'classic', '{}'::jsonb, 'a0000000-0000-0000-0000-000000000002', 'client')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_user_roles (user_id, role)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'super_admin'),
  ('a0000000-0000-0000-0000-000000000002', 'host_client')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.published_invitation_content (id, invitation_project_id, slug, event_type, content, version)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'test-invitation-xv', 'xv', '{"title":"Test XV Invitation"}'::jsonb, 1)
ON CONFLICT (id) DO NOTHING;
`;

	writeTextFile(SYNTHETIC_DATA_SQL, sql);
	console.info(`Seed data written: ${SYNTHETIC_DATA_SQL}`);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdStart(): void {
	console.info('=== Disposable Test Environment: Start ===\n');

	ensureSeedData();

	console.info('Starting disposable PostgreSQL via Docker...');
	const result = runCommand('docker', [
		'run', '-d',
		'--name', 'celebra-me-test-db',
		'-e', 'POSTGRES_PASSWORD=postgres',
		'-p', `${DISPOSABLE_PORTS.db}:5432`,
		'public.ecr.aws/supabase/postgres:17.6.1.143',
	]);

	if (result.status !== 0) {
		const existing = runCommand('docker', ['ps', '-a', '--filter', 'name=celebra-me-test-db', '--format', '{{.Names}}']);
		if (existing.stdout.trim() === 'celebra-me-test-db') {
			console.info('Container already exists. Starting it...');
			runCommand('docker', ['start', 'celebra-me-test-db']);
		} else {
			console.error(result.stderr);
			fail(`docker run failed (exit ${result.status}).`);
		}
	}

	console.info('Waiting for database to be ready...');
	let isReady = false;
	for (let i = 0; i < 30; i++) {
		const ready = runCommand('psql', [
			'--set', 'ON_ERROR_STOP=1',
			'--dbname', DISPOSABLE_DB_URL,
			'--command', 'select 1;',
		]);
		if (ready.status === 0) {
			isReady = true;
			break;
		}
		sleep(1000);
	}
	if (!isReady) {
		fail('Database did not become ready in time.');
	}

	console.info(`\nDisposable test environment is running:`);
	console.info(`  DB:       ${redactCredentials(DISPOSABLE_DB_URL)}`);
	console.info(`  Container: celebra-me-test-db`);
	console.info(`  (Direct psql access only — no Supabase API/Studio)`);
}

function cmdReset(): void {
	console.info('=== Disposable Test Environment: Reset ===\n');

	console.info('Resetting disposable database (drop & recreate public schema)...');
	const result = runCommand('psql', [
		'--set', 'ON_ERROR_STOP=1',
		'--dbname', 'postgresql://supabase_admin:postgres@127.0.0.1:54332/postgres',
	], {
		input: 'drop schema if exists public cascade; drop schema if exists storage cascade; drop schema if exists auth cascade; create schema public; grant all on schema public to postgres; grant all on schema public to public;',
	});

	if (result.status !== 0) {
		console.error(result.stderr);
		fail(`Disposable DB reset failed (exit ${result.status}).`);
	}

	console.info('Disposable database reset complete.');

	const storageSchemaPath = resolve(DISPOSABLE_DIR, 'storage-schema.sql');
	if (existsSync(storageSchemaPath)) {
		console.info('Applying storage schema structure...');
		const schemaResult = runCommand('psql', [
			'--set', 'ON_ERROR_STOP=1',
			'--dbname', 'postgresql://supabase_admin:postgres@127.0.0.1:54332/postgres',
			'--file', storageSchemaPath,
		]);
		if (schemaResult.status !== 0) {
			console.error(schemaResult.stderr);
			fail(`Applying storage schema failed (exit ${schemaResult.status}).`);
		}
		console.info('Dropping conflicting storage policies...');
		const dropPoliciesResult = runCommand('psql', [
			'--set', 'ON_ERROR_STOP=1',
			'--dbname', 'postgresql://supabase_admin:postgres@127.0.0.1:54332/postgres',
		], {
			input: 'drop policy if exists "public read invitation assets" on storage.objects; drop policy if exists "service_role write invitation assets" on storage.objects; drop policy if exists "service_role delete invitation assets" on storage.objects;'
		});
		if (dropPoliciesResult.status !== 0) {
			console.error(dropPoliciesResult.stderr);
			fail(`Dropping storage policies failed (exit ${dropPoliciesResult.status}).`);
		}
	}

	const authSchemaPath = resolve(DISPOSABLE_DIR, 'auth-schema.sql');
	if (existsSync(authSchemaPath)) {
		console.info('Applying auth schema structure...');
		const schemaResult = runCommand('psql', [
			'--set', 'ON_ERROR_STOP=1',
			'--dbname', 'postgresql://supabase_admin:postgres@127.0.0.1:54332/postgres',
			'--file', authSchemaPath,
		]);
		if (schemaResult.status !== 0) {
			console.error(schemaResult.stderr);
			fail(`Applying auth schema failed (exit ${schemaResult.status}).`);
		}
	}

	// Apply all 56 migrations from empty using the single-transaction runner
	console.info('Applying all 56 migrations...');
	const applyResult = runCommand('npx', ['-y', 'tsx', 'scripts/db/apply-migrations.ts',
		'--db-url', 'postgresql://supabase_admin:postgres@127.0.0.1:54332/postgres']);
	if (applyResult.status !== 0) {
		console.error(`WARN: Migrations apply had issues: ${applyResult.stderr || applyResult.stdout}`);
	} else {
		console.info('All migrations applied.');
	}

	if (existsSync(SYNTHETIC_DATA_SQL)) {
		console.info('Applying synthetic seed data...');
		const seedResult = runCommand('psql', [
			'--set', 'ON_ERROR_STOP=1',
			'--dbname', DISPOSABLE_DB_URL,
			'--file', SYNTHETIC_DATA_SQL,
		]);
		if (seedResult.status !== 0) {
			console.error(`WARN: Seed data apply failed: ${seedResult.stderr}`);
		} else {
			console.info('Seed data applied.');
		}
	}
}

function cmdRunTests(): void {
	console.info('=== Disposable Test Environment: Run Tests ===\n');

	const testPath = resolve(PROJECT_ROOT, 'supabase', 'tests', 'atomic_invitation_publication.test.sql');
	if (!existsSync(testPath)) {
		console.info('No pgTAP test files found.');
		return;
	}

	console.info('Ensuring pgTAP extension is created...');
	runCommand('psql', [
		'--set', 'ON_ERROR_STOP=1',
		'--dbname', DISPOSABLE_DB_URL,
	], {
		input: 'CREATE EXTENSION IF NOT EXISTS pgtap;',
	});

	console.info('Running pgTAP tests...');
	const result = runCommand('psql', [
		'--set', 'ON_ERROR_STOP=1',
		'--dbname', DISPOSABLE_DB_URL,
		'--file', testPath,
	]);
	console.info(result.stdout || '');
	if (result.status !== 0) {
		console.error(`    FAILED: ${result.stderr}`);
		process.exit(1);
	}
	console.info('Disposable tests completed.');
}

function cmdStop(): void {
	console.info('=== Disposable Test Environment: Stop ===\n');

	const result = runCommand('docker', ['stop', 'celebra-me-test-db']);
	if (result.status !== 0) {
		console.warn(`docker stop warning: ${result.stderr}`);
	}
	console.info('Disposable environment stopped.');
}

function cmdCleanup(): void {
	cmdStop();

	const rmResult = runCommand('docker', ['rm', 'celebra-me-test-db']);
	if (rmResult.status !== 0) {
		console.warn(`docker rm warning: ${rmResult.stderr}`);
	} else {
		console.info('Container removed.');
	}
	console.info('Disposable environment cleaned up.');
}

function cmdDbUrl(): void {
	console.info(DISPOSABLE_DB_URL);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
	const command = process.argv[2];
	switch (command) {
		case 'start':
			cmdStart();
			break;
		case 'reset':
			cmdReset();
			break;
		case 'run-tests':
			cmdRunTests();
			break;
		case 'stop':
			cmdStop();
			break;
		case 'cleanup':
			cmdCleanup();
			break;
		case 'db-url':
			cmdDbUrl();
			break;
		default:
			printUsage();
			process.exit(command ? 1 : 0);
	}
}

main();
