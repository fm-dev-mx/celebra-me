import { spawnSync } from 'node:child_process';
import { describe, expect, it } from '@jest/globals';
import { sanitizeEnv } from '../helpers/run-command';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

type Card = {
	id: string;
	nivel: number;
	motivo: string;
	desbloquea: number;
	agente: string | null;
};

/** keyTasks over an in-memory board, with the graph built the way the view payload builds it. */
function keys(board: object, limit?: number): Card[] {
	const r = spawnSync(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`
			import { dependencyGraph } from './scripts/board/dependency-graph.mjs';
			import { keyTasks } from './scripts/board/key-tasks.mjs';
			const board = ${JSON.stringify(board)};
			console.log(JSON.stringify(keyTasks(board, dependencyGraph(board, ${NOW}), ${NOW}${limit ? `, ${limit}` : ''})));
		`,
		],
		{ cwd: process.cwd(), encoding: 'utf8', timeout: 15_000, env: sanitizeEnv() },
	);
	expect(r.stderr).toBe('');
	expect(r.status).toBe(0);
	return JSON.parse(r.stdout);
}

const task = (id: string, num: number, extra: object = {}) => ({
	id,
	num,
	titulo: `Task ${num}`,
	estado: 'pendiente',
	prompt: 'p',
	actualizado: iso(NOW - HOUR),
	...extra,
});

describe('board key tasks', () => {
	it('ranks owner steps, then unlockers, then urgent, then stuck', () => {
		const board = {
			decisiones: [],
			tareas: [
				task('stuck', 1, { estado: 'bloqueada' }),
				task('urgent', 2, { urgencia: 'alta' }),
				task('base', 3),
				task('waits-base', 4, { requisitos: [{ tipo: 'tarea', ref: 'base' }] }),
				task('owner', 5, { requisitos: [{ tipo: 'dueno', ref: 'aprobar el diseño' }] }),
				task('plain', 6),
			],
		};
		const cards = keys(board);
		expect(cards.map((c) => [c.id, c.nivel])).toEqual([
			['owner', 1],
			['base', 2],
			['urgent', 3],
			['stuck', 4],
		]);
		expect(cards[0].motivo).toBe('Usted: aprobar el diseño');
		expect(cards[1].motivo).toBe('1 tarea espera a esta');
		expect(cards[2].motivo).toBe('urgencia alta');
		expect(cards[3].motivo).toBe('bloqueada sin motivo: no espera nada');
	});

	it('orders by how many tasks wait, down a chain, and names the owner step reach', () => {
		const board = {
			decisiones: [{ id: 'd9', decision: 'Elegir proveedor', vigente: false }],
			tareas: [
				task('a', 1),
				task('b', 2, { requisitos: [{ tipo: 'tarea', ref: 'a' }] }),
				task('c', 3, { requisitos: [{ tipo: 'tarea', ref: 'b' }] }),
				task('d', 4),
				task('e', 5, { requisitos: [{ tipo: 'tarea', ref: 'd' }] }),
				task('w1', 6, { requisitos: [{ tipo: 'decision', ref: 'd9' }] }),
				task('w2', 7, { requisitos: [{ tipo: 'decision', ref: 'd9' }] }),
			],
		};
		const cards = keys(board);
		expect(cards.map((c) => c.id)).toEqual(['w1', 'w2', 'a', 'b', 'd']);
		expect(cards[0].motivo).toBe('Usted: decidir d9: Elegir proveedor · destraba 2 tareas');
		expect(cards[2]).toMatchObject({ desbloquea: 2, motivo: '2 tareas esperan a esta' });
	});

	it('flags near or past due dates and leaves far ones out', () => {
		const board = {
			tareas: [
				task('far', 1, { hasta: iso(NOW + 10 * 24 * HOUR) }),
				task('soon', 2, { hasta: iso(NOW + 30 * HOUR) }),
				task('late', 3, { hasta: iso(NOW - HOUR) }),
			],
		};
		const cards = keys(board);
		expect(cards.map((c) => [c.id, c.motivo])).toEqual([
			['late', 'su fecha límite ya pasó'],
			['soon', 'vence en 2 días'],
		]);
	});

	it('finds stale reviews and unclaimed deliveries', () => {
		const board = {
			tareas: [
				task('old-review', 1, {
					estado: 'en revision',
					cierre: { en: iso(NOW - 30 * HOUR) },
				}),
				task('new-review', 2, {
					estado: 'en revision',
					cierre: { en: iso(NOW - 2 * HOUR) },
				}),
				task('pasted', 3, { entregada: { agente: 'codex', desde: iso(NOW - HOUR) } }),
			],
		};
		const cards = keys(board);
		expect(cards.map((c) => [c.id, c.motivo])).toEqual([
			['old-review', 'en revisión hace más de 24 h'],
			['pasted', 'entregada a codex y nadie la tomó'],
		]);
	});

	it('skips finished and archived tasks, keeps the lock agent and caps the list', () => {
		const tareas = [
			task('done', 1, { estado: 'hecha', urgencia: 'urgente' }),
			task('gone', 2, { urgencia: 'urgente', archivada: iso(NOW) }),
			...Array.from({ length: 9 }, (_, i) =>
				task(`u${i}`, 10 + i, {
					urgencia: 'urgente',
					candado: { agente: 'claude', desde: iso(NOW), carril: 'f06-landing' },
				}),
			),
		];
		const cards = keys({ tareas });
		expect(cards).toHaveLength(7);
		expect(cards.map((c) => c.id)).toEqual(['u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6']);
		expect(cards[0]).toMatchObject({ agente: 'claude', carril: 'f06-landing' });
		expect(keys({ tareas }, 3)).toHaveLength(3);
	});
});
