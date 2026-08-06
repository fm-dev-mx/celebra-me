import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OperatorError } from '../../scripts/db/operator-cli-ux.ts';

const mockDiscover = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockOrchestrate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockSelect = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('../../scripts/provision/invitation-promotion-candidates.ts', () => ({
	discoverInvitationPromotionCandidates: (...args: unknown[]) => mockDiscover(...args),
}));

jest.mock('../../scripts/provision/invitation-promotion-orchestrator.ts', () => ({
	orchestrateInvitationPromotion: (...args: unknown[]) => mockOrchestrate(...args),
}));

jest.mock('@inquirer/prompts', () => ({
	select: (...args: unknown[]) => mockSelect(...args),
}));

describe('invitation promote guided CLI seams', () => {
	const originalStdin = process.stdin.isTTY;
	const originalStderr = process.stderr.isTTY;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
		mockDiscover.mockResolvedValue({
			candidates: [
				{
					slug: 'demo',
					title: 'Demo',
					route: '/boda/demo',
					disposition: 'ready',
					selectable: true,
					reason: 'ready',
					deliveryScope: 'content-and-assets',
					packageInput: {
						packageData: {
							packageHash: 'pkg',
							invitation: { slug: 'demo' },
						},
					},
				},
			],
			readyCount: 1,
			inSyncCount: 0,
			attentionCount: 0,
		});
		mockOrchestrate.mockResolvedValue({
			status: 'PROMOTED',
			slug: 'demo',
			packageHash: 'pkg',
			sourceHash: 's',
			projectionHash: 'p',
			assetManifestHash: 'a',
			targetDbUrl: 'postgresql://secret@db.example/postgres',
			schema: { state: 'CURRENT', detail: 'ok' },
			backup: { required: true, acceptable: true, detail: 'ok' },
			divergence: {
				safeManagedChanges: [],
				targetOwnedDifferences: [],
				managedDivergences: [],
				conflicts: [],
			},
			verification: { ok: true, detail: 'ok' },
		});
	});

	afterEach(() => {
		Object.defineProperty(process.stdin, 'isTTY', {
			value: originalStdin,
			configurable: true,
		});
		Object.defineProperty(process.stderr, 'isTTY', {
			value: originalStderr,
			configurable: true,
		});
		delete process.env.CELEBRA_TASK_SCOPE;
		process.exitCode = undefined;
		jest.restoreAllMocks();
	});

	it('fails closed without TTY when no args are provided', async () => {
		Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
		Object.defineProperty(process.stderr, 'isTTY', { value: false, configurable: true });
		const { runInvitationPromoteCli } =
			await import('../../scripts/provision/invitation-promote-cli.ts');
		process.exitCode = undefined;
		await runInvitationPromoteCli([]);
		expect(process.exitCode).toBe(1);
		expect(mockDiscover).not.toHaveBeenCalled();
		expect(mockOrchestrate).not.toHaveBeenCalled();
	});

	it('defaults Cancelar and never auto-applies a single ready candidate', async () => {
		Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
		Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
		mockSelect.mockImplementation(async (...args: unknown[]) => {
			const input = args[0] as { default?: string; choices: unknown[] };
			expect(input.default).toBe('cancel');
			expect(input.choices[0]).toMatchObject({ value: 'cancel' });
			return 'cancel';
		});

		const { runInvitationPromoteCli } =
			await import('../../scripts/provision/invitation-promote-cli.ts');
		process.exitCode = undefined;
		await runInvitationPromoteCli([]);
		expect(mockSelect).toHaveBeenCalled();
		expect(mockOrchestrate).not.toHaveBeenCalled();
	});

	it('surfaces CELEBRA_TASK_SCOPE refuse from the shared orchestrator', async () => {
		Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
		Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
		process.env.CELEBRA_TASK_SCOPE = 'preview:demo:apply';
		mockSelect.mockResolvedValue('demo');
		mockOrchestrate.mockRejectedValue(
			new OperatorError({
				title: 'Autorización de Preview no válida en Production',
				cause: 'CELEBRA_TASK_SCOPE autoriza automatización de Preview y no aprueba promoción a Production.',
				code: 'CONFIRMATION_REQUIRED',
				remediation: ['Quite CELEBRA_TASK_SCOPE y ejecute en una TTY del propietario.'],
				retryCommand: 'pnpm invitation:promote',
			}),
		);

		const { runInvitationPromoteCli } =
			await import('../../scripts/provision/invitation-promote-cli.ts');
		process.exitCode = undefined;
		await runInvitationPromoteCli([]);
		expect(mockOrchestrate).toHaveBeenCalled();
		expect(process.exitCode).toBe(1);
	});

	it('strips targetDbUrl from public JSON reports', async () => {
		const { toPublicPromotionReport } =
			await import('../../scripts/provision/invitation-promote-cli.ts');
		const publicReport = toPublicPromotionReport({
			status: 'PROMOTED',
			slug: 'demo',
			targetDbUrl: 'postgresql://secret@db.example/postgres',
		} as never);
		expect(publicReport).not.toHaveProperty('targetDbUrl');
		expect(JSON.stringify(publicReport)).not.toContain('secret');
	});

	it('keeps CLI free of direct requireOwnerProductionApply / runPromotionApply', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-promote-cli.ts'),
			'utf8',
		);
		expect(source).toContain('orchestrateInvitationPromotion');
		expect(source).not.toContain('requireOwnerProductionApply');
		expect(source).not.toMatch(/runPromotionApply\s*\(/);
	});
});
