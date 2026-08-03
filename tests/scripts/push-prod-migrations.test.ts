import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
	confirmProductionAction,
	deriveProductionOperationId,
	runCommand,
	type ProductionApprovalTokenPayload,
} from '../../scripts/db/db-workflow-lib.ts';
import {
	createSanitizedValidationEnv,
	PRODUCTION_AUTHORIZATION_ENV_KEYS,
	runLocalValidation,
} from '../../scripts/db/push-prod-migrations.ts';

const originalEnv = { ...process.env };
const keyPair = generateKeyPairSync('ed25519');
const approvalTarget = 'production-test-host';
const approvalManifest = 'migration-manifest';

function createApprovalToken(privateKey: KeyObject): string {
	const context = {
		operationType: 'production_migration',
		targetEnv: 'production' as const,
		scope: approvalTarget,
		manifestFingerprint: approvalManifest,
	};
	const payload: ProductionApprovalTokenPayload = {
		...context,
		operationId: deriveProductionOperationId(context),
		expiresAt: Date.now() + 60_000,
		nonce: 'validation-boundary-test',
	};
	// Signed JSON key order must byte-match `approvalPayloadJson` in db-workflow-lib.ts:
	// the Ed25519 signature covers the exact serialized bytes, so reordering keys here
	// invalidates the token signature.
	const signedPayload = JSON.stringify({
		operationType: payload.operationType,
		targetEnv: payload.targetEnv,
		scope: payload.scope,
		manifestFingerprint: payload.manifestFingerprint,
		operationId: payload.operationId,
		expiresAt: payload.expiresAt,
		nonce: payload.nonce,
	});

	return Buffer.from(
		JSON.stringify({
			version: 1,
			algorithm: 'Ed25519',
			payload,
			signature: sign(null, Buffer.from(signedPayload, 'utf8'), privateKey).toString(
				'base64url',
			),
		}),
		'utf8',
	).toString('base64url');
}

beforeEach(() => {
	process.env = { ...originalEnv };
});

afterEach(() => {
	process.env = originalEnv;
	jest.restoreAllMocks();
});

describe('Production migration validation environment', () => {
	it('removes Production authorization variables from all Step 2 subprocesses', () => {
		for (const key of PRODUCTION_AUTHORIZATION_ENV_KEYS) {
			process.env[key] = `secret-${key}`;
		}
		process.env.VALIDATION_SAFE_VALUE = 'preserved';
		const runner = jest.fn<typeof runCommand>();

		runLocalValidation(runner);

		expect(runner).toHaveBeenCalledTimes(3);
		expect(runner.mock.calls.map(([command, args]) => [command, args])).toEqual([
			['pnpm', ['type-check']],
			['pnpm', ['test']],
			['pnpm', ['build']],
		]);
		for (const [, , options] of runner.mock.calls) {
			expect(options?.env?.VALIDATION_SAFE_VALUE).toBe('preserved');
			for (const key of PRODUCTION_AUTHORIZATION_ENV_KEYS) {
				expect(options?.env?.[key]).toBeUndefined();
			}
		}
		for (const key of PRODUCTION_AUTHORIZATION_ENV_KEYS) {
			expect(process.env[key]).toBe(`secret-${key}`);
		}
	});

	it('preserves the parent approval for confirmation after validation', async () => {
		for (const key of PRODUCTION_AUTHORIZATION_ENV_KEYS) delete process.env[key];
		const token = createApprovalToken(keyPair.privateKey);
		process.env.CELEBRA_PROD_APPROVAL_TOKEN = token;
		process.env.CELEBRA_PROD_APPROVAL_PUBLIC_KEY = keyPair.publicKey
			.export({ type: 'spki', format: 'pem' })
			.toString();
		delete process.env.CELEBRA_AGENT_CONTEXT;

		const runner = jest.fn<typeof runCommand>();
		runLocalValidation(runner);
		const sanitizedEnv = createSanitizedValidationEnv();
		const consumeApproval = jest.fn(() => ({ consumed: true as const }));

		expect(sanitizedEnv.CELEBRA_PROD_APPROVAL_TOKEN).toBeUndefined();
		expect(process.env.CELEBRA_PROD_APPROVAL_TOKEN).toBe(token);
		await expect(
			confirmProductionAction(approvalTarget, approvalManifest, { consumeApproval }),
		).resolves.toBeUndefined();
		expect(consumeApproval).toHaveBeenCalledTimes(1);
	});
});
