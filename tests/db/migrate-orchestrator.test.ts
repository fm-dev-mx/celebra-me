import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { MigrationPlan } from '../../scripts/db/migration-plan.ts';
import { buildMigrationPlan } from '../../scripts/db/migration-plan.ts';

const mockBuildPlan = jest.fn<(...args: unknown[]) => unknown>();
const mockResolve = jest.fn<(...args: unknown[]) => unknown>();
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
		jest.clearAllMocks();
		mockResolve.mockReturnValue({
			dbUrl: 'postgresql://postgres:secret@db.example.supabase.co:5432/postgres',
			expectedPin: null,
			env: {},
		});
		const stable = plan({ mode: 'apply' });
		mockBuildPlan.mockReturnValue(stable);
	});

	it('routes local, preview, production, and disposable through the same orchestrator sequence', async () => {
		const { orchestrateMigrate, getMigratePolicy } =
			await import('../../scripts/db/migrate-orchestrator.ts');
		expect(getMigratePolicy('local').target).toBe('local');
		expect(getMigratePolicy('preview').target).toBe('preview');
		expect(getMigratePolicy('production').target).toBe('production');
		expect(getMigratePolicy('disposable-test').target).toBe('disposable-test');

		for (const target of ['local', 'preview', 'production', 'disposable-test'] as const) {
			jest.clearAllMocks();
			const stable = plan({ target, mode: 'apply' });
			mockBuildPlan.mockReturnValue(stable);
			mockResolve.mockReturnValue({
				dbUrl: 'postgresql://postgres:secret@127.0.0.1:54322/postgres',
				expectedPin: null,
				env: {},
			});
			const order: string[] = [];
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

			await orchestrateMigrate({
				target,
				mode: 'apply',
				expectedPin: null,
				remindConcurrencyRisk: false,
			});
			expect(order).toEqual(['before', 'auth', 'exec', 'after']);
			expect(mockBuildPlan).toHaveBeenCalled();
		}
	});

	it('rejects live drift before authorization or write', async () => {
		const { orchestrateMigrate } = await import('../../scripts/db/migrate-orchestrator.ts');
		const first = plan({ mode: 'apply', pendingVersions: ['20260730220544'] });
		const second = plan({ mode: 'apply', pendingVersions: ['20260802090000'] });
		mockBuildPlan.mockReturnValueOnce(first).mockReturnValueOnce(second);

		await expect(
			orchestrateMigrate({
				target: 'preview',
				mode: 'apply',
				expectedPin: null,
				remindConcurrencyRisk: false,
			}),
		).rejects.toThrow(/PLAN_DRIFT/);
		expect(mockAuthorize).not.toHaveBeenCalled();
		expect(mockExecute).not.toHaveBeenCalled();
	});

	it('rejects reviewed-plan drift before write (failed apply requires replan)', async () => {
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
		expect(mockExecute).not.toHaveBeenCalled();
	});
});
