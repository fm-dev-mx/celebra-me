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
 *   tsx scripts/db/disposable-test-env.ts run-application-flow
 *   tsx scripts/db/disposable-test-env.ts run-concurrency-test
 *   tsx scripts/db/disposable-test-env.ts run-stale-baseline-test
 *   tsx scripts/db/disposable-test-env.ts stop
 *   tsx scripts/db/disposable-test-env.ts cleanup
 *   tsx scripts/db/disposable-test-env.ts db-url
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASELINE_CUTOFF_VERSION, fail, runCommand } from './db-workflow-lib.ts';
import { redactCredentials } from './db-guard.ts';

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

const POSTGREST_CONTAINER = 'celebra-me-test-postgrest';

const DISPOSABLE_DB_URL = `postgresql://supabase_admin:***@127.0.0.1:${DISPOSABLE_PORTS.db}/postgres`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function printUsage(): void {
	console.info(`
Usage:
  tsx scripts/db/disposable-test-env.ts start      Create and start the disposable container
  tsx scripts/db/disposable-test-env.ts reset [--baseline] Reset the disposable database (destructive)
  tsx scripts/db/disposable-test-env.ts run-tests   Run pgTAP and migration tests
  tsx scripts/db/disposable-test-env.ts run-application-flow  Run the real service retry flow through PostgREST
  tsx scripts/db/disposable-test-env.ts run-concurrency-test  Prove same-key publication contention publishes once
  tsx scripts/db/disposable-test-env.ts run-stale-baseline-test  Exercise public and contact-only baselines
  tsx scripts/db/disposable-test-env.ts stop        Stop the disposable container
  tsx scripts/db/disposable-test-env.ts cleanup     Full cleanup (stop + remove container)
  tsx scripts/db/disposable-test-env.ts db-url      Show the disposable DB URL
`);
}

// ---------------------------------------------------------------------------
// Synthetic seed data
// ---------------------------------------------------------------------------

