import path from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const href = (file: string) => pathToFileURL(path.join(ROOT, 'scripts', 'board', file)).href;

/** Run a snippet with `m` = model.mjs and subtasks.mjs and `board` = the given board; its printed JSON is returned. */
function probe(board: unknown, code: string) {
	const src = `const m = { ...(await import(process.argv[1])), ...(await import(process.argv[2])) }; const board = ${JSON.stringify(board)}; ${code}`;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, href('model.mjs'), href('subtasks.mjs')],
		{
			cwd: ROOT,
			allowFailure: true,
			env: sanitizeEnv({}),
		},
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

const PROMPT = 'T1 · x\n\nDECISIONES\n- ninguna';
const task = (id: string, extra: Record<string, unknown> = {}) => ({
	id,
	titulo: id,
	estado: 'pendiente',
	requisitos: [],
	prompt: PROMPT,
	actor: 'sesion',
	urgencia: 'normal',
	...extra,
});

const NOW = Date.parse('2026-10-25T18:00:00Z');
const RECENT = '2026-10-25T17:30:00Z';
const STALE = '2026-10-25T12:00:00Z';

/** A self-headed mother (`grupo` = its own id, like servicio-medicion), a headless group and noise. */
const BOARD = {
	tareas: [
		task('medicion', { num: 1, grupo: 'medicion', actualizado: '2026-10-25T10:00:00Z' }),
		task('m1', { num: 2, grupo: 'medicion', fase: 1, estado: 'hecha' }),
		task('m2', {
			num: 3,
			grupo: 'medicion',
			fase: 2,
			estado: 'en curso',
			candado: { agente: 'codex', desde: STALE, latido: STALE },
			actualizado: '2026-10-25T16:00:00Z',
		}),
		task('m3', {
			num: 4,
			grupo: 'medicion',
			fase: 3,
			requisitos: [{ tipo: 'tarea', ref: 'sola' }],
		}),
		task('m4', { num: 5, grupo: 'medicion', fase: 4, estado: 'bloqueada' }),
		task('g1', {
			num: 6,
			grupo: 'suelto',
			estado: 'en curso',
			candado: { desde: RECENT, latido: RECENT },
		}),
		task('g2', { num: 7, grupo: 'suelto', estado: 'hecha' }),
		task('cerrado', { num: 8, grupo: 'viejo', estado: 'hecha' }),
		task('madre-hecha', { num: 9, estado: 'hecha' }),
		task('hija', { num: 10, padre: 'madre-hecha', estado: 'hecha' }),
		task('sola', { num: 11 }),
	],
};

describe('board project strip (T468)', () => {
	it('lists one project per open mother or open headless group, with progress, blocks and silent locks', () => {
		const out = probe(
			BOARD,
			`console.log(JSON.stringify(m.projects(board, ${NOW}).map((x) => ({ key: x.key, nombre: x.nombre, mother: x.mother?.id ?? null, total: x.p.total, hechas: x.p.hechas, pct: x.p.pct, enCurso: x.p.enCurso, bloqueadas: x.bloqueadas.map((b) => [b.t.id, b.motivos.length]), silenciosas: x.silenciosas.map((s) => s.id), actualizado: x.actualizado }))));`,
		);
		expect(out).toEqual([
			{
				key: 'medicion',
				nombre: 'medicion',
				mother: 'medicion',
				total: 4,
				hechas: 1,
				pct: 25,
				enCurso: 1,
				bloqueadas: [
					['m3', 1],
					['m4', 1],
				],
				silenciosas: ['m2'],
				actualizado: '2026-10-25T16:00:00Z',
			},
			{
				key: 'grupo:suelto',
				nombre: 'suelto',
				mother: null,
				total: 2,
				hechas: 1,
				pct: 50,
				enCurso: 1,
				bloqueadas: [],
				silenciosas: [],
				actualizado: null,
			},
		]);
	});

	it('prints one list line per project before the Calendario and Bloqueadas lines', () => {
		const out = probe(
			BOARD,
			`console.log(JSON.stringify({ lines: m.projectLines(board, ${NOW}), tail: m.listTail(board, ${NOW}), empty: m.projectLines({ tareas: [] }, ${NOW}) }));`,
		);
		expect(out.lines[0]).toBe('Proyectos (2):');
		expect(out.lines[1]).toBe(
			'  medicion: 1/4 (25 %) · fase 2 de 4 · 1 en curso · 2 bloqueadas · candado sin latido: T3',
		);
		expect(out.lines[2]).toBe('  suelto: 1/2 (50 %) · 1 en curso');
		const tail = out.tail.split('\n').filter(Boolean);
		expect(tail.slice(0, 3)).toEqual(out.lines);
		expect(tail.at(-1)).toMatch(/^Bloqueadas/);
		expect(out.empty).toEqual([]);
	});

	it('nests a mother under an open mother instead of listing it twice', () => {
		const board = {
			tareas: [
				task('top', { num: 1 }),
				task('mid', { num: 2, padre: 'top' }),
				task('leaf', { num: 3, padre: 'mid' }),
			],
		};
		const out = probe(
			board,
			`console.log(JSON.stringify(m.projects(board, ${NOW}).map((x) => x.key)));`,
		);
		expect(out).toEqual(['top']);
	});
});

