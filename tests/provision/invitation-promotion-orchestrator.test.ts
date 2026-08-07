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
import { classifyPromotionRecoveryRisk } from '../../scripts/provision/promotion-recovery-risk.ts';
import {
	revalidatePromotionVolatilePreconditions,
	type RevalidatePromotionVolatilePreconditionsInput,
} from '../../scripts/provision/promotion-volatile-revalidation.ts';

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
		productionProjectRef: 'ineitkdkyrxqyressllp',
		approval: { planId: 'preview-plan' },
		engineResult: {
			actions: [
				{ resource: 'invitation', name: 'demo', action: 'replace', detail: 'content' },
				{
					resource: 'invitation_content_drafts',
					name: 'demo-draft',
					action: 'replace',
					detail: 'content',
				},
			],
			plan: {
				planId: 'plan-aaa',
				invitationTitle: 'Demo',
				sourceHash: 'src',
				packageHash: 'abcdef0123456789pkg',
				functionalChanges: [],
				storageOps: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
				targetPreconditions: {},
			},
		},
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

describe('classifyPromotionRecoveryRisk', () => {
	it('classifies routine content-only plans without destructive asset or identity work', () => {
		expect(
			classifyPromotionRecoveryRisk({
				reviewed: preflight(),
				updateScope: 'content-only',
				assetPolicy: 'preserve',
			}),
		).toEqual({
			level: 'routine',
			reasons: ['content-only-managed-preimage-recovery'],
		});
	});

	it('requires critical recovery for asset overwrite intent', () => {
		const reviewed = preflight();
		reviewed.engineResult!.actions.push({
			resource: 'invitation_assets',
			name: 'hero',
			action: 'replace',
			detail: 'overwrite',
		});
		reviewed.engineResult!.plan.storageOps.overwrites = 1;
		const risk = classifyPromotionRecoveryRisk({
			reviewed,
			updateScope: 'content-only',
			assetPolicy: 'sync',
		});
		expect(risk.level).toBe('critical');
		expect(risk.reasons).toEqual(expect.arrayContaining(['asset-replace', 'asset-overwrite']));
	});

	it('fails closed when the plan cannot be classified', () => {
		const risk = classifyPromotionRecoveryRisk({
			reviewed: preflight({ engineResult: undefined }),
			updateScope: 'content-only',
		});
		expect(risk).toEqual({ level: 'critical', reasons: ['unclassifiable-plan'] });
	});
});

