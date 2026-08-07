/**
 * disposable-test-env.ts — Disposable Test Environment (Docker-based)
 *
 * Creates and manages a disposable PostgreSQL container for destructive testing and canonical audit reconstruction.
 * Uses Docker directly (not Supabase CLI) for predictable, isolated behavior.
 *
 *   - Container:     celebra-me-test-db
 *   - Port:          54332
 *   - Credentials:   supabase_admin / postgres (or postgres / postgres)
 *   - Image:         public.ecr.aws/supabase/postgres:17.6.1.143
 *   - Data:          synthetic test data only
 *
 * Usage:
 *   tsx scripts/db/disposable-test-env.ts start
 *   tsx scripts/db/disposable-test-env.ts reset [--baseline|--max-version=<version>]
 *   tsx scripts/db/disposable-test-env.ts run-tests
 *   tsx scripts/db/disposable-test-env.ts run-application-flow
 *   tsx scripts/db/disposable-test-env.ts run-concurrency-test
 *   tsx scripts/db/disposable-test-env.ts run-phase3-concurrency-test
 *   tsx scripts/db/disposable-test-env.ts run-stale-baseline-test
 *   tsx scripts/db/disposable-test-env.ts stop
 *   tsx scripts/db/disposable-test-env.ts cleanup
 *   tsx scripts/db/disposable-test-env.ts db-url
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	BASELINE_CUTOFF_VERSION,
	DISPOSABLE_DB_URL,
	DISPOSABLE_TEST,
	fail,
	redactCredentials,
	runCommand,
} from './db-workflow-lib.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();
const DISPOSABLE_DIR = resolve(PROJECT_ROOT, 'supabase', 'test');
const SYNTHETIC_DATA_SQL = resolve(DISPOSABLE_DIR, 'seed-test-data.sql');

const DISPOSABLE_PORTS = {
	api: DISPOSABLE_TEST.apiPort,
	db: DISPOSABLE_TEST.dbPort,
	studio: DISPOSABLE_TEST.studioPort,
	shadow: DISPOSABLE_TEST.shadowPort,
} as const;

const POSTGREST_CONTAINER = DISPOSABLE_TEST.postgrestContainerName;

/** Image identifier for the Supabase PostgreSQL container. */
const POSTGRES_IMAGE = 'public.ecr.aws/supabase/postgres:17.6.1.143';

/**
 * Bounded wait for a fresh disposable PostgreSQL container to become ready.
 * GitHub-hosted cold runners may need significantly longer than a warm local
 * cache. The value is explicit and centralized.
 */
const READINESS_TIMEOUT_MS = 120_000;

/** How long between readiness poll cycles. */
const READINESS_POLL_MS = 1_000;

