import { describe, expect, it, jest } from '@jest/globals';
import { parseTargets, checkUnknownFlags } from '../../scripts/provision/invitation-update-options.ts';
import {
	consolidateTargetFunctionalChanges,
	formatFunctionalChanges,
	formatTargetsSpanish,
	type TargetPlanData,
} from '../../scripts/provision/invitation-update-presenter.ts';
import {
	buildPreflightBlockedResults,
	deriveLifecycleExitCode,
	deriveLifecycleFinalStatus,
	executeTargetPlans,
} from '../../scripts/provision/invitation-lifecycle-execution.ts';
import { runProductionPreflight } from '../../scripts/provision/production-preflight.ts';

const zeroDb = { inserts: 0, updates: 0, deletes: 0 };
const zeroStorage = { uploads: 0, overwrites: 0, moves: 0, deletes: 0 };

describe('Direct Production Publication with Coordinated Local and Preview Synchronization', () => {
	describe('Target Scope Expansion & Options Parsing', () => {
		it('expands selecting production into local -> preview -> production pipeline', () => {
			expect(parseTargets('production')).toEqual(['local', 'preview', 'production']);
			expect(parseTargets('local,production')).toEqual(['local', 'preview', 'production']);
			expect(parseTargets('all')).toEqual(['local', 'preview', 'production']);
		});

		it('preserves standalone local and preview target scopes', () => {
			expect(parseTargets('local')).toEqual(['local']);
			expect(parseTargets('preview')).toEqual(['preview']);
			expect(parseTargets('local,preview')).toEqual(['local', 'preview']);
		});

		it('accepts unpublished-draft discard acknowledgement flag', () => {
			expect(() =>
				checkUnknownFlags([
					'--slug',
					'daniela-y-martin',
					'--targets',
					'preview',
					'--apply',
					'--non-interactive',
					'--acknowledge-discard-unpublished-draft',
				]),
			).not.toThrow();
		});
	});

	describe('Semantic Multi-Target Diff & Presenter Formatting', () => {
		it('formats Spanish environment list correctly', () => {
			expect(formatTargetsSpanish(['local', 'preview', 'production'])).toBe('Local, Preview y Producción');
			expect(formatTargetsSpanish(['local', 'preview'])).toBe('Local y Preview');
			expect(formatTargetsSpanish(['production'])).toBe('Producción');
		});

		it('consolidates target functional changes with target-specific previous values when environments differ', () => {
			const targetPlans: TargetPlanData[] = [
				{
					target: 'local',
					planId: 'plan-local',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
					functionalChanges: [
						{
							section: 'Familia',
							entity: 'Título de padres',
							label: 'Familia — Título de padres',
							operation: 'update',
							field: 'family.parentsTitle',
							previousValue: '«Con la bendición de»',
							newValue: '«Con el amor de mis padres»',
							scope: 'database',
							technicalWriteCount: 1,
						},
					],
				},
				{
					target: 'preview',
					planId: 'plan-preview',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
					functionalChanges: [
						{
							section: 'Familia',
							entity: 'Título de padres',
							label: 'Familia — Título de padres',
							operation: 'update',
							field: 'family.parentsTitle',
							previousValue: '«Con la bendición de mis padres»',
							newValue: '«Con el amor de mis padres»',
							scope: 'database',
							technicalWriteCount: 1,
						},
					],
				},
				{
					target: 'production',
					planId: 'plan-prod',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
					functionalChanges: [
						{
							section: 'Familia',
							entity: 'Título de padres',
							label: 'Familia — Título de padres',
							operation: 'update',
							field: 'family.parentsTitle',
							previousValue: '«Con la bendición de mis padres»',
							newValue: '«Con el amor de mis padres»',
							scope: 'database',
							technicalWriteCount: 1,
						},
					],
				},
			];

			const consolidated = consolidateTargetFunctionalChanges(targetPlans);
			expect(consolidated).toBeDefined();
			expect(consolidated![0]?.targets).toEqual(['local', 'preview', 'production']);
			expect(consolidated![0]?.targetPreviousValues).toEqual({
				local: '«Con la bendición de»',
				preview: '«Con la bendición de mis padres»',
				production: '«Con la bendición de mis padres»',
			});

			const formatted = formatFunctionalChanges(consolidated);
			expect(formatted).toContain('ACTUALIZACIONES · 1');
			expect(formatted.join('\n')).toContain('Local');
			expect(formatted.join('\n')).toContain('Preview');
			expect(formatted.join('\n')).toContain('Producción');
			expect(formatted.join('\n')).toContain('Nuevo      : «Con el amor de mis padres»');
		});

		it('consolidates target functional changes with Entornos list when previous values are identical across targets', () => {
			const targetPlans: TargetPlanData[] = [
				{
					target: 'local',
					planId: 'plan-local',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
					functionalChanges: [
						{
							section: 'Sobre / apertura',
							entity: 'Nombre',
							label: 'Sobre / apertura — Nombre',
							operation: 'update',
							field: 'envelope.envelopeName',
							previousValue: '«Romina»',
							newValue: '«Romina Ríos Chaparro»',
							scope: 'database',
							technicalWriteCount: 1,
						},
					],
				},
				{
					target: 'preview',
					planId: 'plan-preview',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
					functionalChanges: [
						{
							section: 'Sobre / apertura',
							entity: 'Nombre',
							label: 'Sobre / apertura — Nombre',
							operation: 'update',
							field: 'envelope.envelopeName',
							previousValue: '«Romina»',
							newValue: '«Romina Ríos Chaparro»',
							scope: 'database',
							technicalWriteCount: 1,
						},
					],
				},
				{
					target: 'production',
					planId: 'plan-prod',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
					functionalChanges: [
						{
							section: 'Sobre / apertura',
							entity: 'Nombre',
							label: 'Sobre / apertura — Nombre',
							operation: 'update',
							field: 'envelope.envelopeName',
							previousValue: '«Romina»',
							newValue: '«Romina Ríos Chaparro»',
							scope: 'database',
							technicalWriteCount: 1,
						},
					],
				},
			];

			const consolidated = consolidateTargetFunctionalChanges(targetPlans);
			const formatted = formatFunctionalChanges(consolidated);
			expect(formatted.join('\n')).toContain('Antes    : «Romina»');
			expect(formatted.join('\n')).toContain('Ahora    : «Romina Ríos Chaparro»');
			expect(formatted.join('\n')).toContain('Entornos : Local, Preview y Producción');
		});
	});

	describe('Preflight Phase Gating & Production Preflight', () => {
		it('allows Production preflight without requiring a Preview approval artifact', async () => {
			const packageData = {
				packageHash: 'a'.repeat(64),
				sourceHash: 'b'.repeat(64),
				metadataHash: 'c'.repeat(64),
				projectionHash: 'd'.repeat(32),
				assetManifestHash: 'e'.repeat(64),
				invitation: { slug: 'romina-rios-chaparro', eventType: 'xv' },
			};
			const runEngine = jest.fn(async () => ({
				packageHash: packageData.packageHash,
				slug: packageData.invitation.slug,
				target: 'production' as const,
				ownerUserId: '00000000-0000-4000-8000-000000000001',
				projectRef: 'prod-proj',
				publishedVersion: 10,
				projectionHash: packageData.projectionHash,
				route: '/xv/romina-rios-chaparro',
				actions: [],
				plannedMutations: 0,
				executedMutations: 0,
				isZeroDrift: true,
				mutationsPerformed: 0,
				verifiedAssetHashes: {},
				isZeroDriftRerun: true,
				plan: {
					planId: 'prod-plan-1',
					invitationSlug: packageData.invitation.slug,
					invitationTitle: 'Romina',
					sourceHash: packageData.sourceHash,
					packageHash: packageData.packageHash,
					targetEnvironment: 'production' as const,
					verifiedProjectRef: 'prod-proj',
					functionalChanges: [],
					physicalDatabaseOps: zeroDb,
					storageOps: zeroStorage,
					targetPreconditions: {},
					sensitivityClassification: 'public' as const,
					executionStatus: 'IN_SYNC' as const,
				},
			}));

			const preflight = await runProductionPreflight({
				packageData: packageData as any,
				getProductionDbUrl: () => ({ url: 'postgresql://user:pass@localhost:54322/prod' }),
				runEngine,
			});

			expect(preflight.approval).toBeUndefined();
			expect(preflight.engineResult.plan.planId).toBe('prod-plan-1');
		});

		it('blocks all mutations across all targets if any target preflight fails', () => {
			const targets = ['local', 'preview', 'production'] as const;
			const targetPlans: TargetPlanData[] = [
				{
					target: 'local',
					planId: 'plan-local',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
				},
				{
					target: 'preview',
					status: 'BLOQUEADO',
					reason: 'Credenciales de preview no configuradas.',
					plannedOperations: 0,
					expectedDatabaseWrites: zeroDb,
					expectedStorageMutations: zeroStorage,
					actions: [],
				},
				{
					target: 'production',
					planId: 'plan-prod',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
				},
			];

			const blockedResults = buildPreflightBlockedResults(targets as any, targetPlans);
			expect(blockedResults).not.toBeNull();
			expect(blockedResults).toHaveLength(3);
			expect(blockedResults!.every((r) => r.status === 'BLOQUEADO')).toBe(true);
			expect(blockedResults!.every((r) => r.completedOperations === 0)).toBe(true);
		});
	});

	describe('Sequential Execution & Partial Failure Handling', () => {
		it('executes targets sequentially in order: Local -> Preview -> Production', async () => {
			const executedTargets: string[] = [];
			const targets = ['local', 'preview', 'production'] as const;
			const targetPlans: TargetPlanData[] = [
				{
					target: 'local',
					planId: 'plan-local',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
				},
				{
					target: 'preview',
					planId: 'plan-preview',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
				},
				{
					target: 'production',
					planId: 'plan-prod',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
				},
			];

			const summary = await executeTargetPlans({
				targets: targets as any,
				targetPlans,
				sanitizeError: (err) => String(err),
				executeTarget: async (target, plan) => {
					executedTargets.push(target);
					return {
						executionPlanId: plan.planId!,
						receiptPlanId: plan.planId!,
						result: {
							target,
							planId: plan.planId!,
							status: 'CAMBIOS APLICADOS',
							completedOperations: 1,
							databaseWrites: { ...zeroDb, updates: 1 },
							storageMutations: zeroStorage,
							publishedVersion: 5,
						},
					};
				},
			});

			expect(executedTargets).toEqual(['local', 'preview', 'production']);
			expect(summary.executionFailed).toBe(false);
			expect(summary.targetResults.every((r) => r.status === 'CAMBIOS APLICADOS')).toBe(true);
			expect(deriveLifecycleFinalStatus(summary.targetResults)).toBe('CAMBIOS APLICADOS');
			expect(deriveLifecycleExitCode(summary.targetResults)).toBe(0);
		});

		it('stops execution when Preview fails, leaving Local applied and Production non-executed', async () => {
			const executedTargets: string[] = [];
			const targets = ['local', 'preview', 'production'] as const;
			const targetPlans: TargetPlanData[] = [
				{
					target: 'local',
					planId: 'plan-local',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
				},
				{
					target: 'preview',
					planId: 'plan-preview',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
				},
				{
					target: 'production',
					planId: 'plan-prod',
					status: 'CAMBIOS PENDIENTES',
					plannedOperations: 1,
					expectedDatabaseWrites: { ...zeroDb, updates: 1 },
					expectedStorageMutations: zeroStorage,
					actions: [],
				},
			];

			const summary = await executeTargetPlans({
				targets: targets as any,
				targetPlans,
				sanitizeError: (err) => String(err),
				executeTarget: async (target, plan) => {
					executedTargets.push(target);
					if (target === 'preview') {
						throw new Error('Conexión con Preview rechazada.');
					}
					return {
						executionPlanId: plan.planId!,
						receiptPlanId: plan.planId!,
						result: {
							target,
							planId: plan.planId!,
							status: 'CAMBIOS APLICADOS',
							completedOperations: 1,
							databaseWrites: { ...zeroDb, updates: 1 },
							storageMutations: zeroStorage,
							publishedVersion: 5,
						},
					};
				},
			});

			expect(executedTargets).toEqual(['local', 'preview']);
			expect(summary.executionFailed).toBe(true);
			expect(summary.targetResults.find((r) => r.target === 'local')?.status).toBe('CAMBIOS APLICADOS');
			expect(summary.targetResults.find((r) => r.target === 'preview')?.status).toBe('ERROR — REQUIERE REVISIÓN');
			expect(summary.targetResults.find((r) => r.target === 'production')?.status).toBe('BLOQUEADO');
			expect(deriveLifecycleExitCode(summary.targetResults)).toBe(1);
		});
	});
});