function ensureSeedData(): void {
	if (!existsSync(SYNTHETIC_DATA_SQL)) {
		fail(`Seed data file not found at ${SYNTHETIC_DATA_SQL}. Make sure the repository files are checked out correctly.`);
	}
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdStart(): void {
	console.info('=== Disposable Test Environment: Start ===\n');

	ensureSeedData();

	console.info('Starting disposable PostgreSQL via Docker...');
	const result = runCommand('docker', [
		'run',
		'-d',
		'--name',
		'celebra-me-test-db',
		'-e',
		'POSTGRES_PASSWORD=postgres',
		'-p',
		`${DISPOSABLE_PORTS.db}:5432`,
		'public.ecr.aws/supabase/postgres:17.6.1.143',
	]);

	if (result.status !== 0) {
		const existing = runCommand('docker', [
			'ps',
			'-a',
			'--filter',
			'name=celebra-me-test-db',
			'--format',
			'{{.Names}}',
		]);
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
			'--set',
			'ON_ERROR_STOP=1',
			'--dbname',
			DISPOSABLE_DB_URL,
			'--command',
			'select 1;',
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
	const result = runCommand(
		'psql',
		[
			'--set',
			'ON_ERROR_STOP=1',
			'--dbname',
			DISPOSABLE_DB_URL,
		],
		{
			input: 'drop schema if exists public cascade; drop schema if exists storage cascade; drop schema if exists auth cascade; drop schema if exists supabase_migrations cascade; create schema public; grant all on schema public to postgres; grant all on schema public to public;',
		},
	);

	if (result.status !== 0) {
		console.error(result.stderr);
		fail(`Disposable DB reset failed (exit ${result.status}).`);
	}

	console.info('Disposable database reset complete.');

	const storageSchemaPath = resolve(DISPOSABLE_DIR, 'storage-schema.sql');
	if (existsSync(storageSchemaPath)) {
		console.info('Applying storage schema structure...');
		const schemaResult = runCommand('psql', [
			'--set',
			'ON_ERROR_STOP=1',
			'--dbname',
			DISPOSABLE_DB_URL,
			'--file',
			storageSchemaPath,
		]);
		if (schemaResult.status !== 0) {
			console.error(schemaResult.stderr);
			fail(`Applying storage schema failed (exit ${schemaResult.status}).`);
		}
		console.info('Dropping conflicting storage policies...');
		const dropPoliciesResult = runCommand(
			'psql',
			[
				'--set',
				'ON_ERROR_STOP=1',
				'--dbname',
				DISPOSABLE_DB_URL,
			],
			{
				input: 'drop policy if exists "public read invitation assets" on storage.objects; drop policy if exists "service_role write invitation assets" on storage.objects; drop policy if exists "service_role delete invitation assets" on storage.objects;',
			},
		);
		if (dropPoliciesResult.status !== 0) {
			console.error(dropPoliciesResult.stderr);
			fail(`Dropping storage policies failed (exit ${dropPoliciesResult.status}).`);
		}
	}

	const authSchemaPath = resolve(DISPOSABLE_DIR, 'auth-schema.sql');
	if (existsSync(authSchemaPath)) {
		console.info('Applying auth schema structure...');
		const schemaResult = runCommand('psql', [
			'--set',
			'ON_ERROR_STOP=1',
			'--dbname',
			DISPOSABLE_DB_URL,
			'--file',
			authSchemaPath,
		]);
		if (schemaResult.status !== 0) {
			console.error(schemaResult.stderr);
			fail(`Applying auth schema failed (exit ${schemaResult.status}).`);
		}
	}

	const isBaseline = process.argv.includes('--baseline');
	const applyArgs = [
		'-y',
		'tsx',
		'scripts/db/apply-migrations.ts',
		'--db-url',
		DISPOSABLE_DB_URL,
	];
	if (isBaseline) {
		applyArgs.push('--max-version', BASELINE_CUTOFF_VERSION);
	}
	const applyResult = runCommand('npx', applyArgs);
	if (applyResult.status !== 0) {
		fail(`Migration failure: ${applyResult.stderr || applyResult.stdout}`);
	} else {
		console.info(applyResult.stdout);
		console.info('Migrations applied successfully.');
	}

	if (existsSync(SYNTHETIC_DATA_SQL)) {
		console.info('Applying synthetic seed data...');
		const seedResult = runCommand('psql', [
			'--set',
			'ON_ERROR_STOP=1',
			'--dbname',
			DISPOSABLE_DB_URL,
			'--file',
			SYNTHETIC_DATA_SQL,
		]);
		if (seedResult.status !== 0) {
			fail(`Synthetic seed failure: ${seedResult.stderr}`);
		} else {
			console.info('Seed data applied.');
		}
	}
}

function cmdRunTests(): void {
	console.info('=== Disposable Test Environment: Run Tests ===\n');

	const testPath = resolve(
		PROJECT_ROOT,
		'supabase',
		'tests',
		'atomic_invitation_publication.test.sql',
	);
	if (!existsSync(testPath)) {
		console.info('No pgTAP test files found.');
		return;
	}

	console.info('Ensuring pgTAP extension is created...');
	runCommand('psql', ['--set', 'ON_ERROR_STOP=1', '--dbname', DISPOSABLE_DB_URL], {
		input: 'CREATE EXTENSION IF NOT EXISTS pgtap;',
	});

	console.info('Running pgTAP tests...');
	const result = runCommand('psql', [
		'--set',
		'ON_ERROR_STOP=1',
		'--dbname',
		DISPOSABLE_DB_URL,
		'--file',
		testPath,
	]);
	console.info(result.stdout || '');
	const tapFailed =
		/(^|\n)not ok\b/m.test(result.stdout) || /Looks like you/i.test(result.stdout);
	if (result.status !== 0 || tapFailed) {
		console.error(
			`    ${result.status !== 0 ? 'Harness failure' : 'Failed TAP assertion'}: ${result.stderr || 'see TAP output above'}`,
		);
		process.exit(1);
	}
	console.info('Disposable tests completed.');
}

function startPostgrest(): void {
	const existing = runCommand('docker', [
		'ps',
		'-a',
		'--filter',
		`name=${POSTGREST_CONTAINER}`,
		'--format',
		'{{.Names}}',
	]);
	if (existing.stdout.trim() === POSTGREST_CONTAINER) {
		runCommand('docker', ['start', POSTGREST_CONTAINER]);
		return;
	}
	const result = runCommand('docker', [
		'run',
		'-d',
		'--rm',
		'--name',
		POSTGREST_CONTAINER,
		'-p',
		`${DISPOSABLE_PORTS.api}:3000`,
		'-e',
		'PGRST_DB_URI=postgresql://postgres:***@host.docker.internal:54332/postgres',
		'-e',
		'PGRST_DB_SCHEMAS=public',
		'-e',
		'PGRST_DB_ANON_ROLE=anon',
		'-e',
		'PGRST_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long',
		'public.ecr.aws/supabase/postgrest:v14.14',
	]);
	if (result.status !== 0)
		fail(`Application harness failure: PostgREST start failed: ${result.stderr}`);
	for (let attempt = 0; attempt < 20; attempt++) {
		const ready = runCommand('curl.exe', ['--silent', '--fail', 'http://127.0.0.1:54331/']);
		if (ready.status === 0) return;
		sleep(250);
	}
	fail('Application harness failure: PostgREST did not become reachable.');
}

function cmdRunApplicationFlow(): void {
	console.info('=== Disposable Test Environment: Application Publication Flow ===\n');
	startPostgrest();
	const result = runCommand('node', [
		'--import',
		'tsx',
		'--experimental-loader',
		'./scripts/db/test-asset-loader.mjs',
		'scripts/db/publication-application-flow.ts',
	]);
	console.info(result.stdout || '');
	if (result.status !== 0) {
		fail(`Application assertion failure: ${result.stderr || result.stdout}`);
	}
}

function cmdRunConcurrencyTest(): void {
	console.info('=== Disposable Test Environment: Concurrent Publication ===\n');
	const result = runCommand('npx', ['-y', 'tsx', 'scripts/db/publication-concurrency-test.ts']);
	console.info(result.stdout || '');
	if (result.status !== 0)
		fail(`Application assertion failure: ${result.stderr || result.stdout}`);
}

function cmdRunStaleBaselineTest(): void {
	console.info('=== Disposable Test Environment: Publication Stale Baselines ===\n');
	const result = runCommand('npx', [
		'-y',
		'tsx',
		'scripts/db/publication-stale-baseline-test.ts',
	]);
	console.info(result.stdout || '');
	if (result.status !== 0)
		fail(`Application assertion failure: ${result.stderr || result.stdout}`);
}

function cmdStop(): void {
	console.info('=== Disposable Test Environment: Stop ===\n');

	runCommand('docker', ['rm', '-f', POSTGREST_CONTAINER]);
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
		case 'run-application-flow':
			cmdRunApplicationFlow();
			break;
		case 'run-concurrency-test':
			cmdRunConcurrencyTest();
			break;
		case 'run-stale-baseline-test':
			cmdRunStaleBaselineTest();
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
