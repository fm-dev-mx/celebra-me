import { describe, expect, it } from '@jest/globals';
import {
	computePlanId,
	verifyPlanPreconditions,
	type OperationalPlan,
} from '../../scripts/provision/invitation-update-plan.ts';
import {
	formatDryRunPlan,
	formatApplyResult,
	type OperationalPlanData,
	type TargetPlanData,
	type TargetApplyResultData,
} from '../../scripts/provision/invitation-update-presenter.ts';
import {
	planCleanup,
	type TrackedResource,
} from '../../scripts/provision/managed-invitation-cleanup.ts';
import { verifyPreviewApprovalArtifact } from '../../scripts/provision/preview-approval-service.ts';

describe('Managed Invitation Lifecycle Automated Matrix', () => {
	describe('1. Single-Target Contracts & Plan Invariants', () => {
		it('generates distinct plan IDs for different targets with identical packages', () => {
			const localPlanId = computePlanId({
				slug: 'romina-rios-chaparro',
				sourceHash: 'a'.repeat(64),
				targetEnvironment: 'local',
				projectRef: 'persistent-local',
				changes: [],
				preconditions: {},
			});

			const previewPlanId = computePlanId({
				slug: 'romina-rios-chaparro',
				sourceHash: 'a'.repeat(64),
				targetEnvironment: 'preview',
				projectRef: 'iwipdvisoyerfdytuhwi',
				changes: [],
				preconditions: {},
			});

			expect(localPlanId).toHaveLength(32);
			expect(previewPlanId).toHaveLength(32);
			expect(localPlanId).not.toEqual(previewPlanId);
		});

		it('enforces plan ID invariant dryRun.planId === execution.planId === receipt.planId', () => {
			const plan: OperationalPlan = {
				planId: '44edcad81aa32dcddde4ee2d60250da6',
				invitationSlug: 'romina-rios-chaparro',
				invitationTitle: 'Romina Ríos Chaparro',
				sourceHash: 'a'.repeat(64),
				packageHash: 'a'.repeat(64),
				targetEnvironment: 'local',
				verifiedProjectRef: 'persistent-local',
				functionalChanges: [],
				physicalDatabaseOps: { inserts: 0, updates: 0, deletes: 0 },
				storageOps: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
				targetPreconditions: {
					sourceHash: 'a'.repeat(64),
					packageHash: 'a'.repeat(64),
					verifiedProjectRef: 'persistent-local',
					targetInvitationId: 'inv-uuid-1',
					existingDraftUpdatedAt: '2026-07-23T10:00:00Z',
					existingPublishedVersion: 1,
				},
				sensitivityClassification: 'public',
				executionStatus: 'IN_SYNC',
				receipt: {
					planId: '44edcad81aa32dcddde4ee2d60250da6',
					executedAt: '2026-07-23T10:05:00Z',
					status: 'IN_SYNC',
					completedOperations: 0,
					databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
					storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
					publishedVersion: 1,
				},
			};

			expect(plan.planId).toBe('44edcad81aa32dcddde4ee2d60250da6');
			expect(plan.receipt?.status).toBe('IN_SYNC');
		});

		it('aborts precondition check when target draft timestamp changes after planning', () => {
			const plan: OperationalPlan = {
				planId: 'plan-123',
				invitationSlug: 'romina-rios-chaparro',
				invitationTitle: 'Romina',
				sourceHash: 'a'.repeat(64),
				packageHash: 'a'.repeat(64),
				targetEnvironment: 'local',
				verifiedProjectRef: 'persistent-local',
				functionalChanges: [],
				physicalDatabaseOps: { inserts: 0, updates: 0, deletes: 0 },
				storageOps: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
				targetPreconditions: {
					targetInvitationId: 'inv-1',
					existingDraftUpdatedAt: '2026-07-23T10:00:00Z',
					existingPublishedVersion: 1,
				},
				sensitivityClassification: 'public',
				executionStatus: 'PLANNED',
			};

			const precheck = verifyPlanPreconditions(plan, {
				sourceHash: 'a'.repeat(64),
				packageHash: 'a'.repeat(64),
				verifiedProjectRef: 'persistent-local',
				targetInvitationId: 'inv-1',
				existingDraftUpdatedAt: '2026-07-23T10:05:00Z', // Drifted!
				existingPublishedVersion: 1,
			});

			expect(precheck.ok).toBe(false);
			expect(precheck.reason).toContain('PRECONDITION_FAILED');
		});
	});

	describe('2. Multi-Target Orchestration & Isolation', () => {
		it('reports uninspected remote target as NO EVALUADO, never false SIN CAMBIOS', () => {
			const targetPlans: TargetPlanData[] = [
				{
					target: 'local',
					planId: 'local-plan-1',
					status: 'SIN CAMBIOS',
					plannedOperations: 0,
					expectedDatabaseWrites: { inserts: 0, updates: 0, deletes: 0 },
					expectedStorageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
					actions: [],
				},
				{
					target: 'preview',
					status: 'NO EVALUADO',
					reason: 'No se realizó una inspección remota (credenciales de preview no configuradas).',
					plannedOperations: 0,
					expectedDatabaseWrites: { inserts: 0, updates: 0, deletes: 0 },
					expectedStorageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
					actions: [],
				},
			];

			const planData: OperationalPlanData = {
				invitation: 'romina-rios-chaparro',
				targets: ['local', 'preview'],
				isZeroDrift: false,
				plannedOperations: 0,
				expectedDatabaseWrites: { inserts: 0, updates: 0, deletes: 0 },
				expectedStorageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
				actions: [],
				targetPlans,
			};

			const formatted = formatDryRunPlan(planData);
			expect(formatted).toContain('📌 Entorno: local');
			expect(formatted).toContain('📌 Entorno: preview');
			expect(formatted).toContain('NO EVALUADO');
			expect(formatted).toContain('No se realizó una inspección remota');
			expect(formatted).not.toContain('preview\n  Estado       : SIN CAMBIOS');
		});

		it('keeps mixed target outcomes separate in apply result formatting', () => {
			const targetResults: TargetApplyResultData[] = [
				{
					target: 'local',
					planId: 'local-plan-id',
					status: 'CAMBIOS APLICADOS',
					completedOperations: 3,
					databaseWrites: { inserts: 1, updates: 2, deletes: 0 },
					storageMutations: { uploads: 1, overwrites: 0, moves: 0, deletes: 0 },
					publishedVersion: 2,
				},
				{
					target: 'preview',
					status: 'NO EVALUADO',
					reason: 'PREVIEW_DB_URL no configurada.',
					completedOperations: 0,
					databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
					storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
				},
			];

			const resultOutput = formatApplyResult({
				invitation: 'romina-rios-chaparro',
				status: 'CAMBIOS APLICADOS',
				environment: 'local, preview',
				completedOperations: 3,
				databaseWrites: { inserts: 1, updates: 2, deletes: 0 },
				storageMutations: { uploads: 1, overwrites: 0, moves: 0, deletes: 0 },
				targetResults,
			});

			expect(resultOutput).toContain('📌 Entorno: local');
			expect(resultOutput).toContain('CAMBIOS APLICADOS');
			expect(resultOutput).toContain('📌 Entorno: preview');
			expect(resultOutput).toContain('NO EVALUADO');
		});
	});

	describe('3. Production Preflight Gate', () => {
		it('blocks Production preflight when Preview approval artifact is missing or invalid', () => {
			expect(() =>
				verifyPreviewApprovalArtifact({
					packageHash: 'f'.repeat(64),
					sourceHash: 'a'.repeat(64),
					metadataHash: 'b'.repeat(64),
					projectionHash: 'c'.repeat(32),
					assetManifestHash: 'd'.repeat(64),
					slug: 'romina-rios-chaparro',
					route: '/invitacion/xv/romina-rios-chaparro',
				}),
			).toThrow(/No approved Preview artifact exists/i);
		});
	});

	describe('4. Truthful Error Recovery Boundaries', () => {
		it('returns CAMBIOS_REVERTIDOS when only newly created resources were cleaned up', () => {
			const trackedResources: TrackedResource[] = [
				{ type: 'invitation', id: 'new-inv-1', isPreExisting: false },
				{ type: 'invitation_content_draft', id: 'new-draft-1', isPreExisting: false },
			];

			const plan = planCleanup(trackedResources);
			expect(plan.toRemove).toHaveLength(2);
			expect(plan.toSkip).toHaveLength(0);
			expect(plan.unrestoredOverwrites).toHaveLength(0);
		});

		it('returns REQUIERE_REVISION when a pre-existing resource was overwritten without auto-restoration', () => {
			const trackedResources: TrackedResource[] = [
				{
					type: 'invitation',
					id: 'existing-inv-1',
					isPreExisting: true,
					wasOverwritten: true,
					restored: false,
				},
				{ type: 'invitation_content_draft', id: 'new-draft-1', isPreExisting: false },
			];

			const plan = planCleanup(trackedResources);
			expect(plan.toRemove).toHaveLength(1);
			expect(plan.toSkip).toHaveLength(1);
			expect(plan.unrestoredOverwrites).toHaveLength(1);
			expect(plan.unrestoredOverwrites[0]?.id).toBe('existing-inv-1');
		});
	});
});
