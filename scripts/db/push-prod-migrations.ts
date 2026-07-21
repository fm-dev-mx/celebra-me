/**
 * push-prod-migrations.ts — Production Migration Runner
 *
 * Applies reviewed Supabase migrations to the production database after
 * executing the mandatory safety workflow:
 *
 *   1. Target guard check (`db-guard.ts check --target production --operation migrate`)
 *   2. Local codebase validation (`pnpm type-check`, `pnpm test`, `pnpm build`)
 *   3. Production schema audit (`audit-db.ts --target production`)
 *   4. Dry-run push and allowlist matching (`--allowlist` or `EXPECTED_MIGRATIONS`)
 *   5. Automatic pre-migration backup (`.backups/prod/...`)
 *   6. Interactive user confirmation (`MIGRATE <hostname>` or `CONFIRM_PROD_MIGRATION="MIGRATE <hostname>"`)
 *   7. Migration application (`supabase db push --db-url <url> --yes`)
 *   8. Post-migration schema verification (`supabase_migrations.schema_migrations`)
 *
 * Current Production Status:
 *   - Reconciliation complete: 59/59 migrations active, 0 pending.
 *   - Direct SQL is prohibited; all schema changes must use versioned migrations.
 *
 * Credentials:
 *   - PROD_DB_URL env variable or PROD_SECRET_FILES (.env.production.local, .env.prod.local, .secrets/prod-db-url, .tmp/secrets/prod-db-url).
 */

import { resolve } from 'node:path';
import {
	assertProductionDbUrl,
	createProdBackup,
	fail,
	getProdDbUrl,
	redactDbUrl,
	requireProductionConfirmation,
	runCommand,
	runPsql,
	timestamp,
} from './db-workflow-lib.ts';

