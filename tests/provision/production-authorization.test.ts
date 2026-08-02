import { afterEach, describe, expect, it } from '@jest/globals';
import {
	confirmProductionAction,
	createProductionApprovalToken,
	verifyProductionApprovalToken,
} from '../../scripts/db/db-workflow-lib.ts';

const originalEnv = { ...process.env };

afterEach(() => {
	for (const key of Object.keys(process.env)) {
		if (!(key in originalEnv)) delete process.env[key];
	}
	Object.assign(process.env, originalEnv);
});

const TARGET = 'production-test-host';
const CHALLENGE = 'PROMOTE fixture-slug aaaa1111';
const SECRET = 'operator-secret-key-12345';

describe('external cryptographic approval token boundary', () => {
	it('creates and verifies a valid production approval token', () => {
		const token = createProductionApprovalToken(
			{
				operationType: 'promotion',
				targetEnv: 'production',
				scope: 'abril-michelle-becerra-rea',
				manifestFingerprint: 'manifest-sha-123',
				expiresAt: Date.now() + 60000,
				nonce: 'nonce-1',
			},
			SECRET,
		);

		const result = verifyProductionApprovalToken({
			tokenStr: token,
			secret: SECRET,
			expectedContext: {
				operationType: 'promotion',
				targetEnv: 'production',
				scope: 'abril-michelle-becerra-rea',
				manifestFingerprint: 'manifest-sha-123',
			},
		});

		expect(result.valid).toBe(true);
	});

	it('rejects an expired token', () => {
		const token = createProductionApprovalToken(
			{
				operationType: 'promotion',
				targetEnv: 'production',
				scope: 'abril-michelle-becerra-rea',
				manifestFingerprint: 'manifest-sha-123',
				expiresAt: Date.now() - 1000,
				nonce: 'nonce-2',
			},
			SECRET,
		);

		const result = verifyProductionApprovalToken({
			tokenStr: token,
			secret: SECRET,
			expectedContext: {
				operationType: 'promotion',
				targetEnv: 'production',
				scope: 'abril-michelle-becerra-rea',
				manifestFingerprint: 'manifest-sha-123',
			},
		});

		expect(result.valid).toBe(false);
		expect(result.reason).toBe('EXPIRED_APPROVAL_TOKEN');
	});

	it('rejects a token with an invalid signature (self-generated without secret)', () => {
		const token = createProductionApprovalToken(
			{
				operationType: 'promotion',
				targetEnv: 'production',
				scope: 'abril-michelle-becerra-rea',
				manifestFingerprint: 'manifest-sha-123',
				expiresAt: Date.now() + 60000,
				nonce: 'nonce-3',
			},
			'wrong-secret-key',
		);

		const result = verifyProductionApprovalToken({
			tokenStr: token,
			secret: SECRET,
			expectedContext: {
				operationType: 'promotion',
				targetEnv: 'production',
				scope: 'abril-michelle-becerra-rea',
				manifestFingerprint: 'manifest-sha-123',
			},
		});

		expect(result.valid).toBe(false);
		expect(result.reason).toBe('INVALID_SIGNATURE');
	});

	it('rejects token when scope mismatched', () => {
		const token = createProductionApprovalToken(
			{
				operationType: 'promotion',
				targetEnv: 'production',
				scope: 'romina-rios-chaparro',
				manifestFingerprint: 'manifest-sha-123',
				expiresAt: Date.now() + 60000,
				nonce: 'nonce-4',
			},
			SECRET,
		);

		const result = verifyProductionApprovalToken({
			tokenStr: token,
			secret: SECRET,
			expectedContext: {
				operationType: 'promotion',
				targetEnv: 'production',
				scope: 'abril-michelle-becerra-rea',
				manifestFingerprint: 'manifest-sha-123',
			},
		});

		expect(result.valid).toBe(false);
		expect(result.reason).toBe('SCOPE_MISMATCH');
	});

	it('rejects token when manifest fingerprint mismatched', () => {
		const token = createProductionApprovalToken(
			{
				operationType: 'promotion',
				targetEnv: 'production',
				scope: 'abril-michelle-becerra-rea',
				manifestFingerprint: 'manifest-sha-different',
				expiresAt: Date.now() + 60000,
				nonce: 'nonce-5',
			},
			SECRET,
		);

		const result = verifyProductionApprovalToken({
			tokenStr: token,
			secret: SECRET,
			expectedContext: {
				operationType: 'promotion',
				targetEnv: 'production',
				scope: 'abril-michelle-becerra-rea',
				manifestFingerprint: 'manifest-sha-123',
			},
		});

		expect(result.valid).toBe(false);
		expect(result.reason).toBe('MANIFEST_FINGERPRINT_MISMATCH');
	});

	it('rejects malformed token string', () => {
		const result = verifyProductionApprovalToken({
			tokenStr: 'not-a-valid-token-json',
			secret: SECRET,
			expectedContext: {
				operationType: 'promotion',
				targetEnv: 'production',
				scope: 'abril-michelle-becerra-rea',
				manifestFingerprint: 'manifest-sha-123',
			},
		});

		expect(result.valid).toBe(false);
		expect(result.reason).toBe('MALFORMED_APPROVAL_TOKEN');
	});
});

