import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { OperatorError } from '../../scripts/db/operator-cli-ux.ts';
import {
	orchestrateInvitationPromotion,
	resolvePromotionUpdateScope,
} from '../../scripts/provision/invitation-promotion-orchestrator.ts';
import type {
	PromotionApplyReport,
	PromotionPreflightReport,
} from '../../scripts/provision/invitation-promote.ts';

const PROD_URL = 'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres';

function packageData() {
	return {
		packageHash: 'abcdef0123456789pkg',
		sourceHash: 'src',
		metadataHash: 'meta',
		projectionHash: 'proj',
		assetManifestHash: 'assets',
		invitation: { slug: 'demo', eventType: 'boda', title: 'Demo' },
	};
}

function preflight(overrides: Partial<PromotionPreflightReport> = {}): PromotionPreflightReport {
	return {
		status: 'PROMOTABLE',
		slug: 'demo',
		packageHash: 'abcdef0123456789pkg',
		sourceHash: 'src',
		projectionHash: 'proj',
		assetManifestHash: 'assets',
		targetDbUrl: PROD_URL,
		schema: { state: 'CURRENT', detail: 'ok' },
		backup: {
			required: false,
			acceptable: true,
			detail: 'pending',
			canonicalCommand: 'pnpm db:prod:backup:critical',
		},
		divergence: {
			safeManagedChanges: [{ path: 'a' }],
			targetOwnedDifferences: [],
			managedDivergences: [],
			conflicts: [],
			blocksPromotion: false,
		},
		engineResult: { plan: { planId: 'plan-aaa', invitationTitle: 'Demo' } },
		...overrides,
	} as PromotionPreflightReport;
}

describe('resolvePromotionUpdateScope', () => {
	it('prefers explicit updateScope over deliveryScope', () => {
		expect(
			resolvePromotionUpdateScope({
				updateScope: 'content-only',
				deliveryScope: 'content-and-assets',
			}),
		).toBe('content-only');
	});

	it('uses definition deliveryScope when updateScope is omitted', () => {
		expect(resolvePromotionUpdateScope({ deliveryScope: 'content-and-assets' })).toBe(
			'content-and-assets',
		);
	});
});

