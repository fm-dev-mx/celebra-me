import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	PROJECT_ROOT,
	deriveProductionOperationId,
	getProductionApprovalTokenPayload,
	isSupabaseProductionHostname,
	productionAuthorizationBoundaryReason,
	runPsql,
	sqlLiteral,
	verifyProductionApprovalToken,
	type CommandResult,
	type ProductionApprovalContext,
	type ProductionApprovalTokenPayload,
} from './db-workflow-lib.ts';

export const PRODUCTION_AUTHORIZATION_RECEIPTS_MIGRATION_VERSION = '20260802090000';
export const PRODUCTION_MIGRATION_OPERATION_TYPE = 'production_migration';

export interface CanonicalMigrationFile {
	version: string;
	filename: string;
	sql: string;
}

export function readCanonicalMigrationFile(
	version: string,
	projectRoot = PROJECT_ROOT,
): CanonicalMigrationFile {
	const migrationsDirectory = resolve(projectRoot, 'supabase', 'migrations');
	const filename = readdirSync(migrationsDirectory).find(
		(entry) => entry.startsWith(`${version}_`) && entry.endsWith('.sql'),
	);
	if (!filename) throw new Error(`Canonical migration file is missing for version ${version}.`);
	return {
		version,
		filename,
		sql: readFileSync(resolve(migrationsDirectory, filename), 'utf8'),
	};
}

