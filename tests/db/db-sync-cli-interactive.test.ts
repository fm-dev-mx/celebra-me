/**
 * Behavioral db:sync interactive wizard — Cancelar defaults and automation-first notice.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSelect = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockOrchestrate = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('@inquirer/prompts', () => ({
	select: (...args: unknown[]) => mockSelect(...args),
	confirm: jest.fn(),
}));

jest.mock('../../scripts/db/db-sync-orchestrator.ts', () => ({
	orchestrateDbSync: (...args: unknown[]) => mockOrchestrate(...args),
}));

describe('db-sync interactive Cancelar defaults', () => {
	const originalEnv = { ...process.env };
	let stderr = '';
	let writeErr: (chunk: string | Uint8Array) => boolean;

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
		Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
		Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
		process.exitCode = undefined;

		mockOrchestrate.mockResolvedValue({
			schemaVersion: '1.0.0',
			command: 'db:sync',
			mode: 'diagnose',
			direction: null,
			planId: null,
			ok: true,
			status: 'READY',
			targets: [],
			evidenceClass: 'mixed',
			drifts: [],
			failures: [],
			artifacts: [],
			blockers: [],
		});
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		process.stderr.write = writeErr;
		process.exitCode = undefined;
	});

	it('mode Cancelar default cancels before mutation orchestration', async () => {
		mockSelect.mockResolvedValueOnce('cancel');
		const { runDbSyncCli } = await import('../../scripts/db/db-sync-cli.ts');
		await runDbSyncCli([]);

		expect(mockSelect).toHaveBeenCalledWith(
			expect.objectContaining({
				default: 'cancel',
				message: expect.stringMatching(/modo/i),
			}),
		);
		expect(mockOrchestrate).toHaveBeenCalledTimes(1);
		expect(mockOrchestrate).toHaveBeenCalledWith(expect.objectContaining({ mode: 'diagnose' }));
		expect(process.exitCode).toBe(1);
		expect(stderr).toMatch(/automatizaci|compatibilidad|Cancelar|CANCELLED/i);
	});

	it('direction Cancelar default cancels after diagnose without apply', async () => {
		mockSelect.mockResolvedValueOnce('plan').mockResolvedValueOnce('cancel');
		const { runDbSyncCli } = await import('../../scripts/db/db-sync-cli.ts');
		await runDbSyncCli([]);

		expect(mockSelect.mock.calls[1]?.[0]).toEqual(
			expect.objectContaining({
				default: 'cancel',
				message: expect.stringMatching(/direcci/i),
			}),
		);
		expect(
			mockOrchestrate.mock.calls.every(
				(call) => (call[0] as { mode?: string }).mode !== 'apply',
			),
		).toBe(true);
		expect(process.exitCode).toBe(1);
	});
});
