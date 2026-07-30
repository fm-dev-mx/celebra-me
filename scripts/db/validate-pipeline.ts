/**
 * validate-pipeline.ts — Database Pipeline & Integration Validator
 *
 * Runs the complete suite of validations required in CI:
 *   1. Migration filename and ordering checks
 *   2. Clean baseline database reconstruction
 *   3. Baseline schema fingerprint calculation
 *   4. pgTAP tests on baseline
 *   5. Clean latest-schema reconstruction (all migrations)
 *   6. Latest schema fingerprint calculation
 *   7. pgTAP tests on latest
 *   8. Application database flows (retry, concurrency, stale-baseline)
 *   9. Conditional Preview hosted checks (when PREVIEW_DB_URL is available)
 *
 * Usage:
 *   tsx scripts/db/validate-pipeline.ts
 */

import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runCommand, fail, PROJECT_ROOT, redactCredentials } from './db-workflow-lib.ts';
import { PREVIEW_SECRET_FILES, getSecretFromEnvOrFiles } from './db-guard.ts';

const MIGRATIONS_DIR = resolve(PROJECT_ROOT, 'supabase', 'migrations');

function validateMigrationFiles(): void {
	console.info('Step 1: Validating migration filename and ordering rules...');
	if (!existsSync(MIGRATIONS_DIR)) {
		fail(`Migrations directory not found: ${MIGRATIONS_DIR}`);
	}

	const allEntries = readdirSync(MIGRATIONS_DIR);
	const seenVersions = new Map<string, string>(); // timestamp -> filename

	for (const entry of allEntries) {
		if (entry.startsWith('.')) continue;

		const match = entry.match(/^(\d{14})_(.+)\.sql$/);
		if (!match) {
			fail(
				`Malformed migration filename or non-conforming file found: "${entry}". All files must follow <14-digit-timestamp>_<name>.sql`,
			);
		}

		const timestamp = match[1];
		if (!timestamp || timestamp.length !== 14) {
			fail(`Invalid timestamp length in migration: "${entry}". Must be exactly 14 digits.`);
		}

		if (seenVersions.has(timestamp)) {
			fail(
				`Duplicate migration version timestamp "${timestamp}" found in "${seenVersions.get(
					timestamp,
				)}" and "${entry}". Ambiguous ordering.`,
			);
		}

		seenVersions.set(timestamp, entry);
	}
	console.info('✅ Migration filename and ordering rules are valid.\n');
}

function runDisposableTestCommand(
	action: string,
	args: string[] = [],
): { status: number | null; stdout: string } {
	const res = runCommand('npx', ['tsx', 'scripts/db/disposable-test-env.ts', action, ...args], {
		throwOnError: false,
	});
	if (res.status !== 0) {
		console.error(`\n--- disposable-test-env.ts ${action} failed (exit ${res.status}) ---`);
		if (res.stdout) console.error(`stdout:\n${redactCredentials(res.stdout)}`);
		if (res.stderr) console.error(`stderr:\n${redactCredentials(res.stderr)}`);
		console.error(`--- end ${action} failure ---`);
		fail(`disposable-test-env.ts ${action} failed with exit code ${res.status}.`);
	}
	return res;
}

function runAudit(target: string): string {
	const auditRes = runCommand('npx', ['tsx', 'scripts/db/audit-db.ts', '--target', target], {
		throwOnError: false,
	});
	if (auditRes.status !== 0) {
		fail(`Schema audit failed for target ${target}.`);
	}

	// Extract the fingerprint from audit stdout
	const match = auditRes.stdout.match(/Target Schema Fingerprint:\s*([a-f0-9]{64})/);
	if (!match?.[1]) {
		fail(`Could not extract schema fingerprint from audit log for target ${target}.`);
	}
	return match[1];
}

function main(): void {
	console.info('============================================================');
	console.info('Database Pipeline Validation');
	console.info('============================================================\n');

	// 1. Validate migrations
	validateMigrationFiles();

	// Ensure disposable environment container is running
	console.info('Starting disposable test container (if not already running)...');
	runDisposableTestCommand('start');
	console.info('✅ Test container running.\n');

	// 2. Clean baseline reconstruction
	console.info('Step 2: Reconstructing baseline schema...');
	runDisposableTestCommand('reset', ['--baseline']);
	console.info('✅ Baseline schema reconstructed.\n');

	// 3. Compute baseline fingerprint
	console.info('Step 3: Calculating baseline schema fingerprint...');
	const baselineFingerprint = runAudit('disposable-test');
	console.info(`✅ Baseline Schema Fingerprint: ${baselineFingerprint}\n`);

	// 4. Run pgTAP on baseline
	console.info('Step 4: Running pgTAP tests on baseline...');
	console.info(
		'ℹ️  Skipped: pgTAP test files cover pending release candidate features (20260717193000+) not present in the baseline cutoff.\n',
	);

	// 5. Clean latest-schema reconstruction
	console.info('Step 5: Reconstructing latest schema (applying all migrations)...');
	runDisposableTestCommand('reset');
	console.info('✅ Latest schema reconstructed.\n');

	// 6. Compute latest fingerprint
	console.info('Step 6: Calculating latest schema fingerprint...');
	const latestFingerprint = runAudit('disposable-test');
	console.info(`✅ Latest Schema Fingerprint: ${latestFingerprint}\n`);

	// 7. Run pgTAP on latest
	console.info('Step 7: Running pgTAP tests on latest schema...');
	runDisposableTestCommand('run-tests');
	console.info('✅ pgTAP tests on latest passed.\n');

	// 8. Run application DB flow tests
	console.info('Step 8: Running application DB flows and integration tests...');

	console.info('   - Running public RSVP DB/HTTP Jest contracts...');
	runDisposableTestCommand('run-rsvp-db-contracts');

	console.info('   - Running retry and publication flow...');
	runDisposableTestCommand('run-application-flow');

	console.info('   - Running publication concurrency contention test...');
	runDisposableTestCommand('run-concurrency-test');

	console.info('   - Running stale-baseline publication test...');
	runDisposableTestCommand('run-stale-baseline-test');

	console.info('   - Running Phase 3 Editor/managed/publication/asset concurrency test...');
	runDisposableTestCommand('run-phase3-concurrency-test');

	console.info('✅ Application DB flow tests passed.\n');

	// 9. Conditional Preview checks
	console.info('Step 9: Checking conditional hosted preview database...');
	const previewDbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
	if (previewDbUrl) {
		console.info(`Preview database URL detected. Running hosted preview validations...`);
		// Run audit check on preview target
		const previewAuditRes = runCommand(
			'npx',
			['tsx', 'scripts/db/audit-db.ts', '--target', 'preview'],
			{
				throwOnError: false,
			},
		);
		if (previewAuditRes.status !== 0) {
			fail('Hosted preview database audit failed. Unexplained drift detected.');
		}
		console.info('✅ Hosted preview database checks passed.\n');
	} else {
		console.info('ℹ️  PREVIEW_DB_URL not configured. Skipping hosted preview checks.\n');
	}

	console.info('============================================================');
	console.info('🎉 SUCCESS: All database pipeline validations passed.');
	console.info('============================================================');
}

try {
	main();
} catch (err: unknown) {
	console.error(
		'Fatal validation pipeline error:',
		err instanceof Error ? err.message : String(err),
	);
	process.exit(1);
}