/** Docker image-pull retry budget. */
const IMAGE_RETRY_COUNT = 3;
const IMAGE_RETRY_DELAY_MS = 5_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function sleepAsync(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function printUsage(): void {
	console.info(`
Usage:
  tsx scripts/db/disposable-test-env.ts start      Create and start the disposable container
  tsx scripts/db/disposable-test-env.ts reset [--baseline|--max-version=<version>] Reset the disposable database (destructive)
  tsx scripts/db/disposable-test-env.ts run-tests   Run pgTAP and migration tests
  tsx scripts/db/disposable-test-env.ts run-rsvp-db-contracts  Reset disposable DB, start PostgREST, run public RSVP Jest contracts
  tsx scripts/db/disposable-test-env.ts run-managed-db-contracts  Reset disposable DB, run managed rekey Jest contracts
  tsx scripts/db/disposable-test-env.ts run-application-flow  Run the real service retry flow through PostgREST
  tsx scripts/db/disposable-test-env.ts run-concurrency-test  Prove same-key publication contention publishes once
  tsx scripts/db/disposable-test-env.ts run-phase3-concurrency-test  Exercise Editor/managed/publication/asset contention
  tsx scripts/db/disposable-test-env.ts run-stale-baseline-test  Exercise public and contact-only baselines
  tsx scripts/db/disposable-test-env.ts stop        Stop the disposable container
  tsx scripts/db/disposable-test-env.ts cleanup     Full cleanup (stop + remove container)
  tsx scripts/db/disposable-test-env.ts db-url      Show the disposable DB URL
`);
}

function ensureSeedData(): void {
	if (!existsSync(SYNTHETIC_DATA_SQL)) {
		fail(
			`Seed data file not found at ${SYNTHETIC_DATA_SQL}. Make sure the repository files are checked out correctly.`,
		);
	}
}

/**
 * Verify if the container listening on 54332 is the intended disposable test container and is responsive.
 * This is the EXTERNAL authenticated check — the final success condition.
 */
export function isDisposableDbReady(): boolean {
	const result = runCommand(
		'psql',
		['--set', 'ON_ERROR_STOP=1', '--dbname', DISPOSABLE_DB_URL, '--command', 'select 1;'],
		{ throwOnError: false },
	);
	return result.status === 0;
}

/**
 * Check internal PostgreSQL readiness inside the container.
 * Uses docker exec + pg_isready to determine whether the PostgreSQL server
 * process is accepting connections, independent of external port mapping.
 */
function isContainerPgReady(): boolean {
	const result = runCommand(
		'docker',
		['exec', DISPOSABLE_TEST.containerName, 'pg_isready', '-U', DISPOSABLE_TEST.dbUser],
		{ throwOnError: false },
	);
	return result.status === 0;
}

/**
 * Check whether the Docker container is currently running.
 */
function isContainerRunning(): boolean {
	const result = runCommand(
		'docker',
		['ps', '--filter', `name=${DISPOSABLE_TEST.containerName}`, '--format', '{{.Names}}'],
		{ throwOnError: false },
	);
	return result.stdout.trim() === DISPOSABLE_TEST.containerName;
}

/**
 * Check if the container exists at all (running or stopped).
 */
function containerExists(): boolean {
	const result = runCommand(
		'docker',
		['ps', '-a', '--filter', `name=${DISPOSABLE_TEST.containerName}`, '--format', '{{.Names}}'],
		{ throwOnError: false },
	);
	return result.stdout.trim() === DISPOSABLE_TEST.containerName;
}

/**
 * Ensure the Docker image is available locally. If absent, pull it with
 * bounded retry and backoff. Fails closed after all attempts are exhausted.
 */
function ensureImageExists(imageName = POSTGRES_IMAGE): void {
	// Check if image already exists locally
	const imageCheck = runCommand('docker', ['image', 'inspect', imageName], {
		throwOnError: false,
	});
	if (imageCheck.status === 0) {
		console.info(`  Image ${imageName} already present locally.`);
		return;
	}

	console.info(`  Pulling ${imageName} (up to ${IMAGE_RETRY_COUNT} retries)...`);
	for (let attempt = 1; attempt <= IMAGE_RETRY_COUNT; attempt++) {
		if (attempt > 1) {
			const delay = IMAGE_RETRY_DELAY_MS * attempt;
			console.info(`  Retry ${attempt}/${IMAGE_RETRY_COUNT} after ${delay}ms...`);
			sleep(delay);
		}
		const pullResult = runCommand('docker', ['pull', imageName], {
			throwOnError: false,
		});
		if (pullResult.status === 0) {
			console.info(`  Image ${imageName} pulled successfully.`);
			return;
		}
		console.warn(
			`  docker pull attempt ${attempt} failed: ${pullResult.stderr?.slice(0, 200) || `exit ${pullResult.status}`}`,
		);
	}
	fail(
		`Failed to pull ${imageName} after ${IMAGE_RETRY_COUNT} attempts. Check Docker Hub rate limits and network connectivity.`,
	);
}

/**
 * Wait for the container to become ready using a two-stage check:
 *   1. Internal: docker exec pg_isready — PostgreSQL process accepting connections.
 *   2. External: authenticated psql via DISPOSABLE_DB_URL — port mapping and credentials.
 *
 * Returns true if the external authenticated check passed within the timeout.
 */
function waitForContainerReady(): boolean {
	const deadline = Date.now() + READINESS_TIMEOUT_MS;
	let internalReady = false;
	let externalReady = false;

	console.info(`  Waiting up to ${READINESS_TIMEOUT_MS / 1000}s for database readiness...`);

	while (Date.now() < deadline) {
		// Stage 1: internal PostgreSQL readiness
		if (!internalReady) {
			if (isContainerPgReady()) {
				internalReady = true;
				console.info('  Internal pg_isready: OK');
			} else {
				sleep(READINESS_POLL_MS);
				continue;
			}
		}

		// Stage 2: external authenticated check
		if (isDisposableDbReady()) {
			externalReady = true;
			break;
		}

		sleep(READINESS_POLL_MS);
	}

	if (externalReady) {
		return true;
	}

	// Diagnostics for failure
	console.warn(`\n  Database did not become ready within ${READINESS_TIMEOUT_MS / 1000}s.`);
	console.warn(`  Internal pg_isready: ${internalReady ? 'PASSED' : 'FAILED'}`);

	const externalResult = runCommand(
		'psql',
		['--set', 'ON_ERROR_STOP=1', '--dbname', DISPOSABLE_DB_URL, '--command', 'select 1;'],
		{ throwOnError: false },
	);
	console.warn(
		`  External authenticated check: ${externalResult.status === 0 ? 'PASSED' : `FAILED (exit ${externalResult.status})`}`,
	);

	// Docker container state diagnostics
	const containerStatus = runCommand(
		'docker',
		['inspect', DISPOSABLE_TEST.containerName, '--format', '{{.State.Status}}'],
		{ throwOnError: false },
	);
	if (containerStatus.status === 0) {
		console.warn(`  Container state: ${containerStatus.stdout.trim() || '(unknown)'}`);
	}

	const healthStatus = runCommand(
		'docker',
		['inspect', DISPOSABLE_TEST.containerName, '--format', '{{.State.Health.Status}}'],
		{ throwOnError: false },
	);
	if (healthStatus.status === 0 && healthStatus.stdout.trim()) {
		console.warn(`  Health status: ${healthStatus.stdout.trim()}`);
	}

	// Last N log lines (sanitized — never contains secrets for disposable)
	const logs = runCommand('docker', ['logs', '--tail', '30', DISPOSABLE_TEST.containerName], {
		throwOnError: false,
	});
	if (logs.status === 0 && logs.stdout) {
		console.warn(`  Last 30 log lines:\n${logs.stdout.slice(0, 2000)}`);
	}
	if (logs.stderr) {
		console.warn(`  Last 30 log lines (stderr):\n${logs.stderr.slice(0, 2000)}`);
	}

	return false;
}

/**
 * Emit sanitized diagnostics on final startup failure and exit.
 * Never prints database URLs, passwords, tokens, or other secrets.
 */
function failWithDiagnostics(): never {
	// All diagnostic info was already printed by waitForContainerReady.
	fail('Database did not become ready in time.');
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export function cmdStart(): void {
	console.info('=== Disposable Test Environment: Start ===\n');

	ensureSeedData();

	// Quick path: already running and authenticated
	if (isDisposableDbReady()) {
		console.info('Disposable PostgreSQL container is already running and accessible.');
		return;
	}

	// Ensure the Docker image is available locally (pull with bounded retry)
	ensureImageExists();

	const exists = containerExists();

	if (exists) {
		const running = isContainerRunning();
		if (running) {
			console.info(
				'Container already exists and is running. Waiting for database readiness...',
			);
		} else {
			console.info('Container exists but is stopped. Starting it...');
			runCommand('docker', ['start', DISPOSABLE_TEST.containerName], { throwOnError: false });
		}

		// Wait for readiness with the extended timeout
		if (waitForContainerReady()) {
			printReady();
			return;
		}

		// The container failed to become ready despite being created earlier.
		// This is evidence of a stale or broken container — recreate once.
		console.warn('\nContainer failed to become ready. Removing and recreating...');
		runCommand('docker', ['rm', '-f', DISPOSABLE_TEST.containerName], { throwOnError: false });

		// Fall through to create a fresh container below
	}

	// Fresh container: create and wait (never destroy while initializing)
	console.info('Starting disposable PostgreSQL via Docker...');
	const createResult = runCommand(
		'docker',
		[
			'run',
			'-d',
			'--name',
			DISPOSABLE_TEST.containerName,
			'-e',
			`POSTGRES_PASSWORD=${DISPOSABLE_TEST.dbPassword}`,
			'-p',
			`${DISPOSABLE_PORTS.db}:5432`,
			POSTGRES_IMAGE,
		],
		{ throwOnError: false },
	);

	if (createResult.status !== 0) {
		console.error(createResult.stderr);
		fail(`docker run failed (exit ${createResult.status}).`);
	}

	// A fresh container gets one continuous readiness window.
	// It is NOT recreated merely because it hasn't become ready after 30s.
	if (waitForContainerReady()) {
		printReady();
		return;
	}

	// Final failure with diagnostics
	failWithDiagnostics();
}

function printReady(): void {
	console.info(`\nDisposable test environment is running:`);
	console.info(`  DB:       ${redactCredentials(DISPOSABLE_DB_URL)}`);
	console.info(`  Container: ${DISPOSABLE_TEST.containerName}`);
	console.info(`  (Direct psql access only — no Supabase API/Studio)`);
}

function applyDisposableMigrations(options: { isBaseline: boolean; maxVersion?: string }): void {
	// Full and cutoff applies share the disposable migrate policy/executor.
	const applyArgs = [
		'-y',
		'tsx',
		'scripts/db/migrate-cli.ts',
		'--target',
		'disposable-test',
		'--apply',
		'--no-interactive',
	];
	if (options.isBaseline) {
		applyArgs.push('--max-version', BASELINE_CUTOFF_VERSION);
	} else if (options.maxVersion) {
		applyArgs.push('--max-version', options.maxVersion);
	}
	const applyResult = runCommand('npx', applyArgs);
	if (applyResult.status !== 0) {
		fail(`Migration failure: ${applyResult.stderr || applyResult.stdout}`);
	}
	console.info(applyResult.stdout);
	console.info('Migrations applied successfully via shared disposable migrate policy.');
}

export function cmdReset(): void {
	console.info('=== Disposable Test Environment: Reset ===\n');

	if (!isDisposableDbReady()) {
		cmdStart();
	}

	console.info('Resetting disposable database (drop & recreate public schema)...');
	const result = runCommand('psql', ['--set', 'ON_ERROR_STOP=1', '--dbname', DISPOSABLE_DB_URL], {
		input: 'drop schema if exists public cascade; drop schema if exists storage cascade; drop schema if exists auth cascade; drop schema if exists supabase_migrations cascade; create schema public; grant all on schema public to postgres; grant all on schema public to public;',
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
			['--set', 'ON_ERROR_STOP=1', '--dbname', DISPOSABLE_DB_URL],
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
	const maxVersionArgument = process.argv.find((argument) =>
		argument.startsWith('--max-version='),
	);
	const maxVersion = maxVersionArgument?.slice('--max-version='.length);
	if (isBaseline && maxVersion) {
		fail('Use either --baseline or --max-version, not both.');
	}
	if (maxVersion && !/^\d{14}$/.test(maxVersion)) {
		fail('Disposable reset --max-version must be a 14-digit migration version.');
	}
	applyDisposableMigrations({ isBaseline, maxVersion });

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

	// Public RSVP RPCs use unqualified gen_random_bytes() with search_path=public.
	// Supabase installs pgcrypto in `extensions`; expose a public wrapper for disposable parity.
	console.info('Ensuring public.gen_random_bytes wrapper for pgcrypto (extensions schema)...');
	const pgcryptoWrapper = runCommand(
		'psql',
		['--set', 'ON_ERROR_STOP=1', '--dbname', DISPOSABLE_DB_URL],
		{
			input: `
create extension if not exists pgcrypto with schema extensions;
create or replace function public.gen_random_bytes(integer)
returns bytea
language sql
stable
as $fn$ select extensions.gen_random_bytes($1) $fn$;
`,
		},
	);
	if (pgcryptoWrapper.status !== 0) {
		fail(`pgcrypto public wrapper failure: ${pgcryptoWrapper.stderr}`);
	}
}

function cmdRunTests(): void {
	console.info('=== Disposable Test Environment: Run Tests ===\n');

	const testFiles = [
		'atomic_invitation_publication.test.sql',
		'managed_identity_archive_cascade.test.sql',
	];
	const testPaths = testFiles.map((file) => resolve(PROJECT_ROOT, 'supabase', 'tests', file));
	if (!testPaths.some((testPath) => existsSync(testPath))) {
		console.info('No pgTAP test files found.');
		return;
	}

	console.info('Ensuring pgTAP extension is created...');
	runCommand('psql', ['--set', 'ON_ERROR_STOP=1', '--dbname', DISPOSABLE_DB_URL], {
		input: 'CREATE EXTENSION IF NOT EXISTS pgtap;',
	});

	console.info('Ensuring public.gen_random_bytes wrapper for pgcrypto (extensions schema)...');
	const pgcryptoWrapper = runCommand(
		'psql',
		['--set', 'ON_ERROR_STOP=1', '--dbname', DISPOSABLE_DB_URL],
		{
			input: `
create extension if not exists pgcrypto with schema extensions;
create or replace function public.gen_random_bytes(integer)
returns bytea
language sql
stable
as $fn$ select extensions.gen_random_bytes($1) $fn$;
`,
		},
	);
	if (pgcryptoWrapper.status !== 0) {
		fail(`pgcrypto public wrapper failure: ${pgcryptoWrapper.stderr}`);
	}

	console.info('Running pgTAP tests...');
	for (const testPath of testPaths) {
		if (!existsSync(testPath)) continue;
		console.info(`  file: ${testPath}`);
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
	}
	console.info('Disposable tests completed.');
}

/**
 * Build docker CLI arguments for the PostgREST container.
 * Exported for testing.
 */
export function buildPostgrestDockerArgs(isLinux: boolean): string[] {
	const args = [
		'run',
		'-d',
		'--rm',
		'--name',
		POSTGREST_CONTAINER,
		'-p',
		`${DISPOSABLE_PORTS.api}:3000`,
		'-e',
		`PGRST_DB_URI=postgresql://${DISPOSABLE_TEST.dbUser}:${DISPOSABLE_TEST.dbPassword}@host.docker.internal:54332/postgres`,
		'-e',
		'PGRST_DB_SCHEMAS=public',
		'-e',
		'PGRST_DB_ANON_ROLE=anon',
		'-e',
		'PGRST_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long',
		'public.ecr.aws/supabase/postgrest:v14.14',
	];
	if (isLinux) {
		args.splice(3, 0, '--add-host=host.docker.internal:host-gateway');
	}
	return args;
}

async function waitForPostgrestReady(): Promise<void> {
	for (let attempt = 0; attempt < 20; attempt++) {
		try {
			const response = await fetch('http://127.0.0.1:54331/');
			if (response.ok || response.status === 404) return;
		} catch {
			// Not ready yet
		}
		await sleepAsync(250);
	}
	fail('Application harness failure: PostgREST did not become reachable.');
}

async function startPostgrest(): Promise<void> {
	ensureImageExists('public.ecr.aws/supabase/postgrest:v14.14');
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
	} else {
		const dockerArgs = buildPostgrestDockerArgs(process.platform === 'linux');
		const result = runCommand('docker', dockerArgs);
		if (result.status !== 0)
			fail(`Application harness failure: PostgREST start failed: ${result.stderr}`);
	}
	await waitForPostgrestReady();
}

async function cmdRunApplicationFlow(): Promise<void> {
	console.info('=== Disposable Test Environment: Application Publication Flow ===\n');
	await startPostgrest();
	const result = runCommand('node', [
		'--import',
		'tsx',
		'--experimental-loader',
		'./scripts/db/test-asset-loader.mjs',
		'scripts/db/publication-application-flow.ts',
	]);
	console.info(result.stdout || '');
	if (result.status !== 0) {
		const cleanStderr = redactCredentials(result.stderr);
		const cleanStdout = redactCredentials(result.stdout);
		console.error('Application flow stderr:', cleanStderr || '(none)');
		console.error('Application flow stdout:', cleanStdout || '(none)');
		fail(
			`Application assertion failure: ${cleanStderr || cleanStdout || `exit code ${result.status}`}`,
		);
	}
}

function ensureDisposableReset(failMessage: string): void {
	if (!isDisposableDbReady()) {
		console.info('Disposable database not ready; starting container...');
		cmdStart();
	}
	if (!isDisposableDbReady()) {
		fail(failMessage);
	}
	console.info('Resetting disposable database to apply canonical migrations + seed...');
	cmdReset();
}

/**
 * Provision disposable Postgres + PostgREST and run the public RSVP Jest DB/HTTP contracts.
 * These suites are excluded from the generic no-DB Jest phase and must not silently skip.
 */
async function cmdRunRsvpDbContracts(): Promise<void> {
	console.info('=== Disposable Test Environment: Public RSVP DB/HTTP Contracts ===\n');
	ensureDisposableReset(
		'Public RSVP DB contracts require a reachable disposable database on port 54332.',
	);

	console.info('Starting disposable PostgREST...');
	await startPostgrest();

	const disposableApi = `http://127.0.0.1:${DISPOSABLE_PORTS.api}`;
	const demoAnonKey =
		'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
	const demoServiceRoleKey =
		'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

	console.info('Running public RSVP Jest DB/HTTP contract suites...');
	const result = runCommand(
		'pnpm',
		[
			'exec',
			'jest',
			'--runInBand',
			'--config',
			'jest.rsvp-db-contracts.config.cjs',
			'tests/db/public-guest-rsvp-db-boundary.test.ts',
			'tests/db/public-rsvp-http-wiring-db.test.ts',
		],
		{
			throwOnError: false,
			env: {
				...process.env,
				CELEBRA_RSVP_DB_CONTRACTS: '1',
				SUPABASE_URL: disposableApi,
				PUBLIC_SUPABASE_URL: disposableApi,
				SUPABASE_ANON_KEY: demoAnonKey,
				SUPABASE_SERVICE_ROLE_KEY: demoServiceRoleKey,
			},
		},
	);
	console.info(result.stdout || '');
	if (result.status !== 0) {
		const cleanStderr = redactCredentials(result.stderr);
		const cleanStdout = redactCredentials(result.stdout);
		console.error('RSVP DB contract stderr:', cleanStderr || '(none)');
		console.error('RSVP DB contract stdout:', cleanStdout || '(none)');
		fail(
			`Public RSVP DB/HTTP contract failure: ${cleanStderr || cleanStdout || `exit code ${result.status}`}`,
		);
	}
	console.info('Public RSVP DB/HTTP contracts passed.');
}

/**
 * Provision disposable Postgres and run managed-lifecycle rekey Jest contracts.
 * These suites are excluded from the generic no-DB Jest phase and must not silently skip.
 */
function cmdRunManagedDbContracts(): void {
	console.info('=== Disposable Test Environment: Managed DB Contracts ===\n');
	ensureDisposableReset(
		'Managed DB contracts require a reachable disposable database on port 54332. ' +
			'Setup failed before product assertions (start Docker / pnpm db:disposable:start).',
	);

	console.info('Running managed rekey Jest DB contract suites...');
	const result = runCommand(
		'pnpm',
		[
			'exec',
			'jest',
			'--runInBand',
			'--config',
			'jest.managed-db-contracts.config.cjs',
			'tests/provision/goal2-rekey-disposable-integration.test.ts',
		],
		{
			throwOnError: false,
			env: {
				...process.env,
				CELEBRA_MANAGED_DB_CONTRACTS: '1',
			},
		},
	);
	console.info(result.stdout || '');
	if (result.status !== 0) {
		const cleanStderr = redactCredentials(result.stderr);
		const cleanStdout = redactCredentials(result.stdout);
		console.error('Managed DB contract stderr:', cleanStderr || '(none)');
		console.error('Managed DB contract stdout:', cleanStdout || '(none)');
		fail(
			`Managed DB contract failure: ${cleanStderr || cleanStdout || `exit code ${result.status}`}`,
		);
	}
	console.info('Managed DB contracts passed.');
}

function cmdRunConcurrencyTest(): void {
	console.info('=== Disposable Test Environment: Concurrent Publication ===\n');
	const result = runCommand('npx', ['-y', 'tsx', 'scripts/db/publication-concurrency-test.ts']);
	console.info(result.stdout || '');
	if (result.status !== 0) {
		const cleanStderr = redactCredentials(result.stderr);
		const cleanStdout = redactCredentials(result.stdout);
		console.error('Concurrency test stderr:', cleanStderr || '(none)');
		console.error('Concurrency test stdout:', cleanStdout || '(none)');
		fail(
			`Application assertion failure: ${cleanStderr || cleanStdout || `exit code ${result.status}`}`,
		);
	}
}

function cmdRunPhase3ConcurrencyTest(): void {
	console.info('=== Disposable Test Environment: Phase 3 System Concurrency ===\n');
	const result = runCommand('npx', ['-y', 'tsx', 'scripts/db/phase3-system-concurrency-test.ts']);
	console.info(result.stdout || '');
	if (result.status !== 0) {
		const cleanStderr = redactCredentials(result.stderr);
		const cleanStdout = redactCredentials(result.stdout);
		console.error('Phase 3 concurrency stderr:', cleanStderr || '(none)');
		console.error('Phase 3 concurrency stdout:', cleanStdout || '(none)');
		fail(
			`Application assertion failure: ${cleanStderr || cleanStdout || `exit code ${result.status}`}`,
		);
	}
}

function cmdRunStaleBaselineTest(): void {
	console.info('=== Disposable Test Environment: Publication Stale Baselines ===\n');
	const result = runCommand('npx', [
		'-y',
		'tsx',
		'scripts/db/publication-stale-baseline-test.ts',
	]);
	console.info(result.stdout || '');
	if (result.status !== 0) {
		const cleanStderr = redactCredentials(result.stderr);
		const cleanStdout = redactCredentials(result.stdout);
		console.error('Stale baseline test stderr:', cleanStderr || '(none)');
		console.error('Stale baseline test stdout:', cleanStdout || '(none)');
		fail(
			`Application assertion failure: ${cleanStderr || cleanStdout || `exit code ${result.status}`}`,
		);
	}
}

function cmdStop(): void {
	console.info('=== Disposable Test Environment: Stop ===\n');

	runCommand('docker', ['rm', '-f', POSTGREST_CONTAINER], { throwOnError: false });
	const result = runCommand('docker', ['stop', DISPOSABLE_TEST.containerName], {
		throwOnError: false,
	});
	if (result.status !== 0) {
		console.warn(`docker stop warning: ${result.stderr}`);
	}
	console.info('Disposable environment stopped.');
}

function cmdCleanup(): void {
	cmdStop();

	const rmResult = runCommand('docker', ['rm', DISPOSABLE_TEST.containerName], {
		throwOnError: false,
	});
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

async function main(): Promise<void> {
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
		case 'run-rsvp-db-contracts':
			await cmdRunRsvpDbContracts();
			break;
		case 'run-managed-db-contracts':
			cmdRunManagedDbContracts();
			break;
		case 'run-application-flow':
			await cmdRunApplicationFlow();
			break;
		case 'run-concurrency-test':
			cmdRunConcurrencyTest();
			break;
		case 'run-phase3-concurrency-test':
			cmdRunPhase3ConcurrencyTest();
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

const isMainModule = process.argv[1]?.endsWith('disposable-test-env.ts');
if (isMainModule) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}
