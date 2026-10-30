/** @jest-environment node */
import { alFinal, cola, colocar, normalizar } from '../src/core/order.ts';
import { tarea } from './helpers.ts';

describe('order', () => {
	const a = tarea({ id: 'a', num: 1, orden: 1 });
	const b = tarea({ id: 'b', num: 2, orden: 2 });
	const c = tarea({ id: 'c', num: 3, orden: 3 });

	it('lists the queue by orden, unordered tasks last by number', () => {
		const sinOrden = tarea({ id: 'z', num: 9 });
		expect(cola([c, sinOrden, a, b]).map((t) => t.id)).toEqual(['a', 'b', 'c', 'z']);
		expect(alFinal([a, b, c])).toBe(4);
	});

	it('moves a task and returns only the changed ones', () => {
		expect(colocar([a, b, c], 'c', 1).map((t) => [t.id, t.orden])).toEqual([
			['c', 1],
			['a', 2],
			['b', 3],
		]);
		expect(colocar([a, b, c], 'a', 99).map((t) => [t.id, t.orden])).toEqual([
			['b', 1],
			['c', 2],
			['a', 3],
		]);
		expect(() => colocar([a, b, c], 'x', 1)).toThrow(/not in the queue/);
		expect(() => colocar([a, b, c], 'a', 0)).toThrow(/Invalid position/);
	});

	it('closes gaps and clears orden outside the queue', () => {
		const fuera = { ...b, estado: 'en curso' as const };
		const cambios = normalizar([a, fuera, c]);
		expect(cambios.find((t) => t.id === 'c')?.orden).toBe(2);
		expect(cambios.find((t) => t.id === 'b')).toBeDefined();
		expect(cambios.find((t) => t.id === 'b')?.orden).toBeUndefined();
		expect(normalizar([a, b, c])).toEqual([]);
	});
});
