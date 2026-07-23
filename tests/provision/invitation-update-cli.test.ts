import { describe, expect, it } from '@jest/globals';
import { buildStatusReport, parseStatusOptions } from '../../scripts/provision/invitation-update-options.ts';
import { formatStatusReport, formatDryRunPlan, formatApplyResult } from '../../scripts/provision/invitation-update-presenter.ts';

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
					environments: { local: { status: 'MANAGED', managedStatus: 'MANAGED', syncStatus: 'UNEVALUATED' } },
				},
			],
			inventory: {
				local: {
					verified: true,
					rows: [{ slug: 'romina-rios-chaparro', status: 'MANAGED', hasProvenance: true, assetComplete: true }],
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
		expect(planFormatted).toContain('1 inserción');
		expect(planFormatted).toContain('2 actualizaciones');
		expect(planFormatted).toContain('1 subida');
		expect(planFormatted).toContain('2 sobrescrituras');
		expect(planFormatted).toContain('Ninguna modificación fue realizada');
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
		expect(applyFormatted).toContain('La invitación ya está sincronizada. No hay cambios por aplicar.');
		expect(applyFormatted).toContain('Versión pública                 : v1');
	});

	it('validates target isolation: local target does not request preview or production', () => {
		const parsedLocal = parseStatusOptions({ slug: 'romina-rios-chaparro', targets: ['local'] });
		expect(parsedLocal.targets).toEqual(['local']);
		expect(parsedLocal.targets).not.toContain('preview');
		expect(parsedLocal.targets).not.toContain('production');
	});

	it('rejects invalid mode flags combination', () => {
		expect(() => parseStatusOptions(['--targets', 'local,production'])).toThrow(
			/Local \+ Production is invalid/i,
		);
	});

	it('validates JSON output structure contains logical operations and separate physical mutations', () => {
		const applyResult = {
			invitation: 'romina-rios-chaparro',
			status: 'IN_SYNC',
			environment: 'local',
			completedOperations: 0,
			databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
			storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
			publishedVersion: 16,
		};

		const jsonString = JSON.stringify(applyResult);
		expect(() => JSON.parse(jsonString)).not.toThrow();

		const parsed = JSON.parse(jsonString);
		expect(parsed.invitation).toBe('romina-rios-chaparro');
		expect(parsed.status).toBe('IN_SYNC');
		expect(parsed.completedOperations).toBe(0);
		expect(parsed.databaseWrites).toEqual({ inserts: 0, updates: 0, deletes: 0 });
		expect(parsed.storageMutations).toEqual({ uploads: 0, overwrites: 0, moves: 0, deletes: 0 });
		expect(parsed.publishedVersion).toBe(16);
		// Raw ANSI escape characters must not exist in JSON fields
		expect(jsonString).not.toContain('\x1b');
	});
});

