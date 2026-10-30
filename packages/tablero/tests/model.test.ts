/** @jest-environment node */
import {
	esperasPendientes,
	estaEstacionada,
	registrarRevision,
	TableroError,
	transitar,
} from '../src/core/model.ts';
import { AHORA, mapa, tarea } from './helpers.ts';

describe('model', () => {
	it('rejects invalid ids, numbers and titles', () => {
		expect(() => tarea({ id: 'Mal Id', num: 1 })).toThrow(TableroError);
		expect(() => tarea({ id: 'ok', num: 0 })).toThrow(/number/);
		expect(() => tarea({ id: 'ok', num: 1, titulo: ' ' })).toThrow(/title/);
	});

	it('only allows the five-state transitions', () => {
		const t = tarea({ id: 'a', num: 1 });
		expect(() => transitar(t, { a: 'hecho', quien: 'x' }, mapa(t), AHORA)).toThrow(
			/not allowed/,
		);
		const enCurso = transitar(t, { a: 'en curso', quien: 'claude' }, mapa(t), AHORA);
		expect(enCurso.candado).toEqual({ quien: 'claude', desde: AHORA.toISOString() });
		expect(() =>
			transitar(enCurso, { a: 'en revision', quien: 'x' }, mapa(enCurso), AHORA),
		).toThrow(/pull request/);
		const revision = transitar(
			enCurso,
			{ a: 'en revision', quien: 'x', pr: 7 },
			mapa(enCurso),
			AHORA,
		);
		expect(revision).toMatchObject({ estado: 'en revision', pr: 7 });
		expect(revision.candado).toBeUndefined();
	});

	it('blocks starting a task with an unmet dependency', () => {
		const base = tarea({ id: 'base', num: 1 });
		const hija = tarea({ id: 'hija', num: 2, espera: [{ tarea: 'base' }] });
		expect(() =>
			transitar(hija, { a: 'en curso', quien: 'x' }, mapa(base, hija), AHORA),
		).toThrow(/waits on/);
		const hecha = { ...base, estado: 'hecho' as const };
		expect(esperasPendientes(hija, mapa(hecha, hija), AHORA)).toEqual([]);
	});

	it('parks tasks on external waits only, and unparks them when the date passes', () => {
		const base = tarea({ id: 'base', num: 1 });
		const dependiente = tarea({ id: 'dep', num: 2, espera: [{ tarea: 'base' }] });
		const fecha = tarea({
			id: 'fecha',
			num: 3,
			espera: [{ externa: 'pago', hasta: '2026-03-12T00:00:00Z' }],
		});
		const todas = mapa(base, dependiente, fecha);
		expect(estaEstacionada(dependiente, todas, AHORA)).toBe(false);
		expect(estaEstacionada(fecha, todas, AHORA)).toBe(true);
		expect(estaEstacionada(fecha, todas, new Date('2026-03-13T00:00:00Z'))).toBe(false);
	});

	it('records reviews only while in review', () => {
		const t = tarea({ id: 'a', num: 1, estado: 'en revision', pr: 3 });
		const revision = {
			sha: 'abc1234',
			revisor: 'r',
			veredicto: 'cambios' as const,
			hallazgos: ['p1 x'],
		};
		expect(registrarRevision(t, revision, AHORA).revisiones).toHaveLength(1);
		expect(() => registrarRevision({ ...t, estado: 'en curso' }, revision, AHORA)).toThrow(
			/not in review/,
		);
		expect(() => registrarRevision(t, { ...revision, sha: 'zz' }, AHORA)).toThrow(TableroError);
	});
});
