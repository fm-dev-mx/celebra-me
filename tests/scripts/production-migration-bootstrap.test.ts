import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
	consumeProductionApproval,
	serializeProductionApprovalPayload,
	type ProductionApprovalTokenPayload,
} from '../../scripts/db/db-workflow-lib.ts';
import {
	bootstrapProductionMigration,
	computeMigrationManifestFingerprint,
	evaluateProductionMigrationBootstrapEligibility,
	getProductionMigrationApprovalContext,
	PRODUCTION_AUTHORIZATION_RECEIPTS_MIGRATION_VERSION,
	readCanonicalMigrationFile,
	type ProductionMigrationBootstrapInput,
	type ProductionMigrationBootstrapState,
} from '../../scripts/db/production-migration-bootstrap.ts';

const originalEnv = { ...process.env };
const keyPair = generateKeyPairSync('ed25519');
const otherKeyPair = generateKeyPairSync('ed25519');
const publicKey = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const hostname = 'production-test-host';
const releaseSha = 'abc1234';
const migration = readCanonicalMigrationFile(PRODUCTION_AUTHORIZATION_RECEIPTS_MIGRATION_VERSION);
const migrationFingerprint = computeMigrationManifestFingerprint([migration]);
const baseState: ProductionMigrationBootstrapState = {
	target: 'production',
	receiptTableExists: false,
	pendingVersions: [PRODUCTION_AUTHORIZATION_RECEIPTS_MIGRATION_VERSION],
	expectedVersions: [PRODUCTION_AUTHORIZATION_RECEIPTS_MIGRATION_VERSION],
	appliedVersions: ['20260730220544'],
};
type PsqlRunner = NonNullable<ProductionMigrationBootstrapInput['runPsql']>;
type PsqlMock = jest.MockedFunction<PsqlRunner>;

function createApprovalToken(
	overrides: Partial<ProductionApprovalTokenPayload> = {},
	privateKey: KeyObject = keyPair.privateKey,
): { encoded: string; payload: ProductionApprovalTokenPayload } {
	const context = getProductionMigrationApprovalContext({
		hostname,
		migrationFingerprint,
		releaseSha,
	});
	const payload: ProductionApprovalTokenPayload = {
		...context,
		expiresAt: Date.now() + 60_000,
		nonce: 'bootstrap-nonce',
		...overrides,
	};
	const signature = sign(
		null,
		Buffer.from(serializeProductionApprovalPayload(payload), 'utf8'),
		privateKey,
	).toString('base64url');
	return {
		encoded: Buffer.from(
			JSON.stringify({ version: 1, algorithm: 'Ed25519', payload, signature }),
			'utf8',
		).toString('base64url'),
		payload,
	};
}

function bootstrapInput(
	token: ReturnType<typeof createApprovalToken> = createApprovalToken(),
	state: ProductionMigrationBootstrapState = baseState,
	runPsql: PsqlMock = jest.fn(() => ({
		status: 0,
		stdout: `${token.payload.operationId}\n`,
		stderr: '',
	})),
) {
	return {
		dbUrl: 'postgresql://production@project.supabase.co/db',
		hostname,
		migrationFingerprint,
		releaseSha,
		tokenStr: token.encoded,
		publicKey,
		state,
		canonicalMigrationSql: migration.sql,
		runPsql,
	};
}

beforeEach(() => {
	process.env = { ...originalEnv };
	delete process.env.CELEBRA_AGENT_CONTEXT;
	delete process.env.CELEBRA_PROD_AUTH_SECRET;
	delete process.env.CELEBRA_PROD_APPROVAL_PRIVATE_KEY;
});

afterEach(() => {
	process.env = originalEnv;
	jest.restoreAllMocks();
});

