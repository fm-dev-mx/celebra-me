// Queue order: tasks in `siguiente` carry a contiguous 1..n `orden`; nothing else is ordered.

import { TableroError, type Tarea } from './model.ts';

function porOrden(a: Tarea, b: Tarea): number {
	return (
		(a.orden ?? Number.MAX_SAFE_INTEGER) - (b.orden ?? Number.MAX_SAFE_INTEGER) || a.num - b.num
	);
}

/** Queued tasks, first to last. Tasks without an order (new or migrated) go last by number. */
export function cola(tareas: Iterable<Tarea>): Tarea[] {
	return [...tareas].filter((tarea) => tarea.estado === 'siguiente').sort(porOrden);
}

/**
 * Returns only the tasks whose `orden` must change so the queue reads 1..n, and clears `orden`
 * on tasks that left the queue.
 */
export function normalizar(tareas: Iterable<Tarea>): Tarea[] {
	const todas = [...tareas];
	const cambios: Tarea[] = [];
	cola(todas).forEach((tarea, indice) => {
		if (tarea.orden !== indice + 1) cambios.push({ ...tarea, orden: indice + 1 });
	});
	for (const tarea of todas) {
		if (tarea.estado !== 'siguiente' && tarea.orden !== undefined) {
			const sinOrden = { ...tarea };
			delete sinOrden.orden;
			cambios.push(sinOrden);
		}
	}
	return cambios;
}

/** Moves one queued task to a 1-based position and returns every task whose order changed. */
export function colocar(tareas: Iterable<Tarea>, id: string, posicion: number): Tarea[] {
	const lista = cola(tareas);
	const actual = lista.findIndex((tarea) => tarea.id === id);
	if (actual < 0) throw new TableroError('orden', `${id} is not in the queue`);
	if (!Number.isInteger(posicion) || posicion < 1) {
		throw new TableroError('orden', `Invalid position: ${String(posicion)}`);
	}
	const [tarea] = lista.splice(actual, 1);
	lista.splice(Math.min(posicion, lista.length + 1) - 1, 0, tarea);
	return lista
		.map((item, indice) => ({ item, orden: indice + 1 }))
		.filter(({ item, orden }) => item.orden !== orden)
		.map(({ item, orden }) => ({ ...item, orden }));
}

/** Position for a task entering the queue: after the current last one. */
export function alFinal(tareas: Iterable<Tarea>): number {
	return cola(tareas).length + 1;
}
