import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
	confirmProductionAction,
	deriveProductionOperationId,
	verifyProductionApprovalToken,
	type ProductionApprovalTokenPayload,
} from '../../scripts/db/db-workflow-lib.ts';

const originalEnv = { ...process.env };
const keyPair = generateKeyPairSync('ed25519');
const otherKeyPair = generateKeyPairSync('ed25519');
const PUBLIC_KEY = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const TARGET = 'production-test-host';
const CONTEXT = {
	operationType: 'promotion',
	targetEnv: 'production' as const,
	scope: 'abril-michelle-becerra-rea',
	manifestFingerprint: 'manifest-sha-123',
};

function payload(
	overrides: Partial<ProductionApprovalTokenPayload> = {},
): ProductionApprovalTokenPayload {
	return {
		...CONTEXT,
		operationId: deriveProductionOperationId(CONTEXT),
		expiresAt: Date.now() + 60_000,
		nonce: 'nonce-1',
		...overrides,
	};
}

function token(
	overrides: Partial<ProductionApprovalTokenPayload> = {},
	privateKey = keyPair.privateKey,
): string {
	return createTestApprovalToken(payload(overrides), privateKey);
}

function createTestApprovalToken(
	approvalPayload: ProductionApprovalTokenPayload,
	privateKey: KeyObject,
): string {
	const signedPayload = JSON.stringify({
		operationType: approvalPayload.operationType,
		targetEnv: approvalPayload.targetEnv,
		scope: approvalPayload.scope,
		manifestFingerprint: approvalPayload.manifestFingerprint,
		operationId: approvalPayload.operationId,
		expiresAt: approvalPayload.expiresAt,
		nonce: approvalPayload.nonce,
	});
	return Buffer.from(
		JSON.stringify({
			version: 1,
			algorithm: 'Ed25519',
			payload: approvalPayload,
			signature: sign(null, Buffer.from(signedPayload, 'utf8'), privateKey).toString(
				'base64url',
			),
		}),
		'utf8',
	).toString('base64url');
}

function mockExit(): void {
	jest.spyOn(console, 'error').mockImplementation(() => undefined);
	jest.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
		throw new Error(`process.exit:${code ?? ''}`);
	}) as never);
}

afterEach(() => {
	for (const key of Object.keys(process.env)) {
		if (!(key in originalEnv)) delete process.env[key];
	}
	Object.assign(process.env, originalEnv);
	jest.restoreAllMocks();
});

describe('external Ed25519 approval boundary', () => {
	it('creates and verifies a valid exact-context token', () => {
		const result = verifyProductionApprovalToken({
			tokenStr: token(),
			publicKey: PUBLIC_KEY,
			expectedContext: { ...CONTEXT, operationId: deriveProductionOperationId(CONTEXT) },
		});
		expect(result).toEqual({ valid: true });
	});

	it('rejects expired, malformed, mismatched, and wrongly signed tokens', () => {
		expect(
			verifyProductionApprovalToken({
				tokenStr: token({ expiresAt: Date.now() - 1 }),
				publicKey: PUBLIC_KEY,
				expectedContext: { ...CONTEXT, operationId: deriveProductionOperationId(CONTEXT) },
			}),
		).toEqual({ valid: false, reason: 'EXPIRED_APPROVAL_TOKEN' });
		expect(
			verifyProductionApprovalToken({
				tokenStr: token({}, otherKeyPair.privateKey),
				publicKey: PUBLIC_KEY,
				expectedContext: { ...CONTEXT, operationId: deriveProductionOperationId(CONTEXT) },
			}),
		).toEqual({ valid: false, reason: 'INVALID_SIGNATURE' });
		expect(
			verifyProductionApprovalToken({
				tokenStr: token(),
				publicKey: PUBLIC_KEY,
				expectedContext: {
					...CONTEXT,
					scope: 'romina-rios-chaparro',
					operationId: deriveProductionOperationId(CONTEXT),
				},
			}),
		).toEqual({ valid: false, reason: 'SCOPE_MISMATCH' });
		expect(
			verifyProductionApprovalToken({
				tokenStr: 'not-a-valid-token-json',
				publicKey: PUBLIC_KEY,
				expectedContext: { ...CONTEXT, operationId: deriveProductionOperationId(CONTEXT) },
			}),
		).toEqual({ valid: false, reason: 'MALFORMED_APPROVAL_TOKEN' });
		expect(
			verifyProductionApprovalToken({
				tokenStr: token(),
				publicKey: undefined,
				expectedContext: { ...CONTEXT, operationId: deriveProductionOperationId(CONTEXT) },
			}),
		).toEqual({ valid: false, reason: 'MISSING_OPERATOR_PUBLIC_KEY' });
	});
});

describe('confirmProductionAction', () => {
	it('requires external approval and consumes it durably', async () => {
		process.env.CELEBRA_PROD_APPROVAL_PUBLIC_KEY = PUBLIC_KEY;
		const operationContext = {
			operationType: 'production_migration',
			targetEnv: 'production' as const,
			scope: TARGET,
			manifestFingerprint: 'MIGRATE production-test-host',
		};
		process.env.CELEBRA_PROD_APPROVAL_TOKEN = createTestApprovalToken(
			{
				...operationContext,
				operationId: deriveProductionOperationId(operationContext),
				expiresAt: Date.now() + 60_000,
				nonce: 'nonce-confirm',
			},
			keyPair.privateKey,
		);
		const consumeApproval = jest.fn(() => ({ consumed: true as const }));

		await expect(
			confirmProductionAction(TARGET, 'MIGRATE production-test-host', { consumeApproval }),
		).resolves.toBeUndefined();
		expect(consumeApproval).toHaveBeenCalledTimes(1);
	});

	it('rejects plaintext confirmation, self-issued secrets, and replayed approvals', async () => {
		process.env.CONFIRM_PROD_MIGRATION = 'MIGRATE production-test-host';
		mockExit();
		await expect(
			confirmProductionAction(TARGET, 'MIGRATE production-test-host'),
		).rejects.toThrow('process.exit:1');

		process.env.CELEBRA_PROD_AUTH_SECRET = 'legacy-secret';
		await expect(
			confirmProductionAction(TARGET, 'MIGRATE production-test-host'),
		).rejects.toThrow('process.exit:1');

		delete process.env.CELEBRA_PROD_AUTH_SECRET;
		process.env.CELEBRA_PROD_APPROVAL_PUBLIC_KEY = PUBLIC_KEY;
		process.env.CELEBRA_PROD_APPROVAL_TOKEN = createTestApprovalToken(
			{
				operationType: 'production_migration',
				targetEnv: 'production',
				scope: TARGET,
				manifestFingerprint: 'MIGRATE production-test-host',
				operationId: deriveProductionOperationId({
					operationType: 'production_migration',
					targetEnv: 'production',
					scope: TARGET,
					manifestFingerprint: 'MIGRATE production-test-host',
				}),
				expiresAt: Date.now() + 60_000,
				nonce: 'nonce-replay',
			},
			keyPair.privateKey,
		);
		await expect(
			confirmProductionAction(TARGET, 'MIGRATE production-test-host', {
				consumeApproval: () => ({ consumed: false, reason: 'REPLAYED_APPROVAL' }),
			}),
		).rejects.toThrow('process.exit:1');
	});
});
