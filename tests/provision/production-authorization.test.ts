import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import {
	assertExactProductionProjectRef,
	requireOwnerProductionApply,
} from '../../scripts/db/owner-production-apply.ts';

const originalEnv = { ...process.env };
const PROD_URL = `postgresql://postgres:secret@db.${SUPABASE_PROJECT_REFS.production}.supabase.co:5432/postgres`;
const PREVIEW_URL = `postgresql://postgres:secret@db.${SUPABASE_PROJECT_REFS.preview}.supabase.co:5432/postgres`;

function mockExit(): void {
	jest.spyOn(console, 'error').mockImplementation(() => undefined);
	jest.spyOn(console, 'info').mockImplementation(() => undefined);
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

describe('requireOwnerProductionApply', () => {
	it('fails without --apply', () => {
		mockExit();
		expect(() =>
			requireOwnerProductionApply({
				apply: false,
				dbUrl: PROD_URL,
				operationType: 'production_migration',
				confirmationChallenge: 'MIGRATE test',
				summary: [['Mode', 'test']],
				assertReleaseEvidence: () => ({ sha: 'abc1234' }),
				readConfirmationLine: () => 'MIGRATE test',
			}),
		).toThrow('process.exit:1');
	});

	it('rejects agent contexts', () => {
		mockExit();
		expect(() =>
			requireOwnerProductionApply({
				apply: true,
				dbUrl: PROD_URL,
				operationType: 'production_migration',
				confirmationChallenge: 'MIGRATE test',
				summary: [['Mode', 'test']],
				env: { CELEBRA_AGENT_CONTEXT: 'true' },
				assertReleaseEvidence: () => ({ sha: 'abc1234' }),
				readConfirmationLine: () => 'MIGRATE test',
			}),
		).toThrow('process.exit:1');
	});

	it('rejects non-Production project URLs', () => {
		mockExit();
		expect(() => assertExactProductionProjectRef(PREVIEW_URL)).toThrow('process.exit:1');
	});

	it('fails closed without TTY when no confirmation seam is provided', () => {
		mockExit();
		const fakeStdin = { isTTY: false } as NodeJS.ReadStream;
		expect(() =>
			requireOwnerProductionApply({
				apply: true,
				dbUrl: PROD_URL,
				operationType: 'production_migration',
				confirmationChallenge: 'MIGRATE test',
				summary: [['Mode', 'test']],
				stdin: fakeStdin,
				assertReleaseEvidence: () => ({ sha: 'abc1234' }),
			}),
		).toThrow('process.exit:1');
	});

	it('fails when typed confirmation does not match', () => {
		mockExit();
		expect(() =>
			requireOwnerProductionApply({
				apply: true,
				dbUrl: PROD_URL,
				operationType: 'production_migration',
				confirmationChallenge: 'MIGRATE exact',
				summary: [['Mode', 'test']],
				assertReleaseEvidence: () => ({ sha: 'abc1234' }),
				readConfirmationLine: () => 'MIGRATE wrong',
			}),
		).toThrow('process.exit:1');
	});

	it('accepts exact TTY confirmation after identity and release evidence', () => {
		expect(() =>
			requireOwnerProductionApply({
				apply: true,
				dbUrl: PROD_URL,
				operationType: 'production_migration',
				confirmationChallenge: 'MIGRATE exact',
				summary: [['Mode', 'test']],
				assertReleaseEvidence: () => ({ sha: 'abc1234' }),
				readConfirmationLine: () => 'MIGRATE exact',
			}),
		).not.toThrow();
	});

	it('keeps owner prompts off stdout for machine-readable callers', () => {
		const stdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
		const stderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

		requireOwnerProductionApply({
			apply: true,
			dbUrl: PROD_URL,
			operationType: 'production_migration',
			confirmationChallenge: 'MIGRATE exact',
			summary: [['Mode', 'test']],
			assertReleaseEvidence: () => ({ sha: 'abc1234' }),
			readConfirmationLine: () => 'MIGRATE exact',
		});

		expect(stdoutWrite).not.toHaveBeenCalled();
		expect(stderrWrite).toHaveBeenCalled();
	});
});

describe('crypto authorization removal', () => {
	it('does not export Ed25519 approval helpers from db-workflow-lib', async () => {
		const lib = await import('../../scripts/db/db-workflow-lib.ts');
		expect('verifyProductionApprovalToken' in lib).toBe(false);
		expect('consumeProductionApproval' in lib).toBe(false);
		expect('requireProductionConfirmation' in lib).toBe(false);
		expect('confirmProductionAction' in lib).toBe(false);
		expect('deriveProductionOperationId' in lib).toBe(false);
	});

	it('wires all seven Production mutators to requireOwnerProductionApply', async () => {
		const { readFileSync } = await import('node:fs');
		const files = [
			'scripts/db/push-prod-migrations.ts',
			'scripts/db/run-prod-patch.ts',
			'scripts/provision/invitation-promote-cli.ts',
			'scripts/provision/romina-schema-repair-cli.ts',
			'scripts/provision/romina-draft-reset-cli.ts',
			'scripts/provision/legacy-baseline-adoption-cli.ts',
			'scripts/provision/invitation-update-cli.ts',
		];
		for (const file of files) {
			const source = readFileSync(file, 'utf8');
			expect(source).toContain('requireOwnerProductionApply');
			expect(source).not.toContain('consumeProductionApproval');
			expect(source).not.toContain('CELEBRA_PROD_APPROVAL_TOKEN');
			expect(source).not.toContain('production_authorization_receipts');
		}
	});
});
