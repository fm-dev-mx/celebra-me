import { describe, expect, it, jest } from '@jest/globals';
import type { InvitationPackageData } from '../../scripts/provision/invitation-package.ts';
import type {
	ImportEngineOptions,
	ImportEngineResult,
} from '../../scripts/provision/invitation-import-engine.ts';
import { runPreviewApply } from '../../scripts/provision/preview-apply.ts';
import type { OperationalPlan } from '../../scripts/provision/invitation-update-plan.ts';

const sourceHash = 'a'.repeat(64);
const packageHash = 'b'.repeat(64);

function plan(): OperationalPlan {
	return {
		planId: 'preview-confirmed-plan',
		invitationSlug: 'fixture',
		invitationTitle: 'Fixture',
		sourceHash,
		packageHash,
		targetEnvironment: 'preview',
		verifiedProjectRef: 'iwipdvisoyerfdytuhwi',
		functionalChanges: [],
		physicalDatabaseOps: { inserts: 0, updates: 1, deletes: 0 },
		storageOps: { uploads: 1, overwrites: 0, moves: 0, deletes: 0 },
		targetPreconditions: {},
		sensitivityClassification: 'public',
		executionStatus: 'PLANNED',
	};
}

function pkg(): InvitationPackageData {
	return {
		packageHash,
		sourceHash,
		metadataHash: 'c'.repeat(64),
		assetManifestHash: 'd'.repeat(64),
		projectionHash: 'e'.repeat(32),
	} as InvitationPackageData;
}

function result(receiptPlanId = 'preview-confirmed-plan'): ImportEngineResult {
	return {
		packageHash,
		slug: 'fixture',
		target: 'preview',
		projectRef: 'iwipdvisoyerfdytuhwi',
		ownerUserId: '00000000-0000-4000-8000-000000000001',
		publishedVersion: 2,
		projectionHash: 'e'.repeat(32),
		route: '/xv/fixture',
		actions: [],
		plannedMutations: 2,
		executedMutations: 2,
		isZeroDrift: false,
		mutationsPerformed: 2,
		verifiedAssetHashes: { 'managed/fixture/hero.webp': 'f'.repeat(64) },
		isZeroDriftRerun: false,
		plan: plan(),
		receipt: {
			planId: receiptPlanId,
			executedAt: '2026-07-23T12:00:00.000Z',
			status: 'EXECUTED',
			completedOperations: 2,
		},
	};
}

describe('Preview apply adapter integration', () => {
	it('executes the exact confirmed operation set and creates a plan-bound pending approval', async () => {
		const runEngine = jest.fn(async (...args: [ImportEngineOptions]) => {
			void args;
			return result();
		});
		const createPendingApproval: NonNullable<
			Parameters<typeof runPreviewApply>[0]['createPendingApproval']
		> = jest.fn((input) => {
			void input;
			return 'approval.json';
		});
		const confirmedPlan = plan();
		const applied = await runPreviewApply({
			packageData: pkg(),
			targetDbUrl: 'postgresql://redacted@preview.invalid/db',
			plan: confirmedPlan,
			runEngine,
			createPendingApproval,
		});

		expect(runEngine).toHaveBeenCalledWith(
			expect.objectContaining({
				target: 'preview',
				dryRun: false,
				plan: confirmedPlan,
			}),
		);
		expect(applied.plan?.planId).toBe(confirmedPlan.planId);
		expect(applied.receipt?.planId).toBe(confirmedPlan.planId);
		expect(createPendingApproval).toHaveBeenCalledWith(
			expect.objectContaining({ planId: confirmedPlan.planId }),
		);
	});

	it('fails closed when the engine receipt does not match the confirmed plan', async () => {
		await expect(
			runPreviewApply({
				packageData: pkg(),
				targetDbUrl: 'postgresql://redacted@preview.invalid/db',
				plan: plan(),
				runEngine: async () => result('different-plan'),
				createPendingApproval: () => 'never.json',
			}),
		).rejects.toThrow(/INVALID_ENGINE_RESULT/);
	});

	it.each([
		['Storage antes de DB', 1, 0, 1, 'ERROR — CAMBIOS REVERTIDOS'],
		['DB después de Storage', 2, 1, 1, 'ERROR — REQUIERE REVISIÓN'],
		['publicación', 3, 2, 1, 'ERROR — REQUIERE REVISIÓN'],
		['verificación posterior', 4, 3, 1, 'ERROR — REQUIERE REVISIÓN'],
		['compensación', 2, 1, 1, 'ERROR — REQUIERE REVISIÓN'],
	] as const)(
		'propagates %s failure recovery evidence without replacing the retained plan',
		async (phase, completedOperations, databaseUpdates, storageUploads, recoveryStatus) => {
			const recoveryError = Object.assign(new Error(`falló ${phase}`), {
				recoveryStatus,
				executionTotals: {
					completedOperations,
					databaseWrites: { inserts: 0, updates: databaseUpdates, deletes: 0 },
					storageMutations: {
						uploads: storageUploads,
						overwrites: 0,
						moves: 0,
						deletes: 0,
					},
				},
			});
			const caught = await runPreviewApply({
				packageData: pkg(),
				targetDbUrl: 'postgresql://redacted@preview.invalid/db',
				plan: plan(),
				runEngine: async () => {
					throw recoveryError;
				},
				createPendingApproval: () => 'never.json',
			}).catch((error: unknown) => error);
			expect(caught).toBe(recoveryError);
			expect(caught).toMatchObject({
				recoveryStatus,
				executionTotals: {
					completedOperations,
					databaseWrites: { updates: databaseUpdates },
					storageMutations: { uploads: storageUploads },
				},
			});
		},
	);
});
