import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OperatorError } from '../../scripts/db/operator-cli-ux.ts';
import { orchestrateInvitationPromotion } from '../../scripts/provision/invitation-promotion-orchestrator.ts';
import type {
	PromotionApplyReport,
	PromotionPreflightReport,
} from '../../scripts/provision/invitation-promote.ts';
import { classifyPromotionRecoveryRisk } from '../../scripts/provision/promotion-recovery-risk.ts';
import {
	revalidatePromotionVolatilePreconditions,
	reviewedInvitationIdentityHolds,
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

	it('treats content-and-assets with Storage 0 as routine (scope label is not risk)', () => {
		expect(
			classifyPromotionRecoveryRisk({
				reviewed: preflight(),
				updateScope: 'content-and-assets',
				assetPolicy: 'missing',
			}),
		).toEqual({
			level: 'routine',
			reasons: ['managed-content-preimage-recovery-no-asset-mutations'],
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

	it('requires critical recovery for asset upload / create intent', () => {
		const reviewed = preflight();
		reviewed.engineResult!.actions.push({
			resource: 'invitation_assets',
			name: 'hero',
			action: 'create',
			detail: 'upload',
		});
		reviewed.engineResult!.plan.storageOps.uploads = 1;
		const risk = classifyPromotionRecoveryRisk({
			reviewed,
			updateScope: 'content-and-assets',
			assetPolicy: 'missing',
		});
		expect(risk.level).toBe('critical');
		expect(risk.reasons).toEqual(expect.arrayContaining(['asset-create', 'asset-upload']));
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
				// Diagnostic-only; must not fail-close revalidation when present.
				assetStateHash: 'asset-state-from-planning-probe',
			},
		});
		return reviewed;
	}

	function happyDeps(reviewed: PromotionPreflightReport) {
		return {
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
		};
	}

	it('accepts a still-null Production managed identity as the planned backfill', () => {
		expect(
			reviewedInvitationIdentityHolds({
				plannedCreate: false,
				matches: [
					{
						id: '11111111-1111-4111-8111-111111111111',
						created_by: '22222222-2222-4222-8222-222222222222',
						managed_identity_id: null,
						slug: 'demo',
					},
				],
				targetInvitationId: '11111111-1111-4111-8111-111111111111',
				targetOwnerUserId: '22222222-2222-4222-8222-222222222222',
				expectedManagedIdentityId: '3c4d5e6f-7081-42a3-b4c5-d6e7f8091a2b',
				expectedSlug: 'demo',
			}),
		).toBe(true);
	});

	it('rejects a create plan when a Production identity already exists', () => {
		expect(
			reviewedInvitationIdentityHolds({
				plannedCreate: true,
				matches: [
					{
						id: '11111111-1111-4111-8111-111111111111',
						created_by: '22222222-2222-4222-8222-222222222222',
						managed_identity_id: null,
						slug: 'demo',
					},
				],
				targetInvitationId: '11111111-1111-4111-8111-111111111111',
				targetOwnerUserId: '22222222-2222-4222-8222-222222222222',
				expectedManagedIdentityId: '3c4d5e6f-7081-42a3-b4c5-d6e7f8091a2b',
				expectedSlug: 'demo',
			}),
		).toBe(false);
	});

	it('rejects a different Production managed identity as concurrent drift', () => {
		expect(
			reviewedInvitationIdentityHolds({
				plannedCreate: false,
				matches: [
					{
						id: '11111111-1111-4111-8111-111111111111',
						created_by: '22222222-2222-4222-8222-222222222222',
						managed_identity_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
						slug: 'demo',
					},
				],
				targetInvitationId: '11111111-1111-4111-8111-111111111111',
				targetOwnerUserId: '22222222-2222-4222-8222-222222222222',
				expectedManagedIdentityId: '3c4d5e6f-7081-42a3-b4c5-d6e7f8091a2b',
				expectedSlug: 'demo',
			}),
		).toBe(false);
	});

	it('accepts retained target, schema, approval, and project evidence (happy path)', async () => {
		const reviewed = reviewedWithVolatileState();
		const result = await revalidatePromotionVolatilePreconditions(happyDeps(reviewed));
		expect(result.engineResult?.plan).toBe(reviewed.engineResult?.plan);
		expect(result.productionProjectRef).toBe('ineitkdkyrxqyressllp');
		expect(result.targetDbUrl).toBe(PROD_URL);
	});

	it('does not fail-close on diagnostic assetStateHash (CDN probe drift)', async () => {
		const reviewed = reviewedWithVolatileState();
		// Planning left a probe fingerprint; revalidation must not re-probe or compare it.
		expect(reviewed.engineResult!.plan.targetPreconditions.assetStateHash).toBeTruthy();
		await expect(
			revalidatePromotionVolatilePreconditions(happyDeps(reviewed)),
		).resolves.toMatchObject({ packageHash: reviewed.packageHash });
	});

	it('throws PLAN_DRIFT when a volatile published version changes', async () => {
		const reviewed = reviewedWithVolatileState();
		await expect(
			revalidatePromotionVolatilePreconditions({
				...happyDeps(reviewed),
				readTargetState: () => ({
					targetInvitationId: '11111111-1111-4111-8111-111111111111',
					targetOwnerUserId: '22222222-2222-4222-8222-222222222222',
					existingDraftUpdatedAt: '2026-08-06T00:00:00.000Z',
					existingPublishedVersion: 8,
				}),
			}),
		).rejects.toMatchObject({ code: 'PLAN_DRIFT' } satisfies Partial<OperatorError>);
	});

	it('throws PLAN_DRIFT when package identity changes after review', async () => {
		const reviewed = reviewedWithVolatileState();
		await expect(
			revalidatePromotionVolatilePreconditions({
				...happyDeps(reviewed),
				packageData: { ...packageData(), packageHash: 'different-package-hash' } as never,
			}),
		).rejects.toMatchObject({ code: 'PLAN_DRIFT' } satisfies Partial<OperatorError>);
	});

	it('throws PLAN_DRIFT when schema lifecycle changes after review', async () => {
		const reviewed = reviewedWithVolatileState();
		await expect(
			revalidatePromotionVolatilePreconditions({
				...happyDeps(reviewed),
				evaluateSchema: () => ({
					...reviewed.schema,
					state: 'BEHIND',
					compatible: false,
					pendingMigrations: ['20260802000000'],
				}),
			}),
		).rejects.toMatchObject({ code: 'PLAN_DRIFT' } satisfies Partial<OperatorError>);
	});

	it('throws PLAN_DRIFT when Preview approval identity changes after review', async () => {
		const reviewed = reviewedWithVolatileState();
		await expect(
			revalidatePromotionVolatilePreconditions({
				...happyDeps(reviewed),
				verifyApproval: () =>
					({
						...reviewed.approval!,
						materializedProjectionHash: 'different-hosted-projection',
					}) as never,
			}),
		).rejects.toMatchObject({ code: 'PLAN_DRIFT' } satisfies Partial<OperatorError>);
	});

	it('source contract: never imports Storage probe hashing from the import engine', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/promotion-volatile-revalidation.ts'),
			'utf8',
		);
		expect(source).not.toContain('invitation-import-engine');
		expect(source).not.toContain('computePromotionVolatileAssetStateHash');
		expect(source).not.toContain('computeAssetStateHash');
		expect(source).not.toContain('Production asset state changed after review');
		expect(source).toContain('verifyPlanPreconditions');
	});
});