async function main(): Promise<void> {
	const { url: prodDbUrl, source } = getProdDbUrl();
	const target = assertProductionDbUrl(prodDbUrl);

	// Parse expected migrations allowlist
	const allowlistIdx = process.argv.indexOf('--allowlist');
	let allowlistStr = allowlistIdx !== -1 ? process.argv[allowlistIdx + 1] : undefined;
	if (!allowlistStr) {
		allowlistStr = process.env.EXPECTED_MIGRATIONS;
	}
	if (!allowlistStr) {
		fail(
			'Missing expected migrations allowlist. Set EXPECTED_MIGRATIONS in environment or pass --allowlist <comma-separated-versions>.',
		);
	}
	const expectedVersions = allowlistStr
		.split(/[,\s]+/)
		.map((v) => v.trim())
		.filter(Boolean);
	if (expectedVersions.length === 0) {
		fail('Expected migrations allowlist is empty.');
	}

	console.info('============================================================');
	console.info('Production Migration Workflow');
	console.info(`- PROD_DB_URL source: ${source}`);
	console.info(`- Target: ${redactDbUrl(prodDbUrl)}`);
	console.info(`- Expected Migrations Allowlist: ${expectedVersions.join(', ')}`);
	console.info('============================================================\n');

	// 1. Target Guard Check
	console.info('1. Running database target safety guard...');
	const guardResult = runCommand(
		'npx',
		[
			'tsx',
			'scripts/db/db-guard.ts',
			'check',
			'--target',
			'production',
			'--operation',
			'migrate',
		],
		{ throwOnError: false },
	);
	if (guardResult.status !== 0) {
		fail('Database guard check failed. Migration workflow aborted.');
	}
	console.info('✅ Safety guard passed.\n');

	// 2. Repository / CI Validation checks
	console.info('2. Running local codebase checks (type-check, tests, build)...');
	runCommand('pnpm', ['type-check']);
	runCommand('pnpm', ['test']);
	runCommand('pnpm', ['build']);
	console.info('✅ Local codebase checks passed.\n');

	// 3. Production Schema Audit
	console.info('3. Running read-only production database audit...');
	const auditResult = runCommand(
		'npx',
		['tsx', 'scripts/db/audit-db.ts', '--target', 'production'],
		{ throwOnError: false },
	);
	if (auditResult.status !== 0) {
		fail('Production database audit failed. Please resolve schema drift before migrating.');
	}
	console.info('✅ Production database audit passed.\n');

	// 4. Dry-run Push Check
	console.info('4. Executing migration dry-run and allowlist validation...');
	const dryRunResult = runCommand(
		'supabase',
		['db', 'push', '--db-url', prodDbUrl, '--dry-run'],
		{
			redact: [prodDbUrl],
		},
	);

	// Extract timestamps matching the 14-digit pattern from the dry-run output
	const dryRunOutput = `${dryRunResult.stdout}\n${dryRunResult.stderr}`;
	const dryRunVersions = Array.from(dryRunOutput.matchAll(/\b(\d{14})_/g)).map(
		(match) => match[1],
	);

	if (dryRunVersions.length === 0) {
		console.info('Dry-run reports no pending migrations.');
		if (expectedVersions.length > 0 && expectedVersions[0] !== 'none') {
			fail(
				`Expected migrations to apply: ${expectedVersions.join(', ')}, but dry-run shows 0 migrations.`,
			);
		}
	} else {
		console.info(`Pending migrations from dry-run: ${dryRunVersions.join(', ')}`);

		const expectedSet = new Set(expectedVersions);
		const dryRunSet = new Set(dryRunVersions);

		let match = true;
		for (const v of expectedVersions) {
			if (!dryRunSet.has(v)) {
				console.error(
					`❌ ERROR: Expected migration "${v}" is not in the dry-run list of pending migrations.`,
				);
				match = false;
			}
		}
		for (const v of dryRunVersions) {
			if (!expectedSet.has(v)) {
				console.error(
					`❌ ERROR: Dry-run pending migration "${v}" is not in your explicit allowlist.`,
				);
				match = false;
			}
		}

		if (!match) {
			fail(
				'Migration dry-run does not match the explicit expected migrations allowlist. Aborting.',
			);
		}
		console.info('✅ Dry-run matches the explicit expected migrations allowlist exactly.\n');
	}

	// 5. Database Backup
	const backupPath = resolve(
		process.cwd(),
		'.backups',
		'prod',
		`prod-public-data-before-migrations-${timestamp()}.sql`,
	);
	console.info(`5. Creating production backup before migrating: ${backupPath}`);
	createProdBackup(prodDbUrl, backupPath, false);
	console.info('✅ Production backup complete.\n');

	// 6. Explicit User Confirmation
	console.info('6. Prompting for explicit production migration confirmation...');
	await requireProductionConfirmation(target.hostname);

	// 7. DB Push execution
	console.info('7. Applying migrations to production database...');
	runCommand('supabase', ['db', 'push', '--db-url', prodDbUrl, '--yes'], { redact: [prodDbUrl] });
	console.info('✅ Migrations applied successfully.\n');

	// 8. Post-Migration Verification
	console.info('8. Running post-migration verification...');
	const verifyResult = runPsql(
		'select version from supabase_migrations.schema_migrations order by version',
		prodDbUrl,
	);
	const remoteVersions = verifyResult.stdout
		.split(/\r?\n/)
		.map((v) => v.trim())
		.filter(Boolean);

	let allApplied = true;
	for (const v of expectedVersions) {
		if (!remoteVersions.includes(v)) {
			console.error(
				`❌ ERROR: Post-migration check failed: version "${v}" is not in remote schema_migrations!`,
			);
			allApplied = false;
		}
	}

	if (!allApplied) {
		fail(
			'Post-migration verification failed. Some allowlisted migrations were not recorded in remote.',
		);
	}

	console.info('✅ Post-migration verification passed. All expected migrations are active.');
	console.info('Production migration workflow completed successfully.');
}

main().catch((error: unknown) => {
	fail(error instanceof Error ? error.message : String(error));
});
