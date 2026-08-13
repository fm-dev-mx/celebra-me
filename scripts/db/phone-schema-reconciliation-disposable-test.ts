/**
 * Runtime contract for the phone catalog reconciliation migration.
 *
 * Runs only against the isolated disposable PostgreSQL 17 container. Each case
 * owns a fresh `public` schema so catalog transitions and rollback are observed
 * from PostgreSQL rather than inferred from migration source text.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { DISPOSABLE_DB_URL, classifyDbTarget, redactCredentials } from './db-target-config.ts';
import { runPsql, runPsqlFile, type CommandResult } from './db-workflow-lib.ts';

const MIGRATION_PATH = resolve(
	process.cwd(),
	'supabase/migrations/20260812210000_reconcile_guest_invitation_phone_objects.sql',
);

const CANONICAL_INDEX = 'idx_guest_invitations_phone';
const LEGACY_INDEX = 'idx_guest_invitations_phone_e164';
const PAIR_CONSTRAINT = 'guest_invitations_phone_country_code_pair_check';
const EXPECTED_PAIR_EXPRESSION =
	'((phone IS NULL) AND (country_code IS NULL)) OR ((phone IS NOT NULL) AND (country_code IS NOT NULL))';
const EXPECTED_PAIR_FINGERPRINT =
	'checkphoneisnullandcountry_codeisnullorphoneisnotnullandcountry_codeisnotnull';

function fail(message: string): never {
	throw new Error(message);
}

function assertDisposableTarget(): void {
	const classification = classifyDbTarget(DISPOSABLE_DB_URL);
	if (classification.target !== 'disposable-test') {
		fail(
			`Phone migration integration test requires disposable-test, received ${classification.target}: ${classification.reason}`,
		);
	}
}

function runSql(sql: string, label: string): CommandResult {
	const result = runPsql(sql, DISPOSABLE_DB_URL, { throwOnError: false });
	if (result.status !== 0) {
		fail(
			`${label} failed: ${redactCredentials(result.stderr || result.stdout || `exit ${result.status}`)}`,
		);
	}
	return result;
}

function query(sql: string, label: string): string {
	return runSql(sql, label).stdout.trim();
}

function applyMigration(): CommandResult {
	return runPsqlFile(MIGRATION_PATH, DISPOSABLE_DB_URL, { throwOnError: false });
}

function requireMigrationSuccess(result: CommandResult, scenario: string): void {
	if (result.status !== 0) {
		fail(
			`${scenario} should reconcile successfully: ${redactCredentials(result.stderr || result.stdout || `exit ${result.status}`)}`,
		);
	}
}

function requireMigrationFailure(result: CommandResult, code: string, scenario: string): void {
	const output = `${result.stdout}\n${result.stderr}`;
	if (result.status === 0 || !output.includes(code)) {
		fail(
			`${scenario} must fail closed with ${code}; received: ${redactCredentials(output || `exit ${result.status}`)}`,
		);
	}
}

function recreateFixture(setupSql = ''): void {
	runSql(
		`
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
CREATE TABLE public.guest_invitations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone text,
  country_code text
);
${setupSql}
`,
		'recreate disposable phone fixture',
	);
}

function addPairConstraint(expression = EXPECTED_PAIR_EXPRESSION): void {
	runSql(
		`ALTER TABLE public.guest_invitations ADD CONSTRAINT ${PAIR_CONSTRAINT} CHECK (${expression});`,
		'add pair constraint',
	);
}

function relationExists(name: string): boolean {
	return query(`SELECT to_regclass('public.${name}') IS NOT NULL;`, `check relation ${name}`) === 't';
}

function constraintDefinition(): string {
	return query(
		`SELECT coalesce((SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c WHERE c.conrelid = 'public.guest_invitations'::regclass AND c.conname = '${PAIR_CONSTRAINT}'), '<missing>');`,
		'read pair constraint',
	);
}

function fingerprintConstraint(definition: string): string {
	return definition
		.toLowerCase()
		.replace(/::[a-z0-9_]+/g, '')
		.replace(/[()\s]/g, '');
}

function indexDefinition(name: string): string {
	return query(
		`SELECT coalesce(pg_get_indexdef(to_regclass('public.${name}')), '<missing>');`,
		`read index ${name}`,
	);
}

function catalogSnapshot(): string {
	return [indexDefinition(CANONICAL_INDEX), indexDefinition(LEGACY_INDEX), constraintDefinition()].join(
		'\n',
	);
}

function assertCanonicalCatalog(scenario: string): string {
	const canonicalDefinition = indexDefinition(CANONICAL_INDEX);
	if (!/USING btree \(phone\)/.test(canonicalDefinition)) {
		fail(`${scenario} did not produce the canonical btree(phone) index: ${canonicalDefinition}`);
	}
	if (relationExists(LEGACY_INDEX)) {
		fail(`${scenario} retained the legacy phone index.`);
	}
	const definition = constraintDefinition();
	if (fingerprintConstraint(definition) !== EXPECTED_PAIR_FINGERPRINT) {
		fail(`${scenario} did not produce the canonical pair constraint: ${definition}`);
	}
	return catalogSnapshot();
}

function reportPass(name: string): void {
	console.info(`PASS ${name}`);
}

function testCanonicalIndexOnly(): string {
	recreateFixture(`CREATE INDEX ${CANONICAL_INDEX} ON public.guest_invitations (phone);`);
	requireMigrationSuccess(applyMigration(), 'canonical index only');
	reportPass('canonical index only plus absent constraint');
	return assertCanonicalCatalog('canonical index only');
}

function testLegacyIndexOnly(): string {
	recreateFixture(`CREATE INDEX ${LEGACY_INDEX} ON public.guest_invitations (phone);`);
	requireMigrationSuccess(applyMigration(), 'legacy index only');
	reportPass('legacy index only');
	return assertCanonicalCatalog('legacy index only');
}

function testBothCompatibleIndexes(): string {
	recreateFixture(`
CREATE INDEX ${CANONICAL_INDEX} ON public.guest_invitations (phone);
CREATE INDEX ${LEGACY_INDEX} ON public.guest_invitations (phone);
`);
	requireMigrationSuccess(applyMigration(), 'both compatible indexes');
	reportPass('both compatible indexes');
	return assertCanonicalCatalog('both compatible indexes');
}

function testConstraintPresentAndIdempotent(): void {
	recreateFixture(`CREATE INDEX ${CANONICAL_INDEX} ON public.guest_invitations (phone);`);
	addPairConstraint();
	const before = catalogSnapshot();
	requireMigrationSuccess(applyMigration(), 'already canonical catalog');
	const afterFirstRun = assertCanonicalCatalog('already canonical catalog');
	requireMigrationSuccess(applyMigration(), 'idempotent rerun');
	const afterSecondRun = assertCanonicalCatalog('idempotent rerun');
	if (before !== afterFirstRun || afterFirstRun !== afterSecondRun) {
		fail('Canonical phone catalog changed during an idempotent reconciliation rerun.');
	}
	reportPass('constraint present and idempotent rerun');
}

function testIncompatibleIndexFailsClosed(): void {
	recreateFixture(`CREATE INDEX ${CANONICAL_INDEX} ON public.guest_invitations (country_code);`);
	requireMigrationFailure(applyMigration(), 'PHONE_INDEX_INCOMPATIBLE', 'incompatible named index');
	if (!/USING btree \(country_code\)/.test(indexDefinition(CANONICAL_INDEX))) {
		fail('Incompatible index changed after a rejected reconciliation.');
	}
	if (constraintDefinition() !== '<missing>') {
		fail('Rejected incompatible index added a pair constraint.');
	}
	reportPass('incompatible index fails closed');
}

function testDifferentColumnIndexFailsClosed(): void {
	recreateFixture('CREATE INDEX idx_guest_invitations_country_code ON public.guest_invitations (country_code);');
	requireMigrationFailure(
		applyMigration(),
		'PHONE_RECONCILE_UNSUPPORTED',
		'index on a different column',
	);
	if (!relationExists('idx_guest_invitations_country_code') || constraintDefinition() !== '<missing>') {
		fail('Unsupported different-column catalog mutated after failure.');
	}
	reportPass('index on a different column fails closed');
}

function testFailureRollsBackRename(): void {
	recreateFixture(`CREATE INDEX ${LEGACY_INDEX} ON public.guest_invitations (phone);`);
	addPairConstraint('phone IS NOT NULL');
	requireMigrationFailure(
		applyMigration(),
		'PHONE_CHECK_INCOMPATIBLE',
		'incompatible check after legacy rename candidate',
	);
	if (!relationExists(LEGACY_INDEX) || relationExists(CANONICAL_INDEX)) {
		fail('Rejected reconciliation did not roll back the legacy index rename.');
	}
	if (!/CHECK \(\(phone IS NOT NULL\)\)/.test(constraintDefinition())) {
		fail('Rejected reconciliation changed the incompatible pair constraint.');
	}
	reportPass('failure rolls back prior catalog mutation');
}

function main(): void {
	assertDisposableTarget();
	if (!existsSync(MIGRATION_PATH)) fail(`Migration file not found: ${MIGRATION_PATH}`);

	const supportedStates = [testCanonicalIndexOnly(), testLegacyIndexOnly(), testBothCompatibleIndexes()];
	if (new Set(supportedStates).size !== 1) {
		fail('Supported phone catalog starting states did not converge to one canonical catalog state.');
	}
	testConstraintPresentAndIdempotent();
	testIncompatibleIndexFailsClosed();
	testDifferentColumnIndexFailsClosed();
	testFailureRollsBackRename();
	console.info('Phone schema reconciliation disposable integration: PASS');
}

main();
