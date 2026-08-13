import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { MigrationPlan } from '../../scripts/db/migration-plan.ts';
import { buildMigrationPlan } from '../../scripts/db/migration-plan.ts';
import {
	assertMutationContractVerifyResult,
	MUTATION_CONTRACT_VERIFY_TIMEOUT_MS,
} from '../../scripts/db/migrate-executors.ts';

const mockBuildPlan = jest.fn<(...args: unknown[]) => unknown>();
const mockResolve = jest.fn<(...args: unknown[]) => unknown>();
const mockPrepareApply = jest.fn<(...args: unknown[]) => void>();
const mockAuthorize = jest.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
const mockBeforeWrite = jest.fn<(...args: unknown[]) => void>();
const mockExecute = jest.fn<(...args: unknown[]) => void>();
const mockAfterWrite = jest.fn<(...args: unknown[]) => void>();

jest.mock('../../scripts/db/db-workflow-lib.ts', () => ({
	fail: (message: string): never => {
		throw new Error(message);
	},
}));

jest.mock('../../scripts/db/migrate-policy-local.ts', () => ({
	localMigratePolicy: {
		target: 'local',
		resolveContext: (input: unknown) => mockResolve(input),
		buildPlan: (ctx: unknown, mode: unknown) => mockBuildPlan(ctx, mode),
		prepareApply: (ctx: unknown) => mockPrepareApply(ctx),
		authorize: (plan: unknown, ctx: unknown) => mockAuthorize(plan, ctx),
		beforeWrite: (plan: unknown, ctx: unknown) => mockBeforeWrite(plan, ctx),
		execute: (plan: unknown, ctx: unknown) => mockExecute(plan, ctx),
		afterWrite: (plan: unknown, ctx: unknown) => mockAfterWrite(plan, ctx),
	},
}));

jest.mock('../../scripts/db/migrate-policy-preview.ts', () => ({
	previewMigratePolicy: {
		target: 'preview',
		resolveContext: (input: unknown) => mockResolve(input),
		buildPlan: (ctx: unknown, mode: unknown) => mockBuildPlan(ctx, mode),
		prepareApply: (ctx: unknown) => mockPrepareApply(ctx),
		authorize: (plan: unknown, ctx: unknown) => mockAuthorize(plan, ctx),
		beforeWrite: (plan: unknown, ctx: unknown) => mockBeforeWrite(plan, ctx),
		execute: (plan: unknown, ctx: unknown) => mockExecute(plan, ctx),
		afterWrite: (plan: unknown, ctx: unknown) => mockAfterWrite(plan, ctx),
	},
}));

jest.mock('../../scripts/db/migrate-policy-production.ts', () => ({
	productionMigratePolicy: {
		target: 'production',
		resolveContext: (input: unknown) => mockResolve(input),
		buildPlan: (ctx: unknown, mode: unknown) => mockBuildPlan(ctx, mode),
		prepareApply: (ctx: unknown) => mockPrepareApply(ctx),
		authorize: (plan: unknown, ctx: unknown) => mockAuthorize(plan, ctx),
		beforeWrite: (plan: unknown, ctx: unknown) => mockBeforeWrite(plan, ctx),
		execute: (plan: unknown, ctx: unknown) => mockExecute(plan, ctx),
		afterWrite: (plan: unknown, ctx: unknown) => mockAfterWrite(plan, ctx),
	},
}));

jest.mock('../../scripts/db/migrate-policy-disposable.ts', () => ({
	disposableMigratePolicy: {
		target: 'disposable-test',
		resolveContext: (input: unknown) => mockResolve(input),
		buildPlan: (ctx: unknown, mode: unknown) => mockBuildPlan(ctx, mode),
		prepareApply: (ctx: unknown) => mockPrepareApply(ctx),
		authorize: (plan: unknown, ctx: unknown) => mockAuthorize(plan, ctx),
		beforeWrite: (plan: unknown, ctx: unknown) => mockBeforeWrite(plan, ctx),
		execute: (plan: unknown, ctx: unknown) => mockExecute(plan, ctx),
		afterWrite: (plan: unknown, ctx: unknown) => mockAfterWrite(plan, ctx),
	},
}));

function plan(overrides: Partial<MigrationPlan> = {}): MigrationPlan {
	return buildMigrationPlan({
		target: 'preview',
		mode: 'preflight',
		sourceHead: 'abc1234',
		redactedTargetIdentity: 'preview:redacted',
		pendingVersions: ['20260730220544'],
		expectedPin: null,
		phaseByVersion: { '20260730220544': 'expand' },
		compatibilityStatus: 'allow',
		compatibilityReasons: ['ok'],
		releaseIdentity: { kind: 'target_sha', value: 'abc1234' },
		deployedAppIdentity: { sha: null, capabilities: [] },
		authRequirement: 'preview_scope_or_tty',
		backupRequirement: 'none',
		executor: 'supabase_cli_push',
		verificationRequirement: 'history_and_mutation_contract',
		releaseEvidenceSha: null,
		...overrides,
	});
}