describe('invitation promotion orchestrator', () => {
	const runPreflight = jest.fn<(...args: unknown[]) => Promise<PromotionPreflightReport>>();
	const runApply = jest.fn<(...args: unknown[]) => Promise<PromotionApplyReport>>();
	const requireOwnerApply = jest.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
	const ensureReleaseEvidence = jest.fn();
	const ensureBackup = jest.fn(() => ({
		manifestPath: '.agent/tmp/backups/promote-pre/manifest.json',
		reused: true,
	}));
	const revalidateBackup = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
		delete process.env.CELEBRA_TASK_SCOPE;
		runPreflight.mockResolvedValue(preflight());
		runApply.mockResolvedValue({
			...preflight(),
			status: 'PROMOTED',
			verification: { ok: true, detail: 'ok' },
		} as PromotionApplyReport);
	});

	afterEach(() => {
		delete process.env.CELEBRA_TASK_SCOPE;
		jest.restoreAllMocks();
	});

	it('refuses CELEBRA_TASK_SCOPE before preflight or writes', async () => {
		process.env.CELEBRA_TASK_SCOPE = 'preview:demo:apply';
		await expect(
			orchestrateInvitationPromotion({
				packageData: packageData() as never,
				quiet: true,
				runPreflight: runPreflight as never,
				runApply: runApply as never,
				requireOwnerApply: requireOwnerApply as never,
				ensureReleaseEvidence: ensureReleaseEvidence as never,
				ensureBackup: ensureBackup as never,
				revalidateBackup: revalidateBackup as never,
			}),
		).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' } satisfies Partial<OperatorError>);
		expect(runPreflight).not.toHaveBeenCalled();
		expect(ensureBackup).not.toHaveBeenCalled();
		expect(requireOwnerApply).not.toHaveBeenCalled();
		expect(runApply).not.toHaveBeenCalled();
	});

	it('passes deliveryScope as updateScope so first-time asset uploads are planned', async () => {
		await orchestrateInvitationPromotion({
			packageData: packageData() as never,
			deliveryScope: 'content-and-assets',
			quiet: true,
			runPreflight: runPreflight as never,
			runApply: runApply as never,
			requireOwnerApply: requireOwnerApply as never,
			ensureReleaseEvidence: ensureReleaseEvidence as never,
			ensureBackup: ensureBackup as never,
			revalidateBackup: revalidateBackup as never,
		});
		expect(runPreflight).toHaveBeenCalledWith(
			expect.objectContaining({ updateScope: 'content-and-assets' }),
		);
		expect(runApply).toHaveBeenCalledWith(
			expect.objectContaining({ updateScope: 'content-and-assets' }),
		);
	});

	it('binds the reviewed plan into the post-backup rebuild preflight', async () => {
		const reviewedPlan = { planId: 'plan-aaa', invitationTitle: 'Demo' };
		runPreflight
			.mockResolvedValueOnce(preflight({ engineResult: { plan: reviewedPlan } as never }))
			.mockResolvedValueOnce(
				preflight({
					engineResult: { plan: reviewedPlan } as never,
					backup: {
						required: true,
						acceptable: true,
						detail: 'ok',
						createdAt: 't',
						canonicalCommand: 'pnpm db:prod:backup:critical',
					},
				}),
			);
		await orchestrateInvitationPromotion({
			packageData: packageData() as never,
			quiet: true,
			runPreflight: runPreflight as never,
			runApply: runApply as never,
			requireOwnerApply: requireOwnerApply as never,
			ensureReleaseEvidence: ensureReleaseEvidence as never,
			ensureBackup: ensureBackup as never,
			revalidateBackup: revalidateBackup as never,
		});
		expect(runPreflight).toHaveBeenNthCalledWith(
			1,
			expect.not.objectContaining({ plan: expect.anything() }),
		);
		expect(runPreflight).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ plan: reviewedPlan }),
		);
	});

	it('orders preflight → release → backup → rebuild → gate → apply', async () => {
		const order: string[] = [];
		runPreflight.mockImplementation(async () => {
			order.push('preflight');
			return preflight({
				backup: {
					required: true,
					acceptable: true,
					detail: 'ok',
					createdAt: 't',
					canonicalCommand: 'pnpm db:prod:backup:critical',
				},
			});
		});
		ensureReleaseEvidence.mockImplementation(() => {
			order.push('release');
		});
		ensureBackup.mockImplementation(() => {
			order.push('backup');
			return {
				manifestPath: '.agent/tmp/backups/promote-pre/manifest.json',
				reused: false,
			};
		});
		revalidateBackup.mockImplementation(() => {
			order.push('revalidate');
		});
		requireOwnerApply.mockImplementation(async () => {
			order.push('gate');
		});
		runApply.mockImplementation(async () => {
			order.push('apply');
			return {
				...preflight(),
				status: 'PROMOTED',
				verification: { ok: true, detail: 'ok' },
			} as PromotionApplyReport;
		});

		await orchestrateInvitationPromotion({
			packageData: packageData() as never,
			quiet: true,
			runPreflight: runPreflight as never,
			runApply: runApply as never,
			requireOwnerApply: requireOwnerApply as never,
			ensureReleaseEvidence: ensureReleaseEvidence as never,
			ensureBackup: ensureBackup as never,
			revalidateBackup: revalidateBackup as never,
		});

		expect(order).toEqual([
			'preflight',
			'release',
			'backup',
			'preflight',
			'revalidate',
			'gate',
			'apply',
		]);
		expect(requireOwnerApply).toHaveBeenCalledWith(
			expect.objectContaining({
				operationVerb: 'PROMOTE',
				bindingHex: 'abcdef0123456789pkg',
				omitSummary: true,
			}),
		);
	});

	it('blocks PLAN_DRIFT before owner gate when rebuilt plan diverges', async () => {
		const reviewedPlan = { planId: 'plan-aaa', invitationTitle: 'Demo' };
		runPreflight
			.mockResolvedValueOnce(preflight({ engineResult: { plan: reviewedPlan } as never }))
			.mockResolvedValueOnce(
				preflight({
					engineResult: { plan: { planId: 'plan-BBB', invitationTitle: 'Demo' } } as never,
				}),
			);

		await expect(
			orchestrateInvitationPromotion({
				packageData: packageData() as never,
				quiet: true,
				runPreflight: runPreflight as never,
				runApply: runApply as never,
				requireOwnerApply: requireOwnerApply as never,
				ensureReleaseEvidence: ensureReleaseEvidence as never,
				ensureBackup: ensureBackup as never,
				revalidateBackup: revalidateBackup as never,
			}),
		).rejects.toMatchObject({ code: 'PLAN_DRIFT' } satisfies Partial<OperatorError>);

		// Binding must not mask drift: rebuild still receives the reviewed plan, but a divergent
		// recomputed planId from dry-run fails closed before owner gate / apply.
		expect(runPreflight).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ plan: reviewedPlan }),
		);
		expect(requireOwnerApply).not.toHaveBeenCalled();
		expect(runApply).not.toHaveBeenCalled();
	});

	it('returns IN_SYNC without calling owner gate or apply', async () => {
		runPreflight.mockResolvedValue(preflight({ status: 'IN_SYNC' }));
		const report = await orchestrateInvitationPromotion({
			packageData: packageData() as never,
			quiet: true,
			runPreflight: runPreflight as never,
			runApply: runApply as never,
			requireOwnerApply: requireOwnerApply as never,
			ensureReleaseEvidence: ensureReleaseEvidence as never,
			ensureBackup: ensureBackup as never,
			revalidateBackup: revalidateBackup as never,
		});
		expect(report.status).toBe('IN_SYNC');
		expect(requireOwnerApply).not.toHaveBeenCalled();
		expect(runApply).not.toHaveBeenCalled();
		expect(ensureBackup).not.toHaveBeenCalled();
	});
});
