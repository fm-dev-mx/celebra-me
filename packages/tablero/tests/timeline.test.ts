/** @jest-environment node */
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cargarConfig, rutaDatos } from '../src/config.ts';
import { Store } from '../src/core/store.ts';
import { proyectarLinea } from '../src/proyeccion.ts';

const EJEMPLO = path.resolve(__dirname, '..', 'tablero.config.example.json');

describe('timeline (acceptance)', () => {
	let raiz: string;
	beforeEach(() => (raiz = mkdtempSync(path.join(os.tmpdir(), 'tablero-proyecto-'))));
	afterEach(() => rmSync(raiz, { recursive: true, force: true }));

	it('shows another project with Hecho, En curso and Siguiente in order 1, 2, 3', () => {
		copyFileSync(EJEMPLO, path.join(raiz, 'tablero.config.json'));
		const config = cargarConfig(path.join(raiz, 'tablero.config.json'));
		let ahora = new Date('2026-03-10T15:00:00Z');
		const store = new Store({
			dir: rutaDatos(config),
			wipMax: config.wipMax,
			ordenan: config.ordenan,
			reloj: () => ahora,
		});

		store.crear({ id: 'riego', num: 1, titulo: 'Programar riego' }, 'dueno');
		store.crear({ id: 'semillas', num: 2, titulo: 'Comprar semillas' }, 'dueno');
		store.crear({ id: 'cerca', num: 3, titulo: 'Reparar cerca' }, 'dueno');
		store.crear({ id: 'abono', num: 4, titulo: 'Pedir abono' }, 'dueno');
		store.crear(
			{
				id: 'lluvia',
				num: 5,
				titulo: 'Sembrar',
				espera: [{ externa: 'temporada de lluvia', hasta: '2026-06-01T00:00:00Z' }],
			},
			'dueno',
		);
		store.crear({ id: 'herramientas', num: 6, titulo: 'Afilar herramientas' }, 'dueno');
		store.mover('riego', { a: 'en curso', quien: 'ana' });
		store.mover('riego', { a: 'en revision', quien: 'ana', pr: 12 });
		store.mover('riego', { a: 'hecho', quien: 'dueno' });
		ahora = new Date('2026-03-11T15:00:00Z');
		store.mover('semillas', { a: 'en curso', quien: 'ana' });
		store.colocar('abono', 1, 'dueno');

		const linea = proyectarLinea(store, config, ahora);
		expect(linea.proyecto).toBe('huerto');
		expect(linea.hecho).toEqual([
			{
				dia: '2026-03-10',
				tareas: [
					{
						id: 'riego',
						num: 1,
						titulo: 'Programar riego',
						estado: 'hecho',
						pr: 12,
						hechos: [],
					},
				],
			},
		]);
		expect(linea.enCurso.map((t) => [t.num, t.estado, t.agente ?? t.desde])).toEqual([
			[2, 'en curso', ahora.toISOString()],
		]);
		expect(linea.siguiente.map((t) => [t.orden, t.titulo])).toEqual([
			[1, 'Pedir abono'],
			[2, 'Reparar cerca'],
			[3, 'Afilar herramientas'],
		]);
		expect(linea.estacionadas.map((t) => [t.titulo, t.espera])).toEqual([
			['Sembrar', ['temporada de lluvia']],
		]);
		expect(proyectarLinea(store, config, new Date('2026-03-20T00:00:00Z')).hecho).toEqual([]);

		// Positions count the visible strip, so the parked task never shifts them.
		store.colocar('herramientas', 2, 'dueno');
		expect(proyectarLinea(store, config, ahora).siguiente.map((t) => t.num)).toEqual([4, 6, 3]);
	});
});