describe('migrate orchestrator', () => {
	beforeEach(() => {
		jest.resetModules();
		jest.resetAllMocks();
		mockPrepareApply.mockImplementation(() => undefined);
		mockAuthorize.mockImplementation(async () => undefined);
		mockBeforeWrite.mockImplementation(() => undefined);
		mockExecute.mockImplementation(() => undefined);
		mockAfterWrite.mockImplementation(() => undefined);
		mockResolve.mockReturnValue({
			dbUrl: 'postgresql://postgres:secret@db.example.supabase.co:5432/postgres',
			expectedPin: null,
			env: {},
			session: {},
		});
		const stable = plan({ mode: 'apply' });
		mockBuildPlan.mockReturnValue(stable);
		jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
	});

	it('routes through prepareApply → backup → rebuild → auth → write', async () => {
		const { orchestrateMigrate, getMigratePolicy } =
			await import('../../scripts/db/migrate-orchestrator.ts');
		expect(getMigratePolicy('local').target).toBe('local');
		expect(getMigratePolicy('preview').target).toBe('preview');
		expect(getMigratePolicy('production').target).toBe('production');
		expect(getMigratePolicy('disposable-test').target).toBe('disposable-test');

		const { readFileSync } = await import('node:fs');
		expect(readFileSync('scripts/db/migrate-policy-local.ts', 'utf8')).toContain(
			'executePsqlAtomicPending',
		);
		expect(readFileSync('scripts/db/migrate-policy-disposable.ts', 'utf8')).toContain(
			'executePsqlAtomicDisposable',
		);
		expect(readFileSync('scripts/db/migrate-policy-preview.ts', 'utf8')).toContain(
			'executeSupabasePush',
		);
		expect(readFileSync('scripts/db/migrate-policy-production.ts', 'utf8')).toContain(
			'executeSupabasePush',
		);

		for (const target of ['local', 'preview', 'production', 'disposable-test'] as const) {
			jest.clearAllMocks();
			const stable = plan({ target, mode: 'apply' });
			mockBuildPlan.mockReturnValue(stable);
			mockResolve.mockReturnValue({
				dbUrl: 'postgresql://postgres:secret@127.0.0.1:54322/postgres',
				expectedPin: null,
				env: {},
				session: {},
			});
			const order: string[] = [];
			mockPrepareApply.mockImplementation(() => {
				order.push('prepare');
			});
			mockBeforeWrite.mockImplementation(() => {
				order.push('before');
			});
			mockAuthorize.mockImplementation(async () => {
				order.push('auth');
			});
			mockExecute.mockImplementation(() => {
				order.push('exec');
			});
			mockAfterWrite.mockImplementation(() => {
				order.push('after');
			});

			const result = await orchestrateMigrate({
				target,
				mode: 'apply',
				expectedPin: null,
				remindConcurrencyRisk: false,
			});
			expect(order).toEqual(['prepare', 'before', 'auth', 'exec', 'after']);
			expect(result.state).toBe('APPLIED_AND_VERIFIED');
			// Direct apply: one initial build + one post-backup rebuild.
			expect(mockBuildPlan).toHaveBeenCalledTimes(2);
			expect(mockPrepareApply.mock.invocationCallOrder[0]).toBeLessThan(
				mockBeforeWrite.mock.invocationCallOrder[0]!,
			);
		}
	});

	it('with reviewedPlan: prepareApply → backup → one rebuild before authorization', async () => {
		const { orchestrateMigrate } = await import('../../scripts/db/migrate-orchestrator.ts');
		const reviewed = plan({ mode: 'preflight' });
		const live = plan({ mode: 'apply' });
		mockBuildPlan.mockReturnValue(live);
		const order: string[] = [];
		mockPrepareApply.mockImplementation(() => order.push('prepare'));
		mockBeforeWrite.mockImplementation(() => order.push('before'));
		mockAuthorize.mockImplementation(async () => {
			order.push('auth');
		});

		await orchestrateMigrate({
			target: 'preview',
			mode: 'apply',
			expectedPin: null,
			reviewedPlan: reviewed,
			remindConcurrencyRisk: false,
		});
		expect(order).toEqual(['prepare', 'before', 'auth']);
		expect(mockBuildPlan).toHaveBeenCalledTimes(1);
		expect(mockPrepareApply.mock.invocationCallOrder[0]).toBeLessThan(
			mockBeforeWrite.mock.invocationCallOrder[0]!,
		);
		expect(mockBeforeWrite.mock.invocationCallOrder[0]).toBeLessThan(
			mockBuildPlan.mock.invocationCallOrder[0]!,
		);
	});

	it('rejects post-backup drift before authorization or write', async () => {
		const { orchestrateMigrate } = await import('../../scripts/db/migrate-orchestrator.ts');
		const reviewed = plan({
			mode: 'preflight',
			pendingVersions: ['20260730220544'],
		});
		const live = plan({
			mode: 'apply',
			pendingVersions: ['20260802090000'],
		});
		mockBuildPlan.mockReturnValue(live);

		await expect(
			orchestrateMigrate({
				target: 'preview',
				mode: 'apply',
				expectedPin: null,
				reviewedPlan: reviewed,
				remindConcurrencyRisk: false,
			}),
		).rejects.toThrow(/PLAN_DRIFT/);
		expect(mockPrepareApply).toHaveBeenCalled();
		expect(mockBeforeWrite).toHaveBeenCalled();
		expect(mockAuthorize).not.toHaveBeenCalled();
		expect(mockExecute).not.toHaveBeenCalled();
	});

	it('reports NOT_APPLIED when the write fails and every attempted version remains pending', async () => {
		const { orchestrateMigrate } = await import('../../scripts/db/migrate-orchestrator.ts');
		const stable = plan({ target: 'production', mode: 'apply' });
		mockBuildPlan.mockReturnValue(stable);
		mockExecute.mockImplementation(() => {
			throw new Error('push failed before applying a migration');
		});

		await expect(
			orchestrateMigrate({
				target: 'production',
				mode: 'apply',
				expectedPin: null,
				remindConcurrencyRisk: false,
			}),
		).rejects.toMatchObject({ state: 'NOT_APPLIED', code: 'NOT_APPLIED' });
		expect(mockAfterWrite).not.toHaveBeenCalled();
	});

	it('reports APPLIED_VERIFICATION_FAILED when live history changed before a write error', async () => {
		const { orchestrateMigrate } = await import('../../scripts/db/migrate-orchestrator.ts');
		const attempted = plan({ target: 'production', mode: 'apply' });
		const observed = plan({
			target: 'production',
			mode: 'preflight',
			pendingVersions: [],
			phaseByVersion: {},
		});
		mockBuildPlan
			.mockReturnValueOnce(attempted)
			.mockReturnValueOnce(attempted)
			.mockReturnValueOnce(observed);
		mockExecute.mockImplementation(() => {
			throw new Error('push transport failed after commit');
		});

		await expect(
			orchestrateMigrate({
				target: 'production',
				mode: 'apply',
				expectedPin: null,
				remindConcurrencyRisk: false,
			}),
		).rejects.toMatchObject({
			state: 'APPLIED_VERIFICATION_FAILED',
			code: 'APPLIED_VERIFICATION_FAILED',
		});
		expect(mockAfterWrite).not.toHaveBeenCalled();
	});

	it('reports APPLIED_VERIFICATION_FAILED when post-write verification fails', async () => {
		const { orchestrateMigrate } = await import('../../scripts/db/migrate-orchestrator.ts');
		const stable = plan({ target: 'production', mode: 'apply' });
		mockBuildPlan.mockReturnValue(stable);
		mockAfterWrite.mockImplementation(() => {
			throw new Error('verifier malformed output');
		});

		await expect(
			orchestrateMigrate({
				target: 'production',
				mode: 'apply',
				expectedPin: null,
				remindConcurrencyRisk: false,
			}),
		).rejects.toMatchObject({
			state: 'APPLIED_VERIFICATION_FAILED',
			code: 'APPLIED_VERIFICATION_FAILED',
		});
		expect(mockExecute).toHaveBeenCalledTimes(1);
	});
});

describe('mutation contract verifier result', () => {
	it('accepts only the exact success sentinel', () => {
		expect(() =>
			assertMutationContractVerifyResult(
				{
					status: 0,
					stdout: 'Mutation schema contract verified for production.\n',
					stderr: '',
				},
				'production',
			),
		).not.toThrow();
	});

	it.each([
		[{ status: null, stdout: '', stderr: 'ETIMEDOUT' }, 'MUTATION_CONTRACT_VERIFY_TIMEOUT'],
		[{ status: 1, stdout: '', stderr: 'contract mismatch' }, 'MUTATION_CONTRACT_VERIFY_FAILED'],
		[
			{ status: 0, stdout: '{malformed', stderr: '' },
			'MUTATION_CONTRACT_VERIFY_INVALID_OUTPUT',
		],
	] as const)('fails closed for %s', (result, code) => {
		expect(() => assertMutationContractVerifyResult(result, 'production')).toThrow(
			expect.objectContaining({ code }),
		);
	});

	it('keeps a bounded child-process timeout', () => {
		expect(MUTATION_CONTRACT_VERIFY_TIMEOUT_MS).toBe(30_000);
	});
});
