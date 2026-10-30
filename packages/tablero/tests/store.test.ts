/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { storeTemporal } from './helpers.ts';

describe('store', () => {
	let entorno: ReturnType<typeof storeTemporal>;
	beforeEach(() => (entorno = storeTemporal(2)));
	afterEach(() => entorno.limpiar());

	it('appends new tasks to the queue and refuses duplicates', () => {
		const { store } = entorno;
		expect(store.crear({ id: 'a', num: 1, titulo: 'A' }, 'x').orden).toBe(1);
		expect(store.crear({ id: 'b', num: 2, titulo: 'B' }, 'x').orden).toBe(2);
		expect(() => store.crear({ id: 'a', num: 3, titulo: 'A' }, 'x')).toThrow(/already exists/);
		expect(() => store.crear({ id: 'c', num: 2, titulo: 'C' }, 'x')).toThrow(
			/T2 already exists/,
		);
	});

	it('enforces the WIP limit and renumbers the queue', () => {
		const { store } = entorno;
		for (const [id, num] of [
			['a', 1],
			['b', 2],
			['c', 3],
		] as const)
			store.crear({ id, num, titulo: id }, 'x');
		store.mover('a', { a: 'en curso', quien: 'x' });
		expect(store.tarea('b').orden).toBe(1);
		store.mover('b', { a: 'en curso', quien: 'x' });
		expect(() => store.mover('c', { a: 'en curso', quien: 'x' })).toThrow(/limit 2/);
	});

	it('rejects stale revisions and unauthorised reordering', () => {
		const { store } = entorno;
		store.crear({ id: 'a', num: 1, titulo: 'A' }, 'x');
		store.crear({ id: 'b', num: 2, titulo: 'B' }, 'x');
		expect(() => store.mover('a', { a: 'en curso', quien: 'x' }, 5)).toThrow(/rev/);
		expect(() => store.colocar('b', 1, 'agente')).toThrow(/may not reorder/);
		expect(store.colocar('b', 1, 'coordinador').orden).toBe(1);
		expect(store.tarea('a').orden).toBe(2);
	});

	it('logs every change as one JSON line', () => {
		const { store, dir } = entorno;
		store.crear({ id: 'a', num: 1, titulo: 'A' }, 'x');
		store.mover('a', { a: 'en curso', quien: 'claude' });
		const eventos = store.bitacora();
		expect(eventos.map((e) => e.evento)).toEqual(['creada', 'estado']);
		const archivos = path.join(dir, 'bitacora');
		expect(eventos[1]).toMatchObject({ quien: 'claude', de: 'siguiente', a: 'en curso' });
		expect(
			readFileSync(path.join(archivos, `${eventos[0]!.en.slice(0, 10)}.jsonl`), 'utf8')
				.trim()
				.split('\n'),
		).toHaveLength(2);
	});

	it('answers inbox rows into the task and syncs owner waits once', () => {
		const { store, reloj } = entorno;
		store.crear(
			{
				id: 'a',
				num: 1,
				titulo: 'A',
				espera: [{ externa: 'Firmar', dueno: true, hasta: '2026-03-11T00:00:00Z' }],
			},
			'x',
		);
		expect(store.sincronizarEsperas('x')).toEqual([]);
		reloj.ahora = new Date('2026-03-12T00:00:00Z');
		const [fila] = store.sincronizarEsperas('x');
		expect(store.sincronizarEsperas('x')).toEqual([]);
		expect(store.bandeja()).toHaveLength(1);
		store.responderBandeja(fila!.id, 'hecho', 'dueno');
		expect(store.tarea('a').espera[0]).toMatchObject({ cumplida: true });
	});
});
