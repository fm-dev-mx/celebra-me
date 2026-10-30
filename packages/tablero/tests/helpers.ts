import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearTarea, type NuevaTarea, type Tarea } from '../src/core/model.ts';
import { Store } from '../src/core/store.ts';

export const AHORA = new Date('2026-03-10T12:00:00.000Z');

export function tarea(datos: Partial<Tarea> & Pick<NuevaTarea, 'id' | 'num'>): Tarea {
	return { ...crearTarea({ titulo: `Tarea ${datos.num}`, ...datos }, AHORA), ...datos };
}

export function mapa(...tareas: Tarea[]): Map<string, Tarea> {
	return new Map(tareas.map((t) => [t.id, t]));
}

/** A store in a fresh temp dir with a movable clock. */
export function storeTemporal(wipMax = 3): {
	store: Store;
	dir: string;
	reloj: { ahora: Date };
	limpiar: () => void;
} {
	const dir = mkdtempSync(path.join(os.tmpdir(), 'tablero-'));
	const reloj = { ahora: AHORA };
	const store = new Store({ dir, wipMax, ordenan: ['coordinador'], reloj: () => reloj.ahora });
	return { store, dir, reloj, limpiar: () => rmSync(dir, { recursive: true, force: true }) };
}