export function computeMigrationManifestFingerprint(
	migrations: readonly CanonicalMigrationFile[],
): string {
	const canonical = [...migrations]
		.sort((left, right) => left.version.localeCompare(right.version))
		.map((migration) => `${migration.version}\u001f${migration.filename}\u001f${migration.sql}`)
		.join('\u001e');
	return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function getProductionMigrationApprovalContext(input: {
	hostname: string;
	migrationFingerprint: string;
	releaseSha: string;
}): ProductionApprovalContext {
	const context = {
		operationType: PRODUCTION_MIGRATION_OPERATION_TYPE,
		targetEnv: 'production' as const,
		scope: input.hostname,
		manifestFingerprint: input.migrationFingerprint,
		releaseSha: input.releaseSha,
	};
	return {
		...context,
		operationId: deriveProductionOperationId(context),
	};
}

export interface ProductionMigrationBootstrapState {
	readonly target: string;
	readonly receiptTableExists: boolean;
	readonly pendingVersions: readonly string[];
	readonly expectedVersions: readonly string[];
	readonly appliedVersions: readonly string[];
	readonly knownMigrationVersions?: readonly string[];
}

export type ProductionMigrationBootstrapEligibility =
	{ eligible: true } | { eligible: false; reason: string };

function exactVersionSet(actual: readonly string[], expected: readonly string[]): boolean {
	const actualSet = new Set(actual.map((version) => version.trim()).filter(Boolean));
	const expectedSet = new Set(expected.map((version) => version.trim()).filter(Boolean));
	return (
		actual.length === actualSet.size &&
		expected.length === expectedSet.size &&
		actualSet.size === expectedSet.size &&
		[...actualSet].every((version) => expectedSet.has(version))
	);
}

export function evaluateProductionMigrationBootstrapEligibility(
	state: ProductionMigrationBootstrapState,
): ProductionMigrationBootstrapEligibility {
	if (state.target !== 'production') {
		return { eligible: false, reason: 'PRODUCTION_BOOTSTRAP_TARGET_REQUIRED' };
	}
	if (state.receiptTableExists) {
		return { eligible: false, reason: 'RECEIPT_TABLE_PRESENT' };
	}
	if (
		!exactVersionSet(state.expectedVersions, [
			PRODUCTION_AUTHORIZATION_RECEIPTS_MIGRATION_VERSION,
		])
	) {
		return { eligible: false, reason: 'BOOTSTRAP_ALLOWLIST_MUST_MATCH_EXACT_MIGRATION' };
	}
	if (
		!exactVersionSet(state.pendingVersions, [
			PRODUCTION_AUTHORIZATION_RECEIPTS_MIGRATION_VERSION,
		])
	) {
		return { eligible: false, reason: 'BOOTSTRAP_PENDING_SET_MUST_MATCH_EXACT_MIGRATION' };
	}
	if (state.appliedVersions.includes(PRODUCTION_AUTHORIZATION_RECEIPTS_MIGRATION_VERSION)) {
		return { eligible: false, reason: 'BOOTSTRAP_MIGRATION_ALREADY_APPLIED' };
	}
	if (new Set(state.appliedVersions).size !== state.appliedVersions.length) {
		return { eligible: false, reason: 'BOOTSTRAP_MIGRATION_STATE_DUPLICATED' };
	}
	if (state.knownMigrationVersions) {
		const known = new Set(state.knownMigrationVersions);
		const unexpected = state.appliedVersions.filter((version) => !known.has(version));
		if (unexpected.length > 0) {
			return { eligible: false, reason: 'BOOTSTRAP_MIGRATION_STATE_UNEXPECTED' };
		}
	}
	return { eligible: true };
}

export function buildProductionMigrationBootstrapSql(input: {
	canonicalMigrationSql: string;
	payload: ProductionApprovalTokenPayload;
}): string {
	const expiresAt = `to_timestamp(${input.payload.expiresAt} / 1000.0)`;
	return [
		'BEGIN;',
		'SELECT pg_advisory_xact_lock(20260802, 90000);',
		`DO $$
BEGIN
  IF to_regclass('public.production_authorization_receipts') IS NOT NULL THEN
    RAISE EXCEPTION 'PRODUCTION_BOOTSTRAP_RECEIPT_TABLE_PRESENT';
  END IF;
END
$$;`,
		input.canonicalMigrationSql.trim(),
		`DO $$
BEGIN
  IF ${expiresAt} <= clock_timestamp() THEN
    RAISE EXCEPTION 'PRODUCTION_BOOTSTRAP_APPROVAL_EXPIRED';
  END IF;
END
$$;`,
		`INSERT INTO public.production_authorization_receipts
  (operation_id, nonce, operation_type, target_env, scope, manifest_fingerprint, expires_at)
VALUES
  (${sqlLiteral(input.payload.operationId)},
   ${sqlLiteral(input.payload.nonce)},
   ${sqlLiteral(input.payload.operationType)},
   ${sqlLiteral(input.payload.targetEnv)},
   ${sqlLiteral(input.payload.scope)},
   ${sqlLiteral(input.payload.manifestFingerprint)},
   ${expiresAt})
RETURNING operation_id;`,
		'COMMIT;',
	].join('\n\n');
}

export interface ProductionMigrationBootstrapInput {
	dbUrl: string;
	hostname: string;
	migrationFingerprint: string;
	releaseSha: string;
	tokenStr: string | undefined;
	publicKey: string | undefined;
	nowMs?: number;
	state: ProductionMigrationBootstrapState;
	canonicalMigrationSql?: string;
	runPsql?: (
		sql: string,
		dbUrl: string,
		options: { tuplesOnly: boolean; throwOnError: boolean },
	) => CommandResult;
}

export interface ProductionMigrationBootstrapResult {
	bootstrapped: boolean;
	reason?: string;
	payload?: ProductionApprovalTokenPayload;
}

function isProductionDatabaseUrl(dbUrl: string): boolean {
	try {
		return isSupabaseProductionHostname(new URL(dbUrl).hostname);
	} catch {
		return false;
	}
}

export function bootstrapProductionMigration(
	input: ProductionMigrationBootstrapInput,
): ProductionMigrationBootstrapResult {
	const boundaryReason = productionAuthorizationBoundaryReason();
	if (boundaryReason) return { bootstrapped: false, reason: boundaryReason };
	if (!isProductionDatabaseUrl(input.dbUrl)) {
		return { bootstrapped: false, reason: 'PRODUCTION_BOOTSTRAP_TARGET_REQUIRED' };
	}

	const eligibility = evaluateProductionMigrationBootstrapEligibility(input.state);
	if (!eligibility.eligible) return { bootstrapped: false, reason: eligibility.reason };

	const expectedContext = getProductionMigrationApprovalContext({
		hostname: input.hostname,
		migrationFingerprint: input.migrationFingerprint,
		releaseSha: input.releaseSha,
	});
	const verification = verifyProductionApprovalToken({
		tokenStr: input.tokenStr,
		publicKey: input.publicKey,
		expectedContext,
		nowMs: input.nowMs,
	});
	if (!verification.valid) {
		return { bootstrapped: false, reason: verification.reason ?? 'INVALID_APPROVAL_TOKEN' };
	}

	const payload = getProductionApprovalTokenPayload(input.tokenStr);
	if (!payload) return { bootstrapped: false, reason: 'MALFORMED_APPROVAL_TOKEN' };

	const canonicalMigrationSql =
		input.canonicalMigrationSql ??
		readCanonicalMigrationFile(PRODUCTION_AUTHORIZATION_RECEIPTS_MIGRATION_VERSION).sql;
	const result = (input.runPsql ?? runPsql)(
		buildProductionMigrationBootstrapSql({ canonicalMigrationSql, payload }),
		input.dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	if (result.status !== 0) {
		return { bootstrapped: false, reason: 'BOOTSTRAP_TRANSACTION_FAILED' };
	}
	const returnedRows = result.stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	if (!returnedRows.includes(payload.operationId)) {
		return { bootstrapped: false, reason: 'BOOTSTRAP_RECEIPT_NOT_CONSUMED' };
	}
	return { bootstrapped: true, payload };
}
