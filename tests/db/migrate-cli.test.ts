/**
 * Behavioral migrate CLI contracts — TTY Cancel default, non-TTY target required.
 * Orchestrator is mocked so these stay hermetic (no DB/network).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSelect = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPreflightMigrate = jest.fn<(...args: unknown[]) => unknown>();
const mockOrchestrateMigrate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockApplyProductionApplyPlan = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('@inquirer/prompts', () => ({
	select: (...args: unknown[]) => mockSelect(...args),
	confirm: jest.fn(),
}));

jest.mock('../../scripts/db/migrate-orchestrator.ts', () => ({
	preflightMigrate: (...args: unknown[]) => mockPreflightMigrate(...args),
	orchestrateMigrate: (...args: unknown[]) => mockOrchestrateMigrate(...args),
	formatPlanReview: () => 'plan-review',
	formatPlanReviewCompact: () => 'plan-compact',
}));

jest.mock('../../scripts/db/migrate-expected.ts', () => ({
	parseExpectedConstraint: () => ({ expectedPin: null }),
}));

jest.mock('../../scripts/db/production-apply-orchestrator.ts', () => ({
	applyProductionApplyPlan: (...args: unknown[]) => mockApplyProductionApplyPlan(...args),
	buildProductionApplyPlan: jest.fn(),
}));

jest.mock('../../scripts/db/production-apply-format.ts', () => ({
	formatProductionApplyResult: () => 'prod-apply-result',
	toPublicProductionApplyPlan: (plan: unknown) => plan,
}));

describe('migrate CLI behavioral contracts', () => {
	const originalEnv = { ...process.env };
	let stderr = '';
	let writeErr: (chunk: string | Uint8Array) => boolean;

	const originalStdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
	const originalStderrDescriptor = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		process.env = { ...originalEnv };
		stderr = '';
		writeErr = process.stderr.write.bind(process.stderr);
		process.stderr.write = ((chunk: string | Uint8Array) => {
			stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
			return true;
		}) as typeof process.stderr.write;
		Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
		Object.defineProperty(process.stderr, 'isTTY', { value: false, configurable: true });
		process.exitCode = undefined;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		process.stderr.write = writeErr;
		process.exitCode = undefined;
		if (originalStdinDescriptor) {
			Object.defineProperty(process.stdin, 'isTTY', originalStdinDescriptor);
		} else {
			delete (process.stdin as { isTTY?: boolean }).isTTY;
		}
		if (originalStderrDescriptor) {
			Object.defineProperty(process.stderr, 'isTTY', originalStderrDescriptor);
		} else {
			delete (process.stderr as { isTTY?: boolean }).isTTY;
		}
	});

	it('fails closed without --target when non-TTY', async () => {
		const { runMigrateCli } = await import('../../scripts/db/migrate-cli.ts');
		await runMigrateCli(['node', 'migrate-cli.ts']);
		expect(stderr).toMatch(/TARGET_REQUIRED|Falta el destino/);
		expect(process.exitCode).toBe(1);
		expect(mockSelect).not.toHaveBeenCalled();
		expect(mockPreflightMigrate).not.toHaveBeenCalled();
		expect(mockOrchestrateMigrate).not.toHaveBeenCalled();
	});

	it('TTY target selector Cancelar default performs no schema write', async () => {
		Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
		Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
		mockSelect.mockResolvedValueOnce('cancel');

		const { runMigrateCli } = await import('../../scripts/db/migrate-cli.ts');
		await runMigrateCli(['node', 'migrate-cli.ts']);

		expect(mockSelect).toHaveBeenCalledWith(
			expect.objectContaining({
				default: 'cancel',
			}),
		);
		expect(stderr).toMatch(/Cancelado/);
		expect(mockPreflightMigrate).not.toHaveBeenCalled();
		expect(mockOrchestrateMigrate).not.toHaveBeenCalled();
		expect(process.exitCode).toBeUndefined();
	});

	it('guided action Cancelar after preflight never applies', async () => {
		Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
		Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
		mockPreflightMigrate.mockReturnValue({
			target: 'local',
			mode: 'preflight',
			pendingVersions: ['20260806120000'],
			planId: 'plan-local-1',
		});
		mockSelect.mockResolvedValueOnce('cancel');

		const { runMigrateCli } = await import('../../scripts/db/migrate-cli.ts');
		await runMigrateCli(['node', 'migrate-cli.ts', '--target', 'local']);

		expect(mockPreflightMigrate).toHaveBeenCalled();
		expect(mockSelect).toHaveBeenCalledWith(
			expect.objectContaining({
				default: 'cancel',
				message: expect.stringMatching(/acción/i),
			}),
		);
		expect(mockOrchestrateMigrate).not.toHaveBeenCalled();
		expect(stderr).toMatch(/Cancelado/);
	});

	it('redirects Production --apply to prod:apply --schema and never orchestrates migrate apply', async () => {
		mockApplyProductionApplyPlan.mockResolvedValue({
			plan: { planId: 'plan-prod', items: [], scope: { schema: true, slugs: [] } },
			wrote: true,
			outcomes: [{ id: 'schema', outcome: 'APPLIED_AND_VERIFIED' }],
		});

		const { runMigrateCli } = await import('../../scripts/db/migrate-cli.ts');
		await runMigrateCli(['node', 'migrate-cli.ts', '--target', 'production', '--apply']);

		expect(mockOrchestrateMigrate).not.toHaveBeenCalled();
		expect(mockApplyProductionApplyPlan).toHaveBeenCalledWith(
			expect.objectContaining({
				apply: true,
				schema: true,
				inspectAll: false,
			}),
		);
		expect(stderr).toMatch(/prod:apply -- --schema/);
	});

	it('keeps Production preflight on the schema primitive without issuing a permit', async () => {
		mockPreflightMigrate.mockReturnValue({
			target: 'production',
			mode: 'preflight',
			pendingVersions: ['20260812210000'],
			planId: 'plan-prod-preflight',
		});

		const { runMigrateCli } = await import('../../scripts/db/migrate-cli.ts');
		await runMigrateCli(['node', 'migrate-cli.ts', '--target', 'production']);

		expect(mockPreflightMigrate).toHaveBeenCalled();
		expect(mockOrchestrateMigrate).not.toHaveBeenCalled();
		expect(mockApplyProductionApplyPlan).not.toHaveBeenCalled();
		expect(stderr).toMatch(/prod:apply -- --schema/);
	});
});