describe('board project strip view (T468)', () => {
	const html = readFileSync(path.join(ROOT, 'scripts/board/view.html'), 'utf8');
	const fnBody = (name: string) => {
		const body = new RegExp(`function ${name}\\(x\\)\\{([\\s\\S]*?)\\n\\}`).exec(html)?.[1];
		expect(body).toBeDefined();
		return body!;
	};
	const esc = (s: unknown) =>
		String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
	const projectHtml = (x: unknown, open = new Set<string>()) =>
		new Function(
			'x',
			'subtasksOf',
			'S',
			'tN',
			'tt',
			'esc',
			'taskTag',
			'fmt',
			'ago',
			'tgHtml',
			'OPEN',
			'progHtml',
			'subsHtml',
			fnBody('projectHtml'),
		)(
			x,
			() => [{ id: 'a' }, { id: 'b' }],
			{ board: {} },
			(t: { num: number }) => `T${t.num} · `,
			esc,
			esc,
			(t: { num: number }) => `T${t.num}`,
			(s: string) => s,
			() => 'hace 2 h',
			(k: string, n: number) => `<tg ${k} ${n}>`,
			open,
			() => '<prog>',
			(k: string) => `<subs ${k}>`,
		) as string;

	const base = {
		key: 'medicion',
		mother: { id: 'medicion', num: 1, titulo: 'Medición' },
		grupo: null,
		p: {},
		bloqueadas: [{ t: { num: 4 }, motivos: ['Espera T3', 'Espera su carril'] }],
		silenciosas: [],
		actualizado: '2026-10-25T16:00:00Z',
	};

	it('renders the mother row with progress, blocked reasons, last update and a subtasks toggle', () => {
		const out = projectHtml(base, new Set(['subs:medicion']));
		expect(out).toContain('<div class="ghead" data-proj="medicion">');
		expect(out).toContain('<tg subs:medicion 2>');
		expect(out).toContain(
			'data-toggle="subs:medicion" aria-expanded="true">T1 · Medición</button>',
		);
		expect(out).toContain('<prog>');
		expect(out).toContain('<span class="bk">T4 espera: Espera T3; Espera su carril</span>');
		expect(out).toContain('actualizado hace 2 h');
		expect(out).toContain('<subs medicion>');
		expect(out).not.toContain('silent');
	});

	it('turns the row red and names the task when a subtask lock is silent', () => {
		const out = projectHtml({ ...base, silenciosas: [{ num: 3 }], actualizado: null });
		expect(out).toContain('<div class="ghead silent"');
		expect(out).toContain('<span class="sl">Candado sin latido: T3</span>');
		expect(out).toContain('aria-expanded="false"');
		expect(out).not.toContain('actualizado');
	});

	it('names a headless group and places the strip before «Para usted» in General', () => {
		expect(
			projectHtml({ ...base, key: 'grupo:suelto', mother: null, grupo: 'suelto' }),
		).toContain('>Grupo suelto</button>');
		const general = html.slice(html.indexOf('id="p-general"'));
		expect(general.indexOf('id="gs-proj"')).toBeGreaterThan(-1);
		expect(general.indexOf('id="gen-proj"')).toBeLessThan(general.indexOf('Para usted'));
		expect(html).toMatch(
			/renderMine\(\);renderProjects\(\);|renderMine\(\);\s*renderProjects\(\);/,
		);
	});
});
