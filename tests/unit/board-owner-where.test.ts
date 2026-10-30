import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const NOW = Date.parse('2026-10-24T20:00:00Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

type Json = Record<string, unknown>;

function task(id: string, num: number, fields: Json = {}): Json {
	return {
		id,
		num,
		titulo: id,
		estado: 'pendiente',
		urgencia: 'normal',
		actor: 'sesion',
		agente: 'codex',
		requisitos: [],
		prompt: `f05 · T${num} · ${id}\nDECISIONES\n- ninguna`,
		rev: 1,
		actualizado: ago(5),
		...fields,
	};
}

function makeBoard(tareas: Json[], extra: Json = {}): Json {
	return { tareas, archivo: [], bitacora: [], decisiones: [], agentes: [], ...extra };
}

/**
 * Run `code` with `w` = owner-where.mjs, `n` = next.mjs, `f` = format.mjs, `p` = view-payload.mjs and `board`;
 * its printed JSON is returned.
 */
function probe(board: Json, code: string) {
	const href = (f: string) => pathToFileURL(path.join(BOARD, f)).href;
	const src = [
		'const [w, n, f, p] = await Promise.all(process.argv.slice(1, 5).map((u) => import(u)));',
		'const board = JSON.parse(process.argv[5]);',
		code,
	].join('\n');
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			src,
			href('owner-where.mjs'),
			href('next.mjs'),
			href('format.mjs'),
			href('view-payload.mjs'),
			JSON.stringify(board),
		],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

const dest = (board: Json, id: string) =>
	probe(
		board,
		`console.log(JSON.stringify(w.taskDestination(board.tareas.find((t) => t.id === ${JSON.stringify(id)}), board, ${NOW})));`,
	);

const POINTER = 'Corra pnpm board prompt';

describe('owner destinations (T391)', () => {
	it('lists the six destination kinds', () => {
		expect(probe(makeBoard([]), 'console.log(JSON.stringify(w.DESTINO_TIPOS));')).toEqual([
			'nueva',
			'revision',
			'respuesta',
			'correcciones',
			'guia',
			'autoriza',
		]);
	});

	it('(1) nueva: a new chat in the planned lane titled by the prompt, and a short pointer to copy', () => {
		const board = makeBoard([task('codex-lista', 1, { carrilPlaneado: 'f05-plataforma' })]);
		const d = dest(board, 'codex-lista');
		expect(d.tipo).toBe('nueva');
		expect(d.donde).toBe(
			'DÓNDE: Codex · proyecto f05-plataforma · chat nuevo «f05 · T1 · codex-lista»',
		);
		expect(d.copia).toBe(
			[
				d.donde,
				'Corra pnpm board prompt codex-lista y siga esa versión (siempre la actual).',
				'Si ya existe un chat de T1, siga en ese.',
			].join('\n'),
		);
		expect(d.copia).not.toContain('DECISIONES');
	});

	it('(2) revision: a new chat in Integration with the review title', () => {
		const board = makeBoard([
			task('origen', 1, { estado: 'en revision', pr: '#9', agente: 'claude' }),
			task('origen-revision', 2, {
				origen: 'origen',
				revisionSha: 'a'.repeat(40),
				prompt: 'REVISIÓN\n- ninguna',
			}),
		]);
		const d = dest(board, 'origen-revision');
		expect(d.tipo).toBe('revision');
		expect(d.donde).toBe(
			'DÓNDE: Codex · F4 · Integración (carpeta celebra-me) · chat nuevo «f04 · T2 · PR #9 · Revisión»',
		);
		expect(d.copia).toContain(`${POINTER} origen-revision`);
	});

	it('(3) respuesta: the existing chat and only the RESPUESTA blocks', () => {
		const board = makeBoard(
			[
				task('con-respuesta', 1, {
					estado: 'en curso',
					candado: {
						agente: 'codex',
						carril: 'f07-invitaciones',
						titulo: 'f07 · T1 · con-respuesta',
						desde: ago(10),
					},
				}),
			],
			{
				decisiones: [
					{
						id: 'd900',
						respuestas: [
							{ tarea: 'con-respuesta', rev: 1, pregunta: '¿A o B?', opcion: 'A' },
						],
					},
				],
			},
		);
		const d = probe(
			board,
			'console.log(JSON.stringify(w.answerDestination(board.tareas[0], board)));',
		);
		expect(d.tipo).toBe('respuesta');
		expect(d.donde).toBe(
			'DÓNDE: Codex · proyecto f07-invitaciones · chat existente «f07 · T1 · con-respuesta»',
		);
		expect(d.copia).toContain('RESPUESTA · T1 con-respuesta');
		expect(d.copia).toContain('Opción elegida: A');
		expect(d.copia).not.toContain(POINTER);
	});

	it('(4) correcciones: the author chat and only the findings, also as a coordinator row (T489)', () => {
		const board = makeBoard(
			[
				task('autor', 1, {
					estado: 'en revision',
					pr: '#9',
					sesion: { agente: 'gemini', carril: 'f08-demos', nombre: 'f08 · T1 · autor' },
				}),
			],
			{
				bitacora: [
					{
						id: 'b1',
						en: ago(3),
						tarea: 'autor',
						quien: 'claude',
						mensaje: {
							para: 'gemini',
							revision: true,
							texto: 'Corrija el enlace roto.',
						},
					},
				],
			},
		);
		const out = probe(
			board,
			`const r = board.bitacora[0];
			const coordinador = n.nextSections(board, { now: ${NOW} }).coordinador;
			console.log(JSON.stringify({ d: w.findingsDestination(r, board, ${NOW}), coordinador, lines: n.sectionLines({ usted: [], coordinador, detenidas: [] }) }));`,
		);
		expect(out.d).toEqual({
			tipo: 'correcciones',
			donde: 'DÓNDE: Gemini · proyecto f08-demos · chat existente «f08 · T1 · autor»',
			copia: 'DÓNDE: Gemini · proyecto f08-demos · chat existente «f08 · T1 · autor»\nCorrija el enlace roto.',
		});
		const row = out.coordinador.find((x: Json) => x.destino === 'correcciones');
		expect(row.texto).toBe('Correcciones para Gemini: Corrija el enlace roto.');
		expect(out.lines.join('\n')).toContain(`  - ${out.d.donde}\n    ${row.texto}`);
	});

	it('(5) guia: a new guide chat in Integration that runs the current prompt', () => {
		const board = makeBoard([task('de-usted', 1, { actor: 'dueno', agente: 'cualquiera' })]);
		const d = dest(board, 'de-usted');
		expect(d.tipo).toBe('guia');
		expect(d.donde).toBe(
			'DÓNDE: Claude · F4 · Integración (carpeta celebra-me) · chat nuevo «f04 · T1 · Guía»',
		);
		expect(d.copia).toContain('corra pnpm board prompt de-usted y siga esa versión');
		expect(d.copia).toContain('No actúe en mis cuentas');
	});

	it('(6) autoriza: the coordinator card, nothing to copy', () => {
		const board = makeBoard([task('autoriza', 1, { actor: 'coordinador', toca: ['merge'] })]);
		expect(dest(board, 'autoriza')).toEqual({
			tipo: 'autoriza',
			donde: 'DÓNDE: tarjeta del coordinador · sin prompt (autoriza merge)',
			copia: null,
		});
	});

	it('never offers a paused agent: the row says until when and copies nothing', () => {
		const pausa = { hasta: '2026-11-02T12:00:00Z' };
		const board = makeBoard(
			[task('solo-codex', 1), task('de-usted', 2, { actor: 'dueno', agente: 'cualquiera' })],
			{
				agentes: [
					{ id: 'codex', pausa },
					{ id: 'claude', pausa },
				],
			},
		);
		expect(dest(board, 'solo-codex')).toEqual({
			tipo: 'nueva',
			donde: 'DÓNDE: Codex en pausa hasta 2026-11-02: espere',
			copia: null,
		});
		// The guide falls back to the next agent that is not paused.
		expect(dest(board, 'de-usted').donde).toBe(
			'DÓNDE: Gemini · F4 · Integración (carpeta celebra-me) · chat nuevo «f04 · T2 · Guía»',
		);
		expect(
			probe(
				board,
				`console.log(JSON.stringify(w.pasteAgents(board.tareas[0], board, ${NOW})));`,
			),
		).toEqual({ agentes: [], paused: ['codex'] });
		const expired = makeBoard([task('solo-codex', 1)], {
			agentes: [{ id: 'codex', pausa: { hasta: ago(1) } }],
		});
		expect(dest(expired, 'solo-codex').donde).toContain('DÓNDE: Codex · ');
	});

	it('names a free lane as fNN, skips a paused guide chat and indents multi-line rows', () => {
		const laneless = makeBoard([task('sin-carril', 1, { prompt: 'DECISIONES\n- ninguna' })]);
		expect(
			probe(
				laneless,
				'console.log(JSON.stringify(w.sessionTitle(board.tareas[0], board, null)));',
			),
		).toBe('fNN · T1 · sin-carril');
		const board = makeBoard(
			[
				task('de-usted', 2, {
					actor: 'dueno',
					agente: 'cualquiera',
					sesion: {
						agente: 'codex',
						carril: 'f05-plataforma',
						nombre: 'f05 · T2 · de-usted',
					},
				}),
			],
			{ agentes: [{ id: 'codex', pausa: { hasta: '2026-11-02T12:00:00Z' } }] },
		);
		expect(dest(board, 'de-usted').donde).toContain('Claude · F4 · Integración');
		const lines = probe(
			makeBoard([]),
			`console.log(JSON.stringify(n.sectionLines({ usted: [{ donde: 'DÓNDE: x', texto: 'a\\nb' }], coordinador: [], detenidas: [] })));`,
		);
		expect(lines.join('\n')).toContain('  - DÓNDE: x\n    a\n    b');
	});

	it('gives every coordinator row its DÓNDE and the short text to copy', () => {
		const board = makeBoard([task('codex-lista', 1, { carrilPlaneado: 'f05-plataforma' })]);
		const rows = probe(
			board,
			`console.log(JSON.stringify(n.nextSections(board, { now: ${NOW} }).coordinador));`,
		);
		const row = rows.find((x: Json) => x.destino === 'nueva');
		expect(row.donde).toContain('chat nuevo «f05 · T1 · codex-lista»');
		expect(row.copia).toContain(`${POINTER} codex-lista`);
	});

	it('keeps the prompt title in the light payload and serves owner-where.mjs to the view', () => {
		const board = makeBoard([task('codex-lista', 1)]);
		const out = probe(
			board,
			'const s = p.taskSummary(board.tareas[0], board); console.log(JSON.stringify({ prompt: s.prompt, titulo: s.promptTitulo }));',
		);
		expect(out).toEqual({ prompt: true, titulo: 'f05 · T1 · codex-lista' });
		const server = readFileSync(path.join(BOARD, 'view-server.mjs'), 'utf8');
		expect(server).toContain("'/owner-where.mjs'");
		const html = readFileSync(path.join(BOARD, 'view.html'), 'utf8');
		expect(html).toContain('data-copytext=');
	});
});
