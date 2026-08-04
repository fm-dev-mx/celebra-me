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
 *   4b. Migration / deployment compatibility (target-release membership, rollout phases)
 *   5. Complete pre-migration critical recovery point (`.backups/prod/...`)
 *   6. External Ed25519 approval verification and durable single-use receipt consumption
 *   7. Migration application (`supabase db push --db-url <url> --yes`)
 *   8. Post-migration schema/application contract verification
 *   9. Complete post-migration critical backup (DB, Auth, Storage metadata/bytes)
 *
 * Hosted identity (fail closed):
 *   - CELEBRA_TARGET_RELEASE_SHA — authorized target release Git tree
 *   - CELEBRA_DEPLOYED_APP_SHA / CELEBRA_DEPLOYED_APP_CAPABILITIES — required for contract phases
 *
 * Current Production Status:
 *   - Hosted reconciliation state must be established by the current read-only audit.
 *   - Schema changes use versioned migrations via `supabase db push`, except the one-time
 *     receipt-table bootstrap transaction documented in docs/database-workflow.md.
 *
 * Credentials:
 *   - PROD_DB_URL env variable or PROD_SECRET_FILES (.env.production.local).
 */

import { runHostedMigrationCompatibilityGate } from './hosted-migration-compatibility-gate.ts';
import { resolveHostedMigrationIdentity } from './migration-deployment-compatibility.ts';
import { getValidatedMigrationFiles } from './apply-migrations.ts';
import {
	assertProductionDbUrl,
	consumeProductionApproval,
	fail,
	getProdDbUrl,
	redactDbUrl,
	requireProductionConfirmation,
	runCommand,
	runPsql,
} from './db-workflow-lib.ts';
import {
	bootstrapProductionMigration,
	computeMigrationManifestFingerprint,
	evaluateProductionMigrationBootstrapEligibility,
	PRODUCTION_MIGRATION_OPERATION_TYPE,
	readCanonicalMigrationFile,
	getProductionMigrationApprovalContext,
	type CanonicalMigrationFile,
} from './production-migration-bootstrap.ts';

/**
 * Production authorization inputs that must not cross the Step 2 child-process boundary.
 *
 * `runCommand` treats a supplied `env` as the complete child environment, so the workflow copies
 * the parent environment and removes only these authorization inputs. The parent `process.env`
 * remains unchanged for the target guard and the later external approval consumption. The
 * private key is included because the shared confirmation boundary rejects self-issued signing
 * material; `PROD_DB_URL` is intentionally not included because it is a connection input, not
 * authorization.
 */
export const PRODUCTION_AUTHORIZATION_ENV_KEYS = [
	'CELEBRA_PROD_APPROVAL_TOKEN',
	'CELEBRA_PROD_APPROVAL_PUBLIC_KEY',
	'CONFIRM_PROD_MIGRATION',
	'CELEBRA_PROD_AUTH_SECRET',
	'ALLOW_PROD_MIGRATE',
	'CELEBRA_PROD_APPROVAL_PRIVATE_KEY',
] as const;

export function createSanitizedValidationEnv(
	parentEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const validationEnv = { ...parentEnv };
	for (const key of PRODUCTION_AUTHORIZATION_ENV_KEYS) {
		delete validationEnv[key];
	}
	return validationEnv;
}

/** BEHIND with zero unexplained errors is the expected pre-apply Production state. */
export function isAllowlistedBehindAuditOutput(auditOutput: string, status: number): boolean {
	if (status === 0) return false;
	return (
		/Final schema lifecycle state:\s*BEHIND\b/.test(auditOutput) &&
		/Errors:\s*0\b/.test(auditOutput) &&
		!/Final schema lifecycle state:\s*SCHEMA_DRIFT\b/.test(auditOutput)
	);
}

export function runLocalValidation(runner: typeof runCommand = runCommand): void {
	const validationEnv = createSanitizedValidationEnv();
	runner('pnpm', ['type-check'], { env: validationEnv });
	runner('pnpm', ['test'], { env: validationEnv });
	runner('pnpm', ['build'], { env: validationEnv });
}

interface ProductionMigrationAuthorizationState {
	targetReleaseSha: string;
	migrationFingerprint: string;
	receiptTableExists: boolean;
	pendingMigrationFiles: readonly CanonicalMigrationFile[];
	bootstrapState: {
		target: 'production';
		receiptTableExists: boolean;
		pendingVersions: readonly string[];
		expectedVersions: readonly string[];
		appliedVersions: readonly string[];
		knownMigrationVersions: readonly string[];
	};
}

