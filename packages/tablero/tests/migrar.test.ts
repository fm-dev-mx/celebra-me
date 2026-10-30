/** @jest-environment node */
import { informe, migrar } from '../src/migrar.ts';

describe('dry-run migration', () => {
	const legado = [
		{
			id: 'base',
			num: 1,
			titulo: 'Base',
			estado: 'comprobada',
			pr: '#10',
			actualizado: '2026-03-01T00:00:00Z',
		},
		{
			id: 'hija',
			num: 3,
			titulo: 'Hija',
			estado: 'bloqueada',
			requisitos: [
				{ tipo: 'tarea', ref: 'base' },
				{ tipo: 'dueno', ref: 'Firmar', ok: true },
				{ tipo: 'tarea', ref: 'fantasma' },
			],
		},
		{ id: 'otra', num: 2, titulo: 'Otra', estado: 'pendiente' },
		{
			id: 'base-revision',
			num: 4,
			titulo: 'Revisar base',
			tipo: 'revision',
			origen: 'base',
			estado: 'hecha',
			cierre: {
				en: '2026-03-02T00:00:00Z',
				resultado: { sha: 'abc1234', veredicto: 'aprobado', hallazgos: [] },
			},
		},
		{ id: 'rara', num: 5, titulo: 'Rara', estado: 'perdida' },
	];

	it('maps states, folds reviews and turns requirements into waits', () => {
		const resultado = migrar(legado);
		expect(resultado.revisionesPlegadas).toBe(1);
		expect(resultado.avisos).toEqual(['rara: skipped (state «perdida», num 5)']);
		const [base, otra, hija] = resultado.tareas;
		expect(base).toMatchObject({
			tarea: { id: 'base', estado: 'hecho', pr: 10 },
			hechos: ['merged', 'verified'],
		});
		expect(base!.tarea.revisiones).toEqual([
			{
				sha: 'abc1234',
				revisor: 'desconocido',
				veredicto: 'aprobada',
				hallazgos: [],
				en: '2026-03-02T00:00:00Z',
			},
		]);
		expect(otra!.tarea).toMatchObject({ estado: 'siguiente', orden: 1 });
		expect(hija!.tarea).toMatchObject({ estado: 'siguiente', orden: 2 });
		expect(hija!.tarea.espera).toEqual([
			{ tarea: 'base' },
			{ externa: 'Firmar', dueno: true, cumplida: true },
			{ tarea: 'fantasma' },
		]);
		expect(hija!.notas).toEqual(['depends on unknown task fantasma']);
	});

	it('reports without writing', () => {
		expect(informe(migrar(legado))).toMatch(/nothing was written/);
	});
});