describe('Production authorization migration bootstrap', () => {
	it('bootstraps the canonical receipt table and consumes the approval in one transaction', () => {
		const token = createApprovalToken();
		const runPsql = jest.fn(() => ({
			status: 0,
			stdout: `${token.payload.operationId}\n`,
			stderr: '',
		})) as PsqlMock;

		const result = bootstrapProductionMigration(bootstrapInput(token, baseState, runPsql));

		expect(result).toEqual({ bootstrapped: true, payload: token.payload });
		expect(runPsql).toHaveBeenCalledTimes(1);
		const sql = runPsql.mock.calls[0]?.[0] ?? '';
		expect(sql).toContain('BEGIN;');
		expect(sql).toContain('SELECT pg_advisory_xact_lock(20260802, 90000);');
		expect(sql).toContain(
			'CREATE TABLE IF NOT EXISTS public.production_authorization_receipts',
		);
		expect(sql).toContain('COMMENT ON TABLE public.production_authorization_receipts');
		expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
		expect(sql).toContain('REVOKE ALL ON TABLE public.production_authorization_receipts');
		expect(sql).toContain(`'${token.payload.operationId}'`);
		expect(sql).toContain('RETURNING operation_id;');
		expect(sql).toContain('COMMIT;');
	});

	it('uses the normal durable receipt path when the table already exists', () => {
		const eligibility = evaluateProductionMigrationBootstrapEligibility({
			...baseState,
			receiptTableExists: true,
		});
		expect(eligibility).toEqual({ eligible: false, reason: 'RECEIPT_TABLE_PRESENT' });

		const payload = createApprovalToken().payload;
		const runPsql = jest.fn(() => ({
			status: 0,
			stdout: `${payload.operationId}\n`,
			stderr: '',
		})) as PsqlMock;
		expect(
			consumeProductionApproval({
				dbUrl: 'postgresql://production@project.supabase.co/db',
				payload,
				runPsql,
			}),
		).toEqual({ consumed: true });
		expect(runPsql.mock.calls[0]?.[0]).toContain('ON CONFLICT DO NOTHING');
	});

	it('disables bootstrap before any database call when the ledger already exists', () => {
		const runPsql = jest.fn(() => ({ status: 0, stdout: '', stderr: '' })) as PsqlMock;
		const result = bootstrapProductionMigration(
			bootstrapInput(
				createApprovalToken(),
				{ ...baseState, receiptTableExists: true },
				runPsql,
			),
		);

		expect(result).toEqual({ bootstrapped: false, reason: 'RECEIPT_TABLE_PRESENT' });
		expect(runPsql).not.toHaveBeenCalled();
	});

	it('rejects replayed operation IDs and nonces through the normal ledger path', () => {
		const payload = createApprovalToken().payload;
		const runPsql = jest.fn(() => ({ status: 0, stdout: '', stderr: '' })) as PsqlMock;

		expect(
			consumeProductionApproval({
				dbUrl: 'postgresql://production@project.supabase.co/db',
				payload,
				runPsql,
			}),
		).toEqual({ consumed: false, reason: 'REPLAYED_APPROVAL' });
		const sql = runPsql.mock.calls[0]?.[0] ?? '';
		expect(sql).toContain(payload.operationId);
		expect(sql).toContain(payload.nonce);
	});

	it.each([
		['invalid signature', {}, otherKeyPair.privateKey, 'INVALID_SIGNATURE'],
		[
			'expired token',
			{ expiresAt: Date.now() - 1 },
			keyPair.privateKey,
			'EXPIRED_APPROVAL_TOKEN',
		],
		['hostname mismatch', { scope: 'other-host' }, keyPair.privateKey, 'SCOPE_MISMATCH'],
		[
			'operation mismatch',
			{ operationType: 'production_patch' },
			keyPair.privateKey,
			'OPERATION_TYPE_MISMATCH',
		],
		[
			'fingerprint mismatch',
			{ manifestFingerprint: 'other-fingerprint' },
			keyPair.privateKey,
			'MANIFEST_FINGERPRINT_MISMATCH',
		],
		[
			'release SHA mismatch',
			{ releaseSha: 'def5678' },
			keyPair.privateKey,
			'RELEASE_SHA_MISMATCH',
		],
		[
			'operation ID mismatch',
			{ operationId: 'wrong-operation-id' },
			keyPair.privateKey,
			'OPERATION_ID_MISMATCH',
		],
	] as const)('%s produces no database call', (_name, overrides, signingKey, reason) => {
		const token = createApprovalToken(overrides, signingKey);
		const runPsql = jest.fn(() => ({ status: 0, stdout: '', stderr: '' })) as PsqlMock;
		const result = bootstrapProductionMigration(bootstrapInput(token, baseState, runPsql));

		expect(result).toEqual({ bootstrapped: false, reason });
		expect(runPsql).not.toHaveBeenCalled();
	});

	it.each([
		['non-production target', { target: 'preview' }, 'PRODUCTION_BOOTSTRAP_TARGET_REQUIRED'],
		[
			'unexpected pending migration',
			{ pendingVersions: ['20260730101500', ...baseState.pendingVersions] },
			'BOOTSTRAP_PENDING_SET_MUST_MATCH_EXACT_MIGRATION',
		],
		[
			'migration not pending',
			{ pendingVersions: [] },
			'BOOTSTRAP_PENDING_SET_MUST_MATCH_EXACT_MIGRATION',
		],
		[
			'unexpected allowlist entry',
			{ expectedVersions: ['20260730101500', ...baseState.expectedVersions] },
			'BOOTSTRAP_ALLOWLIST_MUST_MATCH_EXACT_MIGRATION',
		],
		[
			'migration already applied',
			{
				appliedVersions: [
					...baseState.appliedVersions,
					PRODUCTION_AUTHORIZATION_RECEIPTS_MIGRATION_VERSION,
				],
			},
			'BOOTSTRAP_MIGRATION_ALREADY_APPLIED',
		],
		[
			'unexpected applied migration',
			{
				knownMigrationVersions: baseState.appliedVersions,
				appliedVersions: [...baseState.appliedVersions, '20990101000000'],
			},
			'BOOTSTRAP_MIGRATION_STATE_UNEXPECTED',
		],
	] as const)('%s fails closed before token consumption', (_name, state, reason) => {
		const runPsql = jest.fn(() => ({ status: 0, stdout: '', stderr: '' })) as PsqlMock;
		const result = bootstrapProductionMigration(
			bootstrapInput(createApprovalToken(), { ...baseState, ...state }, runPsql),
		);

		expect(result).toEqual({ bootstrapped: false, reason });
		expect(runPsql).not.toHaveBeenCalled();
	});

	it('rolls back the transaction when canonical creation or receipt insertion fails', () => {
		const token = createApprovalToken();
		const runPsql = jest.fn(() => ({
			status: 1,
			stdout: '',
			stderr: 'simulated failure',
		})) as PsqlMock;

		const result = bootstrapProductionMigration(bootstrapInput(token, baseState, runPsql));

		expect(result).toEqual({ bootstrapped: false, reason: 'BOOTSTRAP_TRANSACTION_FAILED' });
		expect(runPsql).toHaveBeenCalledTimes(1);
		expect(runPsql.mock.calls[0]?.[0]).toMatch(/^BEGIN;[\s\S]*COMMIT;$/);
	});

	it.each([
		['agent context', 'CELEBRA_AGENT_CONTEXT', 'true'],
		['runtime signing secret', 'CELEBRA_PROD_AUTH_SECRET', 'self-issued'],
		['runtime private key', 'CELEBRA_PROD_APPROVAL_PRIVATE_KEY', 'private-key'],
	] as const)('rejects %s before any database write', (_name, key, value) => {
		process.env[key] = value;
		const runPsql = jest.fn(() => ({ status: 0, stdout: '', stderr: '' })) as PsqlMock;

		const result = bootstrapProductionMigration(
			bootstrapInput(createApprovalToken(), baseState, runPsql),
		);

		expect(result.bootstrapped).toBe(false);
		expect(result.reason).toMatch(
			/AGENT_SELF_AUTHORIZATION_BLOCKED|SELF_ISSUED_APPROVAL_REJECTED/,
		);
		expect(runPsql).not.toHaveBeenCalled();
	});

	it('keeps the migration definition mechanically coupled to the fingerprint', () => {
		expect(computeMigrationManifestFingerprint([migration])).toMatch(/^[0-9a-f]{64}$/);
		expect(migration.sql).toContain(
			'CREATE TABLE IF NOT EXISTS public.production_authorization_receipts',
		);
		expect(migration.sql).toContain(
			"target_env text NOT NULL CHECK (target_env = 'production')",
		);
		expect(migration.sql).toContain('nonce text NOT NULL UNIQUE');
	});
});
