/**
 * push-prod-migrations.ts — Production Migration Runner
 *
 * Canonical commands:
 *   pnpm db:prod:migrate -- --expected <versions>              # read-only
 *   pnpm db:prod:migrate -- --apply --expected <versions>      # owner apply
 *
 * Apply sequence:
 *   identity → audit → dry-run equals --expected → compatibility (HEAD) →
 *   verified pre-migration backup → owner summary + TTY confirmation →
 *   migration apply → history + contract verification → post-migration backup
 *
 * Release validation (`pnpm release-check`) is required before --apply and must
 * match the current clean HEAD. CELEBRA_TARGET_RELEASE_SHA is not used for Production.
 */

import { runHostedMigrationCompatibilityGate } from './hosted-migration-compatibility-gate.ts';
import {
	comparePendingSetToExpected,
	extractPendingMigrationVersions,
	parseMigrationVersionList,
} from './migration-pending-set.ts';
import { requireOwnerProductionApply } from './owner-production-apply.ts';
import {
	assertValidReleaseCheckEvidence,
	readGitWorktreeState,
} from './release-check.ts';
import {
	assertProductionDbUrl,
	fail,
	getProdDbUrl,
	redactDbUrl,
	runCommand,
	runPsql,
} from './db-workflow-lib.ts';

export const PRODUCTION_MIGRATION_OPERATION_TYPE = 'production_migration';

/** BEHIND with zero unexplained errors is the expected pre-apply Production state. */
export function isAllowlistedBehindAuditOutput(auditOutput: string, status: number): boolean {
	if (status === 0) return false;
	return (
		/Final schema lifecycle state:\s*BEHIND\b/.test(auditOutput) &&
		/Errors:\s*0\b/.test(auditOutput) &&
		!/Final schema lifecycle state:\s*SCHEMA_DRIFT\b/.test(auditOutput)
	);
}

function parseCliArgs(argv: string[]): { apply: boolean; expectedRaw: string | undefined } {
	const apply = argv.includes('--apply');
	const expectedIdx = argv.indexOf('--expected');
	const expectedRaw = expectedIdx !== -1 ? argv[expectedIdx + 1] : undefined;
	if (argv.includes('--allowlist')) {
		fail('Unsupported flag --allowlist. Use --expected <comma-separated-versions>.');
	}
	return { apply, expectedRaw };
}