function preflightWithAssetOverwrite(): PromotionPreflightReport {
	const reviewed = preflight();
	reviewed.engineResult!.actions.push({
		resource: 'invitation_assets',
		name: 'hero',
		action: 'replace',
		detail: 'overwrite',
	});
	reviewed.engineResult!.plan.storageOps.overwrites = 1;
	return reviewed;
}

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

	it('reuses a reviewed preflight from prod:apply without calling runPreflight', async () => {
		const reviewed = preflight();
		await orchestrateInvitationPromotion({
			packageData: packageData() as never,
			deliveryScope: 'content-and-assets',
			quiet: true,
			reviewedPreflight: reviewed,
			runPreflight: runPreflight as never,
			runApply: runApply as never,
			requireOwnerApply: requireOwnerApply as never,
			ensureReleaseEvidence: ensureReleaseEvidence as never,
			ensureBackup: ensureBackup as never,
			revalidateBackup: revalidateBackup as never,
			revalidateVolatile,
		});
		expect(runPreflight).not.toHaveBeenCalled();
		expect(revalidateVolatile).toHaveBeenCalledWith(
			expect.objectContaining({
				reviewed,
				packageData: packageData(),
			}),
		);
		expect(runApply).toHaveBeenCalled();
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

	it('orders critical recovery before compact revalidation and apply when assets mutate', async () => {
		const order: string[] = [];
		const risky = preflightWithAssetOverwrite();
		runPreflight.mockImplementation(async () => {
			order.push('preflight');
			return risky;
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
				...risky,
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

	it('skips full critical backup for content-and-assets when Storage ops are zero', async () => {
		await orchestrateInvitationPromotion({
			packageData: packageData() as never,
			deliveryScope: 'content-and-assets',
			assetPolicy: 'missing',
			quiet: true,
			runPreflight: runPreflight as never,
			runApply: runApply as never,
			requireOwnerApply: requireOwnerApply as never,
			ensureReleaseEvidence: ensureReleaseEvidence as never,
			ensureBackup: ensureBackup as never,
			revalidateBackup: revalidateBackup as never,
			revalidateVolatile,
		});

		expect(ensureBackup).not.toHaveBeenCalled();
		expect(revalidateBackup).not.toHaveBeenCalled();
		expect(revalidateVolatile).toHaveBeenCalledTimes(1);
		expect(runApply).toHaveBeenCalled();
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
		runPreflight.mockResolvedValueOnce(preflightWithAssetOverwrite());
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