describe('revalidatePromotionVolatilePreconditions', () => {
	function reviewedWithVolatileState(): PromotionPreflightReport {
		const reviewed = preflight();
		reviewed.schema = {
			state: 'CURRENT',
			migrationHead: '20260801000000',
			pendingMigrations: [],
			extraMigrations: [],
			compatible: true,
			detail: 'ok',
		};
		reviewed.approval = {
			...reviewed.approval,
			approvalState: 'approved',
			packageHash: 'abcdef0123456789pkg',
			sourceHash: 'src',
			metadataHash: 'meta',
			canonicalProjectionHash: 'proj',
			materializedProjectionHash: 'preview-proj',
			assetManifestHash: 'assets',
			previewProjectRef: 'previewproject',
			intendedProductionProjectRef: 'ineitkdkyrxqyressllp',
			hostedValidation: { projectionHash: 'preview-proj' },
		} as never;
		Object.assign(reviewed.engineResult!.plan, {
			verifiedProjectRef: 'ineitkdkyrxqyressllp',
			targetPreconditions: {
				sourceHash: 'src',
				packageHash: 'abcdef0123456789pkg',
				assetManifestHash: 'assets',
				verifiedProjectRef: 'ineitkdkyrxqyressllp',
				targetInvitationId: '11111111-1111-4111-8111-111111111111',
				targetOwnerUserId: '22222222-2222-4222-8222-222222222222',
				existingDraftUpdatedAt: '2026-08-06T00:00:00.000Z',
				existingPublishedVersion: 7,
				assetStateHash: 'asset-state',
			},
		});
		return reviewed;
	}

	it('checks retained target, schema, approval, project, and asset evidence', async () => {
		const reviewed = reviewedWithVolatileState();
		const computeAssetStateHash = jest.fn(async () => 'asset-state');
		const result = await revalidatePromotionVolatilePreconditions({
			reviewed,
			packageData: packageData() as never,
			getProductionDbUrl: () => ({ url: PROD_URL }),
			evaluateSchema: () => reviewed.schema,
			runLiveVerification: async () => ({ ok: true }) as never,
			verifyApproval: () => reviewed.approval!,
			readTargetState: () => ({
				targetInvitationId: '11111111-1111-4111-8111-111111111111',
				targetOwnerUserId: '22222222-2222-4222-8222-222222222222',
				existingDraftUpdatedAt: '2026-08-06T00:00:00.000Z',
				existingPublishedVersion: 7,
			}),
			computeAssetStateHash,
		});
		expect(result.engineResult?.plan).toBe(reviewed.engineResult?.plan);
		expect(computeAssetStateHash).toHaveBeenCalledTimes(1);
	});

	it('throws PLAN_DRIFT when a volatile target version changes', async () => {
		const reviewed = reviewedWithVolatileState();
		await expect(
			revalidatePromotionVolatilePreconditions({
				reviewed,
				packageData: packageData() as never,
				getProductionDbUrl: () => ({ url: PROD_URL }),
				evaluateSchema: () => reviewed.schema,
				runLiveVerification: async () => ({ ok: true }) as never,
				verifyApproval: () => reviewed.approval!,
				readTargetState: () => ({
					targetInvitationId: '11111111-1111-4111-8111-111111111111',
					targetOwnerUserId: '22222222-2222-4222-8222-222222222222',
					existingDraftUpdatedAt: '2026-08-06T00:00:00.000Z',
					existingPublishedVersion: 8,
				}),
				computeAssetStateHash: async () => 'asset-state',
			}),
		).rejects.toMatchObject({ code: 'PLAN_DRIFT' } satisfies Partial<OperatorError>);
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
		coverage: {
			covered: true,
			reason: 'covered',
			maxAgeMs: 15 * 60 * 1000,
			manifest: {
				createdAt: '2026-08-06T00:00:00.000Z',
				projectRef: 'ineitkdkyrxqyressllp',
			},
		},
	}));
	const revalidateBackup = jest.fn();
	const revalidateVolatile = jest.fn(
		async (input: RevalidatePromotionVolatilePreconditionsInput) => input.reviewed,
	);

	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
		delete process.env.CELEBRA_TASK_SCOPE;
		requireOwnerApply.mockImplementation(async () => undefined);
		ensureReleaseEvidence.mockImplementation(() => undefined);
		ensureBackup.mockImplementation(() => ({
			manifestPath: '.agent/tmp/backups/promote-pre/manifest.json',
			reused: true,
			coverage: {
				covered: true,
				reason: 'covered',
				maxAgeMs: 15 * 60 * 1000,
				manifest: {
					createdAt: '2026-08-06T00:00:00.000Z',
					projectRef: 'ineitkdkyrxqyressllp',
				},
			},
		}));
		revalidateBackup.mockImplementation(() => undefined);
		runPreflight.mockResolvedValue(preflight());
		revalidateVolatile.mockImplementation(async (input) => input.reviewed);
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
			revalidateVolatile,
		});
		expect(runPreflight).toHaveBeenCalledWith(
			expect.objectContaining({ updateScope: 'content-and-assets' }),
		);
		expect(runApply).toHaveBeenCalledWith(
			expect.objectContaining({ updateScope: 'content-and-assets' }),
		);
	});

	it('retains the reviewed plan and runs compact revalidation without a second preflight', async () => {
		const reviewed = preflight();
		runPreflight.mockResolvedValueOnce(reviewed);
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
			revalidateVolatile,
		});
		expect(runPreflight).toHaveBeenCalledTimes(1);
		expect(revalidateVolatile).toHaveBeenCalledWith(
			expect.objectContaining({
				reviewed,
				packageData: packageData(),
			}),
		);
	});

	it('orders critical recovery before compact revalidation and apply', async () => {
		const order: string[] = [];
		runPreflight.mockImplementation(async () => {
			order.push('preflight');
			return preflight();
		});
		ensureReleaseEvidence.mockImplementation(() => {
			order.push('release');
		});
		ensureBackup.mockImplementation(() => {
			order.push('backup');
			return {
				manifestPath: '.agent/tmp/backups/promote-pre/manifest.json',
				reused: false,
				coverage: {
					covered: true,
					reason: 'covered',
					maxAgeMs: 15 * 60 * 1000,
					manifest: {
						createdAt: '2026-08-06T00:00:00.000Z',
						projectRef: 'ineitkdkyrxqyressllp',
					},
				},
			};
		});
		revalidateBackup.mockImplementation(() => {
			order.push('backup-revalidate');
		});
		revalidateVolatile.mockImplementation(async (input) => {
			order.push('volatile');
			return input.reviewed;
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
			deliveryScope: 'content-and-assets',
			quiet: true,
			runPreflight: runPreflight as never,
			runApply: runApply as never,
			requireOwnerApply: requireOwnerApply as never,
			ensureReleaseEvidence: ensureReleaseEvidence as never,
			ensureBackup: ensureBackup as never,
			revalidateBackup: revalidateBackup as never,
			revalidateVolatile,
		});

		expect(order).toEqual([
			'preflight',
			'release',
			'backup',
			'volatile',
			'backup-revalidate',
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

	it('skips full critical backup for routine content-only recovery', async () => {
		await orchestrateInvitationPromotion({
			packageData: packageData() as never,
			deliveryScope: 'content-only',
			assetPolicy: 'preserve',
			quiet: true,
			runPreflight: runPreflight as never,
			runApply: runApply as never,
			requireOwnerApply: requireOwnerApply as never,
			ensureReleaseEvidence: ensureReleaseEvidence as never,
			ensureBackup: ensureBackup as never,
			revalidateBackup: revalidateBackup as never,
			revalidateVolatile,
		});

		expect(ensureReleaseEvidence).toHaveBeenCalledTimes(1);
		expect(ensureBackup).not.toHaveBeenCalled();
		expect(revalidateBackup).not.toHaveBeenCalled();
		expect(revalidateVolatile).toHaveBeenCalledTimes(1);
		expect(runPreflight).toHaveBeenCalledTimes(1);
		expect(runApply).toHaveBeenCalledWith(
			expect.objectContaining({
				preflight: expect.objectContaining({
					backup: expect.objectContaining({
						required: false,
						acceptable: true,
						detail: expect.stringContaining('managed provenance'),
					}),
				}),
			}),
		);
	});

	it('reuses evidence while owner confirmation handles an in-gate retry', async () => {
		requireOwnerApply.mockImplementation(async () => undefined);
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
			revalidateVolatile,
		});

		expect(requireOwnerApply).toHaveBeenCalledTimes(1);
		expect(runPreflight).toHaveBeenCalledTimes(1);
		expect(ensureReleaseEvidence).toHaveBeenCalledTimes(1);
		expect(ensureBackup).toHaveBeenCalledTimes(1);
		expect(revalidateVolatile).toHaveBeenCalledTimes(1);
	});

	it('blocks PLAN_DRIFT from compact revalidation before owner gate', async () => {
		revalidateVolatile.mockRejectedValueOnce(
			new OperatorError({
				title: 'El plan cambió',
				cause: 'Target version changed.',
				code: 'PLAN_DRIFT',
				remediation: ['Reejecute el flujo.'],
			}),
		);

		await expect(
			orchestrateInvitationPromotion({
				packageData: packageData() as never,
				deliveryScope: 'content-and-assets',
				quiet: true,
				runPreflight: runPreflight as never,
				runApply: runApply as never,
				requireOwnerApply: requireOwnerApply as never,
				ensureReleaseEvidence: ensureReleaseEvidence as never,
				ensureBackup: ensureBackup as never,
				revalidateBackup: revalidateBackup as never,
				revalidateVolatile,
			}),
		).rejects.toMatchObject({ code: 'PLAN_DRIFT' } satisfies Partial<OperatorError>);

		expect(runPreflight).toHaveBeenCalledTimes(1);
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
