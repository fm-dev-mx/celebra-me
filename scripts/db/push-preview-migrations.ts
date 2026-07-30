/**
 * push-preview-migrations.ts — Preview Database Migration Runner
 *
 * Applies pending Supabase migrations to the Preview database after:
 *   1. Credential resolution (PREVIEW_DB_URL)
 *   2. Dry-run + optional allowlist matching (EXPECTED_MIGRATIONS / --allowlist)
 *   3. Migration / deployment compatibility (target-release membership, rollout phases)
 *   4. Migration application
 *   5. Mutation schema contract verification
 *
 * Hosted identity (fail closed):
 *   - CELEBRA_TARGET_RELEASE_SHA — authorized target release Git tree
 *   - CELEBRA_DEPLOYED_APP_SHA / CELEBRA_DEPLOYED_APP_CAPABILITIES — required for contract phases
 *
 * Privacy & Isolation:
 *   - Preview must use isolated synthetic test data.
 *   - Production customer data must NEVER be copied into Preview.
 */

import { runHostedMigrationCompatibilityGate } from './hosted-migration-compatibility-gate.ts';
import { PREVIEW_SECRET_FILES, getSecretFromEnvOrFiles } from './db-guard.ts';
import { fail, runCommand, runPsql } from './db-workflow-lib.ts';

function parseAllowlist(): string[] | null {
	const allowlistIdx = process.argv.indexOf('--allowlist');
	let allowlistStr = allowlistIdx !== -1 ? process.argv[allowlistIdx + 1] : undefined;
	if (!allowlistStr) {
		allowlistStr = process.env.EXPECTED_MIGRATIONS;
	}
	if (!allowlistStr) return null;
	const versions = allowlistStr
		.split(/[,\s]+/)
		.map((v) => v.trim())
		.filter(Boolean);
	return versions.length > 0 ? versions : null;
}

function main(): void {
	const previewDbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
	if (!previewDbUrl) {
		fail(
			'PREVIEW_DB_URL is not configured. Set PREVIEW_DB_URL in environment or secret files.',
		);
	}

	const expectedVersions = parseAllowlist();

	console.info('============================================================');
	console.info('Preview Migration Workflow');
	console.info(
		`- Expected Migrations Allowlist: ${expectedVersions ? expectedVersions.join(', ') : '(dry-run pending set)'}`,
	);
	console.info('============================================================\n');

	console.info('1. Executing migration dry-run...');
	const dryRunResult = runCommand(
		'supabase',
		['db', 'push', '--db-url', previewDbUrl, '--dry-run'],
		{ redact: [previewDbUrl] },
	);
	const dryRunOutput = `${dryRunResult.stdout}\n${dryRunResult.stderr}`;
	const dryRunVersions = Array.from(dryRunOutput.matchAll(/\b(\d{14})_/g)).map(
		(match) => match[1],
	);

	if (dryRunVersions.length === 0) {
		console.info('Dry-run reports no pending migrations.');
		if (expectedVersions && expectedVersions[0] !== 'none') {
			fail(
				`Expected migrations to apply: ${expectedVersions.join(', ')}, but dry-run shows 0 migrations.`,
			);
		}
	} else {
		console.info(`Pending migrations from dry-run: ${dryRunVersions.join(', ')}`);
		if (expectedVersions) {
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
			console.info('✅ Dry-run matches the explicit expected migrations allowlist exactly.');
		}
	}

	const candidateVersions =
		dryRunVersions.length > 0
			? dryRunVersions
			: (expectedVersions ?? []).filter((v) => v !== 'none');

	console.info('\n2. Evaluating migration / deployment compatibility contract...');
	const appliedResult = runPsql(
		'select version from supabase_migrations.schema_migrations order by version',
		previewDbUrl,
	);
	const dbAppliedVersions = appliedResult.stdout
		.split(/\r?\n/)
		.map((v) => v.trim())
		.filter(Boolean);
	runHostedMigrationCompatibilityGate({
		target: 'preview',
		candidateVersions,
		dbAppliedVersions,
		fail,
	});

	if (candidateVersions.length === 0) {
		console.info('No pending Preview migrations to apply.');
		console.info(
			'Verifying the application mutation schema contract before Preview code deployment...',
		);
		runCommand('npx', [
			'tsx',
			'scripts/db/verify-mutation-schema-contract.ts',
			'--target',
			'preview',
		]);
		console.info('✅ Preview mutation contract verification complete (no pending migrations).');
		return;
	}

	console.info('\n3. Applying pending migrations to preview database...');
	const result = runCommand('supabase', ['db', 'push', '--db-url', previewDbUrl, '--yes'], {
		redact: [previewDbUrl],
		throwOnError: false,
	});

	if (result.status !== 0) {
		fail(`Preview migration failed with exit code ${result.status}.`);
	}

	const verifyResult = runPsql(
		'select version from supabase_migrations.schema_migrations order by version',
		previewDbUrl,
	);
	const remoteVersions = new Set(
		verifyResult.stdout
			.split(/\r?\n/)
			.map((v) => v.trim())
			.filter(Boolean),
	);
	for (const version of candidateVersions) {
		if (!remoteVersions.has(version)) {
			fail(
				`Post-migration check failed: version "${version}" is not in Preview schema_migrations.`,
			);
		}
	}

	console.info(
		'4. Verifying the application mutation schema contract before Preview code deployment...',
	);
	runCommand('npx', [
		'tsx',
		'scripts/db/verify-mutation-schema-contract.ts',
		'--target',
		'preview',
	]);
	console.info('✅ Preview migration and mutation contract verification complete.');
}

try {
	main();
} catch (err: unknown) {
	fail(err instanceof Error ? err.message : String(err));
}
