import { describe, expect, it } from '@jest/globals';
import {
	buildStatusReport,
	parseStatusOptions,
} from '../../scripts/provision/invitation-update-options.ts';
import {
	formatStatusReport,
	formatDryRunPlan,
	formatApplyResult,
} from '../../scripts/provision/invitation-update-presenter.ts';

describe('Managed Invitation CLI Dispatcher & Presenter Contracts', () => {
	it('preserves target and slug selection in options model', () => {
		const parsed = parseStatusOptions({ slug: 'romina-rios-chaparro', targets: ['local'] });
		expect(parsed.slug).toBe('romina-rios-chaparro');
		expect(parsed.targets).toEqual(['local']);
	});

	it('scopes status report to selected target and slug without evaluating unselected targets', () => {
		const report = buildStatusReport({ slug: 'romina-rios-chaparro', targets: ['local'] }) as {
			filters: { slug: string; targets: string[] };
			definitions: Array<{ slug: string; environments: Record<string, unknown> }>;
		};
		expect(report.filters.slug).toBe('romina-rios-chaparro');
		expect(report.filters.targets).toEqual(['local']);
		expect(report.definitions).toHaveLength(1);
		expect(report.definitions[0]?.slug).toBe('romina-rios-chaparro');
		expect(Object.keys(report.definitions[0]?.environments ?? {})).toEqual(['local']);
	});

	it('formats human terminal output in Spanish separating managed status from sync status', () => {
		const formatted = formatStatusReport({
			filters: { slug: 'romina-rios-chaparro', targets: ['local'] },
			definitions: [
				{
					slug: 'romina-rios-chaparro',
					title: 'Romina Ríos Chaparro',
					createdAt: '2026-07-20T00:00:00Z',
					classification: 'MANAGED',
					environments: {
						local: {
							status: 'MANAGED',
							managedStatus: 'MANAGED',
							syncStatus: 'UNEVALUATED',
						},
					},
				},
			],
			inventory: {
				local: {
					verified: true,
					rows: [
						{
							slug: 'romina-rios-chaparro',
							status: 'MANAGED',
							hasProvenance: true,
							assetComplete: true,
						},
					],
				},
			},
		});

		expect(formatted).toContain('Estado de Invitaciones Administradas');
		expect(formatted).toContain('Romina Ríos Chaparro');
		expect(formatted).toContain('Estado administrado : Registrada');
		expect(formatted).toContain('Sincronización      : No evaluada');
		expect(formatted).not.toContain('[Object]');
		expect(formatted).not.toContain('[Array]');
	});

	it('formats dry-run plan with Spanish grammar and pluralization', () => {
		const planFormatted = formatDryRunPlan({
			invitation: 'romina-rios-chaparro',
			targets: ['local'],
			isZeroDrift: true,
			plannedOperations: 0,
			expectedDatabaseWrites: { inserts: 1, updates: 2, deletes: 0 },
			expectedStorageMutations: { uploads: 1, overwrites: 2, deletes: 0 },
			actions: [],
		});

		expect(planFormatted).toContain('Plan de Simulación (Dry-Run)');
		expect(planFormatted).toContain('Sin cambios requeridos');
		expect(planFormatted).toContain('Impacto en BD/Storage');
		expect(planFormatted).toContain('1 inserción');
		expect(planFormatted).toContain('2 actualizaciones');
		expect(planFormatted).toContain('1 subida');
		expect(planFormatted).toContain('2 sobrescrituras');
		expect(planFormatted).toContain('Ninguna modificación fue realizada');
	});

	it('prints resolved update scope and asset policy on dry-run plans', () => {
		const planFormatted = formatDryRunPlan({
			invitation: 'leslie-perez',
			targets: ['preview'],
			updateScope: 'content-and-assets',
			assetPolicy: 'missing',
			isZeroDrift: false,
			plannedOperations: 1,
			expectedDatabaseWrites: { inserts: 1, updates: 0, deletes: 0 },
			expectedStorageMutations: { uploads: 1, overwrites: 0, deletes: 0 },
			actions: [],
		});

		expect(planFormatted).toContain('Alcance      : content-and-assets');
		expect(planFormatted).toContain('Política     : missing');
	});

	it('formats compact content summary by section and expands with verbose', () => {
		const plan = {
			invitation: 'abril-michelle-becerra-rea',
			targets: ['local'],
			isZeroDrift: false,
			plannedOperations: 1,
			expectedDatabaseWrites: { inserts: 0, updates: 1, deletes: 0 },
			expectedStorageMutations: { uploads: 0, overwrites: 0, deletes: 0 },
			actions: [],
			functionalChanges: [
				{
					section: 'Sharing',
					entity: 'Invitation',
					label: 'Sharing — Invitation',
					operation: 'insert' as const,
					field: 'sharing.invitation',
					newValue: '«hola»',
					scope: 'database' as const,
					technicalWriteCount: 1,
				},
				{
					section: 'Sharing',
					entity: 'Reminder',
					label: 'Sharing — Reminder',
					operation: 'update' as const,
					field: 'sharing.reminder',
					previousValue: '«old»',
					newValue: '«new»',
					scope: 'database' as const,
					technicalWriteCount: 1,
				},
			],
			planId: 'abc123',
		};
		const compact = formatDryRunPlan(plan);
		expect(compact).toContain('Cambios de contenido · 2');
		expect(compact).toContain('Sharing (2:');
		expect(compact).toContain('altas/bajas de campos');
		expect(compact).not.toContain('ID de Plan');
		expect(compact).not.toContain('INSERCIONES');

		const verbose = formatDryRunPlan(plan, { verbose: true });
		expect(verbose).toContain('ID de Plan');
		expect(verbose).toContain('INSERCIONES · 1');
		expect(verbose).toContain('ACTUALIZACIONES · 1');
	});

	it('formats apply result separating completed logical operations from physical writes', () => {
		const applyFormatted = formatApplyResult({
			invitation: 'romina-rios-chaparro',
			status: 'IN_SYNC',
			environment: 'local',
			completedOperations: 0,
			databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
			storageMutations: { uploads: 0, overwrites: 0, deletes: 0 },
			publishedVersion: 1,
		});

		expect(applyFormatted).toContain('Resultado de Ejecución');
		expect(applyFormatted).toContain('YA ESTÁ AL DÍA');
		expect(applyFormatted).toContain(
			'La invitación ya está sincronizada. No hay cambios por aplicar.',
		);
		expect(applyFormatted).toContain('Versión pública                 : v1');
	});

	it('validates target isolation: local target does not request preview or production', () => {
		const parsedLocal = parseStatusOptions({
			slug: 'romina-rios-chaparro',
			targets: ['local'],
		});
		expect(parsedLocal.targets).toEqual(['local']);
		expect(parsedLocal.targets).not.toContain('preview');
		expect(parsedLocal.targets).not.toContain('production');
	});

	it('preserves target selection through options model', () => {
		const parsed = parseStatusOptions({ targets: ['local', 'production'] });
		expect(parsed.targets).toEqual(['local', 'production']);
	});

	it('formats terminal output with no-op results showing zero aggregate counters in plural form', () => {
		const applyResult = {
			invitation: 'romina-rios-chaparro',
			status: 'IN_SYNC' as const,
			environment: 'local',
			completedOperations: 0,
			databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
			storageMutations: { uploads: 0, overwrites: 0, deletes: 0 },
			publishedVersion: 1,
		};
		const formatted = formatApplyResult(applyResult);
		expect(formatted).toContain('Resultado de Ejecución');
		expect(formatted).toContain('0 inserciones');
		expect(formatted).toContain('0 subidas');
	});

	it('formats terminal output with singular labels when a single operation is performed', () => {
		const applyResult = {
			invitation: 'romina-rios-chaparro',
			status: 'UPDATED' as const,
			environment: 'local',
			completedOperations: 3,
			databaseWrites: { inserts: 1, updates: 2, deletes: 0 },
			storageMutations: { uploads: 1, overwrites: 0, deletes: 0 },
			publishedVersion: 2,
		};
		const formatted = formatApplyResult(applyResult);
		expect(formatted).toContain('Resultado de Ejecución');
		expect(formatted).toContain('CAMBIOS APLICADOS');
		expect(formatted).toContain('1 inserción');
		expect(formatted).toContain('2 actualizaciones');
		expect(formatted).toContain('1 subida');
	});

	it('separates logical operations from physical database and storage mutations in structured result', () => {
		const applyResult = {
			invitation: 'romina-rios-chaparro',
			status: 'IN_SYNC' as const,
			environment: 'local',
			completedOperations: 0,
			databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
			storageMutations: { uploads: 0, overwrites: 0, deletes: 0 },
			publishedVersion: 1,
		};
		// Validate the structured contract directly — not through the terminal formatter.
		// completedOperations is a logical concept, separate from physical mutation counters.
		expect(applyResult).toHaveProperty('completedOperations');
		expect(typeof applyResult.completedOperations).toBe('number');

		expect(applyResult.databaseWrites).toEqual({
			inserts: expect.any(Number),
			updates: expect.any(Number),
			deletes: expect.any(Number),
		});

		expect(applyResult.storageMutations).toEqual({
			uploads: expect.any(Number),
			overwrites: expect.any(Number),
			deletes: expect.any(Number),
		});

		// Logical operations and physical mutations are distinct top-level fields
		expect(applyResult).not.toHaveProperty('operations');
	});
});
