/** @jest-environment node */
import { mensajeBandeja } from '../src/adapters/telegram.ts';
import {
	agregar,
	aplicarRespuesta,
	esperasDelDueno,
	resolver,
	resumir,
} from '../src/core/inbox.ts';
import { AHORA, mapa, tarea } from './helpers.ts';

describe('owner inbox', () => {
	it('validates the three row types', () => {
		expect(() =>
			agregar([], { tipo: 'decidir', tarea: 'a', texto: '¿Cuál?', opciones: ['uno'] }, AHORA),
		).toThrow(/two options/);
		expect(() =>
			agregar([], { tipo: 'hacer', tarea: 'a', texto: 'x', opciones: ['a', 'b'] }, AHORA),
		).toThrow(/Only decisions/);
		expect(() =>
			agregar([], { tipo: 'aprobar', tarea: 'a', texto: 'x', url: 'javascript:1' }, AHORA),
		).toThrow(/link/);
	});

	it('collapses repeated questions and accepts only valid answers', () => {
		const pregunta = {
			tipo: 'decidir' as const,
			tarea: 'a',
			texto: '¿Color?',
			opciones: ['Azul', 'Rojo'],
		};
		const primero = agregar([], pregunta, AHORA);
		const segundo = agregar(primero.items, { ...pregunta, texto: ' ¿color? ' }, AHORA);
		expect(segundo.creado).toBe(false);
		expect(segundo.items).toHaveLength(1);
		expect(() => resolver(segundo.items, primero.item.id, 'Verde', 'dueno', AHORA)).toThrow(
			/does not accept/,
		);
		const { item } = resolver(segundo.items, primero.item.id, 'Rojo', 'dueno', AHORA);
		expect(aplicarRespuesta(tarea({ id: 'a', num: 1 }), item).decisiones).toEqual([
			{ pregunta: '¿Color?', respuesta: 'Rojo', en: AHORA.toISOString() },
		]);
		expect(() => resolver([item], item.id, 'Rojo', 'dueno', AHORA)).toThrow(/already answered/);
	});

	it('accepts approve / request changes on approval rows', () => {
		const { items, item } = agregar(
			[],
			{ tipo: 'aprobar', tarea: 'a', texto: 'PR 5', url: 'https://x.test/5' },
			AHORA,
		);
		expect(resolver(items, item.id, 'cambios', 'dueno', AHORA).item.resuelto?.respuesta).toBe(
			'cambios',
		);
		expect(() => resolver(items, item.id, 'hecho', 'dueno', AHORA)).toThrow(/does not accept/);
	});

	it('opens a «hacer fuera» row for due owner waits and clears the wait on «hecho»', () => {
		const t = tarea({
			id: 'a',
			num: 1,
			espera: [
				{ externa: 'Firmar contrato', dueno: true },
				{ externa: 'Pago', dueno: true, hasta: '2026-04-01T00:00:00Z' },
			],
		});
		const nuevos = esperasDelDueno([t], [], AHORA);
		expect(nuevos).toEqual([
			{ tipo: 'hacer', tarea: 'a', texto: 'Firmar contrato', espera: 0 },
		]);
		const { items, item } = agregar([], nuevos[0]!, AHORA);
		expect(esperasDelDueno([t], items, AHORA)).toEqual([]);
		const resuelto = resolver(items, item.id, 'hecho', 'dueno', AHORA).item;
		expect(aplicarRespuesta(t, resuelto).espera[0]).toMatchObject({ cumplida: true });
	});

	it('sends counts and only public notices to Telegram', () => {
		const privada = tarea({ id: 'privada', num: 1, titulo: 'Boda de Ana Pérez' });
		const publica = tarea({ id: 'publica', num: 2, aviso: 'Revisar portada' });
		let items = agregar(
			[],
			{ tipo: 'aprobar', tarea: 'privada', texto: 'Ana Pérez' },
			AHORA,
		).items;
		items = agregar(items, { tipo: 'hacer', tarea: 'publica', texto: 'x' }, AHORA).items;
		const mensaje = mensajeBandeja('demo', resumir(items, mapa(privada, publica)));
		expect(mensaje).toBe(
			'demo: 1 aprobación, 1 pendiente fuera\nT2 Revisar portada (hacer fuera)',
		);
		expect(mensaje).not.toMatch(/Ana/);
		expect(mensajeBandeja('demo', resumir([], mapa()))).toBe('');
	});
});