function main(): void {
	const { apply, expectedRaw } = parseCliArgs(process.argv);
	if (!expectedRaw?.trim()) {
		fail(
			'Missing --expected <comma-separated-versions>. ' +
				'Usage: pnpm db:prod:migrate -- --expected <versions> ' +
				'or pnpm db:prod:migrate -- --apply --expected <versions>',
		);
	}
	const expectedVersions = parseMigrationVersionList(expectedRaw);
	if (expectedVersions.length === 0) {
		fail('Expected migrations list is empty.');
	}

	const { url: prodDbUrl, source } = getProdDbUrl();
	assertProductionDbUrl(prodDbUrl);

	console.info('============================================================');
	console.info(apply ? 'Production Migration Apply' : 'Production Migration Preflight (read-only)');
	console.info(`- PROD_DB_URL source: ${source}`);
	console.info(`- Target: ${redactDbUrl(prodDbUrl)}`);
	console.info(`- Expected migrations: ${expectedVersions.join(', ')}`);
	console.info('============================================================\n');

	console.info('1. Running read-only production database audit...');
	const auditResult = runCommand(
		'npx',
		['tsx', 'scripts/db/audit-db.ts', '--target', 'production'],
		{ throwOnError: false },
	);
	const auditOutput = `${auditResult.stdout}\n${auditResult.stderr}`;
	const behindOnly = isAllowlistedBehindAuditOutput(auditOutput, auditResult.status ?? 1);
	if (auditResult.status !== 0 && !behindOnly) {
		fail(
			'Production database audit failed. Resolve schema drift or unverified history before migrating.',
		);
	}
	if (behindOnly) {
		console.info(
			'ℹ️  Production is BEHIND expected migrations (allowed before an exact expected-set apply).\n',
		);
	} else {
		console.info('✅ Production database audit passed.\n');
	}

	console.info('2. Executing migration dry-run and expected-set validation...');
	const dryRunResult = runCommand(
		'supabase',
		['db', 'push', '--db-url', prodDbUrl, '--dry-run'],
		{ redact: [prodDbUrl] },
	);
	const dryRunOutput = `${dryRunResult.stdout}\n${dryRunResult.stderr}`;
	const dryRunVersions = extractPendingMigrationVersions(dryRunOutput);
	const pendingCompare = comparePendingSetToExpected(dryRunVersions, expectedVersions);
	if (!pendingCompare.ok) {
		for (const error of pendingCompare.errors) console.error(`❌ ERROR: ${error}`);
		fail('Migration dry-run does not match --expected. Aborting.');
	}
	if (dryRunVersions.length === 0) {
		console.info('Dry-run reports no pending migrations.');
	} else {
		console.info(`Pending migrations from dry-run: ${dryRunVersions.join(', ')}`);
	}
	console.info('✅ Dry-run matches --expected exactly.\n');

	const worktree = readGitWorktreeState();
	const releaseSha = worktree.sha;
	console.info('3. Evaluating migration / deployment compatibility (release = HEAD)...');
	const appliedResult = runPsql(
		'select version from supabase_migrations.schema_migrations order by version',
		prodDbUrl,
	);
	const dbAppliedVersions = appliedResult.stdout
		.split(/\r?\n/)
		.map((version) => version.trim())
		.filter(Boolean);
	const candidateVersions =
		dryRunVersions.length > 0
			? dryRunVersions
			: expectedVersions.filter((version) => version !== 'none');
	runHostedMigrationCompatibilityGate({
		target: 'production',
		candidateVersions,
		dbAppliedVersions,
		fail,
		targetReleaseShaOverride: releaseSha,
	});
	console.info('');

	if (!apply) {
		console.info('Read-only preflight complete. No Production write was performed.');
		console.info(
			'To apply: pnpm release-check && pnpm db:prod:migrate -- --apply --expected ' +
				expectedVersions.join(','),
		);
		return;
	}

	console.info('4. Validating release-check evidence for current clean HEAD...');
	const evidence = assertValidReleaseCheckEvidence({ worktree });
	console.info(`✅ Release evidence valid for HEAD ${evidence.sha}\n`);

	console.info('5. Creating a complete read-only pre-migration critical recovery point...');
	const backupResult = runCommand(
		'npx',
		['tsx', 'scripts/db/daily-critical-production-backup.ts'],
		{
			env: { ...process.env, PROD_DB_URL: prodDbUrl },
			redact: [prodDbUrl],
			throwOnError: false,
		},
	);
	if (backupResult.status !== 0) {
		fail(
			'PRE_MIGRATION_BACKUP_FAILED: Verified pre-migration backup is required before owner confirmation. No Production write was performed.',
		);
	}
	console.info('✅ Complete pre-migration critical recovery point verified.\n');

	requireOwnerProductionApply({
		apply: true,
		dbUrl: prodDbUrl,
		operationType: PRODUCTION_MIGRATION_OPERATION_TYPE,
		confirmationChallenge: `MIGRATE ${evidence.sha} ${expectedVersions.join(',')}`,
		summary: [
			['Mode', 'schema migration apply'],
			['Release SHA', evidence.sha],
			['Expected', expectedVersions.join(', ')],
			['Pending', dryRunVersions.length === 0 ? '(none)' : dryRunVersions.join(', ')],
		],
	});

	console.info('6. Applying migrations to production database...');
	runCommand('supabase', ['db', 'push', '--db-url', prodDbUrl, '--yes'], {
		redact: [prodDbUrl],
	});
	console.info('✅ Migrations applied successfully.\n');

	console.info('7. Running post-migration verification...');
	const verifyResult = runPsql(
		'select version from supabase_migrations.schema_migrations order by version',
		prodDbUrl,
	);
	const remoteVersions = verifyResult.stdout
		.split(/\r?\n/)
		.map((version) => version.trim())
		.filter(Boolean);
	for (const version of expectedVersions) {
		if (version === 'none') continue;
		if (!remoteVersions.includes(version)) {
			fail(
				`Post-migration check failed: version "${version}" is not in remote schema_migrations.`,
			);
		}
	}
	runCommand(
		'npx',
		['tsx', 'scripts/db/verify-mutation-schema-contract.ts', '--target', 'production'],
		{
			env: { ...process.env, PROD_DB_URL: prodDbUrl },
			redact: [prodDbUrl],
		},
	);
	console.info(
		'✅ Post-migration verification passed. Migrations and application DB contract are active.',
	);

	console.info('8. Creating the complete post-migration critical recovery set...');
	runCommand('npx', ['tsx', 'scripts/db/backup-critical-production.ts'], {
		env: { ...process.env, PROD_DB_URL: prodDbUrl },
		redact: [prodDbUrl],
	});
	console.info('✅ Complete post-migration critical recovery set verified.');
	console.info('Production migration workflow completed successfully.');
}

if (process.argv[1]?.endsWith('push-prod-migrations.ts')) {
	try {
		main();
	} catch (error: unknown) {
		fail(error instanceof Error ? error.message : String(error));
	}
}