function prepareProductionMigrationAuthorization(input: {
	dbUrl: string;
	dryRunVersions: readonly string[];
	expectedVersions: readonly string[];
	appliedVersions: readonly string[];
}): ProductionMigrationAuthorizationState {
	const targetReleaseSha = resolveHostedMigrationIdentity().targetReleaseSha;
	if (!targetReleaseSha) {
		fail('Production migration requires CELEBRA_TARGET_RELEASE_SHA.');
	}
	const knownMigrationVersions = getValidatedMigrationFiles().map(({ version }) => version);
	const pendingMigrationFiles = input.dryRunVersions.map((version) =>
		readCanonicalMigrationFile(version),
	);
	const migrationFingerprint = computeMigrationManifestFingerprint(pendingMigrationFiles);
	const receiptTableResult = runPsql(
		"select to_regclass('public.production_authorization_receipts') is not null",
		input.dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	if (receiptTableResult.status !== 0) {
		fail('Unable to determine whether the Production authorization receipt table exists.');
	}
	const receiptTableOutput = receiptTableResult.stdout.trim().toLowerCase();
	if (receiptTableOutput !== 't' && receiptTableOutput !== 'f') {
		fail('Production authorization receipt table state was not an exact boolean result.');
	}
	const receiptTableExists = receiptTableOutput === 't';
	return {
		targetReleaseSha,
		migrationFingerprint,
		receiptTableExists,
		pendingMigrationFiles,
		bootstrapState: {
			target: 'production',
			receiptTableExists,
			pendingVersions: input.dryRunVersions,
			expectedVersions: input.expectedVersions,
			appliedVersions: input.appliedVersions,
			knownMigrationVersions,
		},
	};
}

async function authorizeProductionMigration(input: {
	dbUrl: string;
	hostname: string;
	authorization: ProductionMigrationAuthorizationState;
}): Promise<void> {
	console.info('6. Prompting for explicit production migration confirmation...');
	const { authorization } = input;
	const bootstrapEligibility = evaluateProductionMigrationBootstrapEligibility(
		authorization.bootstrapState,
	);
	if (authorization.receiptTableExists) {
		const context = getProductionMigrationApprovalContext({
			hostname: input.hostname,
			migrationFingerprint: authorization.migrationFingerprint,
			releaseSha: authorization.targetReleaseSha,
		});
		await requireProductionConfirmation(input.hostname, undefined, {
			operationType: PRODUCTION_MIGRATION_OPERATION_TYPE,
			scope: input.hostname,
			manifestFingerprint: authorization.migrationFingerprint,
			releaseSha: authorization.targetReleaseSha,
			operationId: context.operationId,
			consumeApproval: (payload) =>
				consumeProductionApproval({ dbUrl: input.dbUrl, payload }),
		});
		return;
	}
	if (!bootstrapEligibility.eligible) {
		fail(
			`PRODUCTION_AUTHORIZATION_FAILED [${bootstrapEligibility.reason}]: Receipt-table bootstrap is permitted only for the exact first Production authorization migration.`,
		);
	}
	const bootstrap = bootstrapProductionMigration({
		dbUrl: input.dbUrl,
		hostname: input.hostname,
		migrationFingerprint: authorization.migrationFingerprint,
		releaseSha: authorization.targetReleaseSha,
		tokenStr: process.env.CELEBRA_PROD_APPROVAL_TOKEN,
		publicKey: process.env.CELEBRA_PROD_APPROVAL_PUBLIC_KEY,
		state: authorization.bootstrapState,
		canonicalMigrationSql: authorization.pendingMigrationFiles[0]?.sql,
	});
	if (!bootstrap.bootstrapped) {
		fail(
			`PRODUCTION_AUTHORIZATION_FAILED [${bootstrap.reason ?? 'BOOTSTRAP_FAILED'}]: Approval was not durably consumed.`,
		);
	}
	console.info(
		'✅ External Production approval verified and consumed in the one-time receipt-table bootstrap transaction.\n',
	);
}

function validateDryRunAgainstAllowlist(
	dryRunVersions: readonly string[],
	expectedVersions: readonly string[],
): void {
	if (dryRunVersions.length === 0) {
		console.info('Dry-run reports no pending migrations.');
		if (expectedVersions.length > 0 && expectedVersions[0] !== 'none') {
			fail(
				`Expected migrations to apply: ${expectedVersions.join(', ')}, but dry-run shows 0 migrations.`,
			);
		}
		return;
	}

	console.info(`Pending migrations from dry-run: ${dryRunVersions.join(', ')}`);
	const expectedSet = new Set(expectedVersions);
	const dryRunSet = new Set(dryRunVersions);
	let match = true;
	for (const version of expectedVersions) {
		if (!dryRunSet.has(version)) {
			console.error(
				`❌ ERROR: Expected migration "${version}" is not in the dry-run list of pending migrations.`,
			);
			match = false;
		}
	}
	for (const version of dryRunVersions) {
		if (!expectedSet.has(version)) {
			console.error(
				`❌ ERROR: Dry-run pending migration "${version}" is not in your explicit allowlist.`,
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
	runLocalValidation();
	console.info('✅ Local codebase checks passed.\n');

	// 3. Production Schema Audit
	console.info('3. Running read-only production database audit...');
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
			'ℹ️  Production is BEHIND expected migrations (allowed before an exact allowlisted apply).\n',
		);
	} else {
		console.info('✅ Production database audit passed.\n');
	}

	// 4. Dry-run Push Check
	console.info('4. Executing migration dry-run and allowlist validation...');
	const dryRunResult = runCommand(
		'supabase',
		['db', 'push', '--db-url', prodDbUrl, '--dry-run'],
		{
			redact: [prodDbUrl],
		},
	);

	// Extract unique timestamps matching the 14-digit pattern from the dry-run output.
	// Deduping preserves first-seen order so fingerprint/bootstrap eligibility stay stable if the
	// CLI mentions the same pending version more than once.
	const dryRunOutput = `${dryRunResult.stdout}\n${dryRunResult.stderr}`;
	const dryRunVersions = [
		...new Set(
			Array.from(dryRunOutput.matchAll(/\b(\d{14})_/g)).map((match) => match[1] as string),
		),
	];

	validateDryRunAgainstAllowlist(dryRunVersions, expectedVersions);

	console.info('4b. Evaluating migration / deployment compatibility contract...');
	const appliedResult = runPsql(
		'select version from supabase_migrations.schema_migrations order by version',
		prodDbUrl,
	);
	const dbAppliedVersions = appliedResult.stdout
		.split(/\r?\n/)
		.map((v) => v.trim())
		.filter(Boolean);
	runHostedMigrationCompatibilityGate({
		target: 'production',
		candidateVersions:
			dryRunVersions.length > 0
				? dryRunVersions
				: expectedVersions.filter((v) => v !== 'none'),
		dbAppliedVersions,
		fail,
	});
	console.info('');

	const authorization = prepareProductionMigrationAuthorization({
		dbUrl: prodDbUrl,
		dryRunVersions,
		expectedVersions,
		appliedVersions: dbAppliedVersions,
	});

	// 5. Complete pre-migration recovery point. Production completed Phase 3
	// (20260729140514/20260729152113), so the standard profile applies.
	console.info('5. Creating a complete read-only pre-migration critical recovery point...');
	runCommand('npx', ['tsx', 'scripts/db/daily-critical-production-backup.ts'], {
		env: { ...process.env, PROD_DB_URL: prodDbUrl },
		redact: [prodDbUrl],
	});
	console.info('✅ Complete pre-migration critical recovery point verified.\n');

	// 6. Explicit User Confirmation
	await authorizeProductionMigration({
		dbUrl: prodDbUrl,
		hostname: target.hostname,
		authorization,
	});

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
	console.info('9. Creating the complete post-migration critical recovery set...');
	runCommand('npx', ['tsx', 'scripts/db/backup-critical-production.ts'], {
		env: { ...process.env, PROD_DB_URL: prodDbUrl },
		redact: [prodDbUrl],
	});
	console.info('✅ Complete post-migration critical recovery set verified.');
	console.info('Production migration workflow completed successfully.');
}

if (process.argv[1]?.endsWith('push-prod-migrations.ts')) {
	main().catch((error: unknown) => {
		fail(error instanceof Error ? error.message : String(error));
	});
}
