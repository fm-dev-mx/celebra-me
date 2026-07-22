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

	it('formats human terminal output in Spanish without raw object inspection dumps', () => {
		const formatted = formatStatusReport({
			filters: { slug: 'romina-rios-chaparro', targets: ['local'] },
			definitions: [
				{
					slug: 'romina-rios-chaparro',
					title: 'Romina Ríos Chaparro',
					createdAt: '2026-07-20T00:00:00Z',
					classification: 'MANAGED',
					environments: { local: { status: 'MANAGED' } },
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
		expect(formatted).not.toContain('[Object]');
		expect(formatted).not.toContain('[Array]');
	});

	it('formats dry-run plan with explicit logical operation and physical write counters', () => {
		const planFormatted = formatDryRunPlan({
			invitation: 'romina-rios-chaparro',
			targets: ['local'],
			isZeroDrift: true,
			plannedOperations: 0,
			expectedDatabaseWrites: { inserts: 0, updates: 0, deletes: 0 },
			expectedStorageMutations: { uploads: 0, overwrites: 0, deletes: 0 },
			actions: [],
		});

		expect(planFormatted).toContain('Plan de Simulación (Dry-Run)');
		expect(planFormatted).toContain('Sin cambios requeridos');
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
		});

		expect(applyFormatted).toContain('Resultado de Ejecución');
		expect(applyFormatted).toContain('YA ESTÁ AL DÍA');
	});
});
