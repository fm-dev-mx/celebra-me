import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { InvitationPackageData } from '../../scripts/provision/invitation-package.ts';
import type {
	ImportEngineOptions,
	ImportEngineResult,
} from '../../scripts/provision/invitation-import-engine.ts';
import type { OperationalPlan } from '../../scripts/provision/invitation-update-plan.ts';
import {
	assertNoPendingPublishedPlaceholders,
	ProductionPreflightError,
	runProductionPreflight,
} from '../../scripts/provision/production-preflight.ts';
import {
	createMemoryPreviewApprovalStore,
	setDefaultPreviewApprovalStoreForTests,
} from '../../scripts/provision/preview-approval-store.ts';
import {
	assetManifestHash,
	metadataHash,
	packageHash,
	previewPlanId,
	productionProjectRef,
	projectionHash,
	sourceHash,
	writeApproval,
} from '../helpers/preview-approval-fixture.ts';

const now = new Date('2026-07-23T12:00:00.000Z');

afterEach(() => {
	setDefaultPreviewApprovalStoreForTests(null);
});

function packageData(content: Record<string, unknown> = {}): InvitationPackageData {
	return {
		packageHash,
		sourceHash,
		metadataHash,
		projectionHash,
		assetManifestHash,
		invitation: { slug: 'fixture', eventType: 'xv' },
		publishedContent: { content },
	} as InvitationPackageData;
}

function productionPlan(): OperationalPlan {
	return {
		planId: 'production-plan',
		invitationSlug: 'fixture',
		invitationTitle: 'Fixture',
		sourceHash,
		packageHash,
		targetEnvironment: 'production',
		verifiedProjectRef: productionProjectRef,
		functionalChanges: [],
		physicalDatabaseOps: { inserts: 0, updates: 0, deletes: 0 },
		storageOps: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
		targetPreconditions: {},
		sensitivityClassification: 'public',
		executionStatus: 'IN_SYNC',
	};
}

function engineResult(overrides: Partial<ImportEngineResult> = {}): ImportEngineResult {
	return {
		packageHash,
		slug: 'fixture',
		target: 'production',
		projectRef: productionProjectRef,
		ownerUserId: '00000000-0000-4000-8000-000000000001',
		publishedVersion: 2,
		projectionHash,
		route: '/xv/fixture',
		actions: [],
		plannedMutations: 0,
		executedMutations: 0,
		isZeroDrift: true,
		mutationsPerformed: 0,
		verifiedAssetHashes: {},
		isZeroDriftRerun: true,
		plan: productionPlan(),
		...overrides,
	};
}

describe('Production read-only preflight integration', () => {
	it('allows draft/preparation packages to omit published content without a placeholder failure', () => {
		expect(() => assertNoPendingPublishedPlaceholders(undefined)).not.toThrow();
		expect(() =>
			assertNoPendingPublishedPlaceholders({ title: 'Borrador autorizado' }),
		).not.toThrow();
	});

	it('blocks unresolved placeholders at the Production release boundary', () => {
		expect(() =>
			assertNoPendingPublishedPlaceholders({
				location: { venues: [{ googleMapsUrl: '[[PENDIENTE:MAP_URL]]' }] },
			}),
		).toThrow(
			'La release de Producción contiene datos pendientes de confirmación. Reemplace los placeholders antes de continuar.',
		);
	});

	it('enforces the placeholder boundary before the Production engine runs', async () => {
		const runEngine = jest.fn(async () => engineResult());
		await expect(
			runProductionPreflight({
				packageData: packageData({ title: '[[PENDIENTE:TITLE]]' }),
				getProductionDbUrl: () => ({ url: 'postgresql://redacted@production.invalid/db' }),
				runEngine,
			}),
		).rejects.toMatchObject({ code: 'PRODUCTION_PLAN_BLOCKED' });
		expect(runEngine).not.toHaveBeenCalled();
	});

	it('verifies exact approval, intended target, credentials, inspection, and target plan', async () => {
		writeApproval();
		const runEngine = jest.fn(async (...args: [ImportEngineOptions]) => {
			void args;
			return engineResult();
		});
		const result = await runProductionPreflight({
			packageData: packageData(),
			now,
			getProductionDbUrl: () => ({ url: 'postgresql://redacted@production.invalid/db' }),
			runEngine,
		});

		expect(runEngine).toHaveBeenCalledWith(
			expect.objectContaining({ target: 'production', dryRun: true }),
		);
		expect(result.approval!.planId).toBe(previewPlanId);
		expect(result.engineResult.plan?.planId).toBe('production-plan');
		expect(result.engineResult.projectRef).toBe(productionProjectRef);
		expect(result.engineResult.mutationsPerformed).toBe(0);
	});

	it('allows preflight inspection when Preview approval artifact is missing (optional audit evidence)', async () => {
		setDefaultPreviewApprovalStoreForTests(createMemoryPreviewApprovalStore());
		const runEngine = jest.fn(async () => engineResult());
		const result = await runProductionPreflight({
			packageData: packageData(),
			now,
			getProductionDbUrl: () => ({ url: 'postgresql://redacted@production.invalid/db' }),
			runEngine,
		});
		expect(runEngine).toHaveBeenCalled();
		expect(result.approval).toBeUndefined();
		expect(result.engineResult.plan?.planId).toBe('production-plan');
	});

	it('blocks missing Production credentials without inspection', async () => {
		writeApproval();
		const runEngine = jest.fn(async () => engineResult());
		await expect(
			runProductionPreflight({
				packageData: packageData(),
				now,
				getProductionDbUrl: () => {
					throw new Error('missing secret');
				},
				runEngine,
			}),
		).rejects.toMatchObject({ code: 'PRODUCTION_CREDENTIALS_UNAVAILABLE' });
		expect(runEngine).not.toHaveBeenCalled();
	});

	it('treats mismatched intended project ref as unverified approval evidence while allowing preflight', async () => {
		writeApproval();
		const result = await runProductionPreflight({
			packageData: packageData(),
			now,
			getProductionDbUrl: () => ({ url: 'postgresql://redacted@wrong.invalid/db' }),
			runEngine: async () => engineResult({ projectRef: 'differentproject' }),
		});
		expect(result.approval).toBeUndefined();
		expect(result.engineResult.projectRef).toBe('differentproject');
	});

	it.each([
		['cross-environment credentials', 'Expected production target, received preview'],
		['Database and Storage mismatch', 'Database/Storage project mismatch'],
		['inspection timeout', 'Remote inspection timed out'],
		['authentication failure', 'authentication failed'],
	])('sanitizes %s as a blocked inspection without mutation', async (_name, message) => {
		writeApproval();
		const error = await runProductionPreflight({
			packageData: packageData(),
			now,
			getProductionDbUrl: () => ({ url: 'postgresql://redacted@production.invalid/db' }),
			runEngine: async () => {
				throw new Error(message);
			},
		}).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ProductionPreflightError);
		expect(error).toMatchObject({ code: 'PRODUCTION_PLAN_BLOCKED' });
		expect((error as ProductionPreflightError).safeReason).toMatch(/^No fue posible verificar/);
	});

	it('rejects an empty or malformed inspection result', async () => {
		writeApproval();
		await expect(
			runProductionPreflight({
				packageData: packageData(),
				now,
				getProductionDbUrl: () => ({ url: 'postgresql://redacted@production.invalid/db' }),
				runEngine: async () => ({}) as ImportEngineResult,
			}),
		).rejects.toMatchObject({ code: 'PRODUCTION_PLAN_BLOCKED' });
	});
});