describe('confirmProductionAction — authorized paths', () => {
	it('proceeds when CONFIRM_PROD_MIGRATION matches expected challenge', async () => {
		process.env.CONFIRM_PROD_MIGRATION = CHALLENGE;
		delete process.env.CELEBRA_AGENT_CONTEXT;
		delete process.env.CELEBRA_PROD_AUTH_SECRET;

		await expect(confirmProductionAction(TARGET, CHALLENGE)).resolves.toBeUndefined();
	});

	it('proceeds when a valid CELEBRA_PROD_APPROVAL_TOKEN and secret are provided', async () => {
		delete process.env.CELEBRA_AGENT_CONTEXT;
		process.env.CELEBRA_PROD_AUTH_SECRET = SECRET;
		process.env.CELEBRA_PROD_APPROVAL_TOKEN = createProductionApprovalToken(
			{
				operationType: 'production_migration',
				targetEnv: 'production',
				scope: '*',
				manifestFingerprint: CHALLENGE,
				expiresAt: Date.now() + 60000,
				nonce: 'nonce-valid',
			},
			SECRET,
		);

		await expect(confirmProductionAction(TARGET, CHALLENGE)).resolves.toBeUndefined();
	});
});

describe('confirmProductionAction — unauthorized paths', () => {
	it('throws when CONFIRM_PROD_MIGRATION has a wrong challenge string', async () => {
		process.env.CONFIRM_PROD_MIGRATION = 'PROMOTE fixture-slug wrong-hash';
		delete process.env.CELEBRA_AGENT_CONTEXT;
		delete process.env.CELEBRA_PROD_AUTH_SECRET;

		await expect(confirmProductionAction(TARGET, CHALLENGE)).rejects.toThrow(
			/CONFIRM_PROD_MIGRATION mismatched/i,
		);
	});

	it('throws when CELEBRA_AGENT_CONTEXT is set', async () => {
		process.env.CELEBRA_AGENT_CONTEXT = 'true';
		process.env.CONFIRM_PROD_MIGRATION = CHALLENGE;

		await expect(confirmProductionAction(TARGET, CHALLENGE)).rejects.toThrow(
			/AGENT_SELF_AUTHORIZATION_BLOCKED/i,
		);
	});

	it('throws when token validation fails (expired token)', async () => {
		delete process.env.CELEBRA_AGENT_CONTEXT;
		process.env.CELEBRA_PROD_AUTH_SECRET = SECRET;
		process.env.CELEBRA_PROD_APPROVAL_TOKEN = createProductionApprovalToken(
			{
				operationType: 'production_migration',
				targetEnv: 'production',
				scope: '*',
				manifestFingerprint: CHALLENGE,
				expiresAt: Date.now() - 5000,
				nonce: 'nonce-expired',
			},
			SECRET,
		);

		await expect(confirmProductionAction(TARGET, CHALLENGE)).rejects.toThrow(
			/PRODUCTION_AUTHORIZATION_FAILED \[EXPIRED_APPROVAL_TOKEN\]/i,
		);
	});
});
