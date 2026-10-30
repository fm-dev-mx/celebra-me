import { readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const NOW = Date.parse('2026-10-30T12:00:00Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

type Json = Record<string, unknown>;

function task(id: string, fields: Json = {}): Json {
	return {
		id,
		num: 1,
		titulo: id,
		estado: 'pendiente',
		urgencia: 'normal',
		actor: 'sesion',
		agente: 'cualquiera',
		requisitos: [],
		prompt: `T1 · ${id}\nDECISIONES\n- ninguna`,
		rev: 1,
		actualizado: ago(5),
		...fields,
	};
}

const msg = (id: string, texto: string, fields: Json = {}) => ({
	tarea: 'a',
	en: ago(10),
	quien: 'claude',
	mensaje: { id, para: 'dueno', texto },
	...fields,
});

/** Run a snippet with `n` = next.mjs, `t` = owner-text.mjs and `board` = the given board; returns its JSON. */
function probe(board: Json, code: string) {
	const href = (f: string) => pathToFileURL(path.join(BOARD, f)).href;
	const src = `const n = await import(process.argv[1]); const t = await import(process.argv[2]);
		const board = JSON.parse(process.argv[3]); const now = ${NOW}; ${code}`;
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			src,
			href('next.mjs'),
			href('owner-text.mjs'),
			JSON.stringify(board),
		],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

const inbox = (board: Json) =>
	probe(
		board,
		`console.log(JSON.stringify(n.ownerInbox(board, { now }).map(r => ({ tipo: r.tipo, texto: r.texto, clave: r.clave, veces: r.veces ?? 1 }))));`,
	);

describe('T489 owner inbox', () => {
	it('lists only decidir, aprobar and hacer rows, with dispatch left to the coordinator', () => {
		const board = {
			tareas: [
				task('a', { num: 1 }),
				task('lista', { num: 2, agente: 'codex' }),
				task('dueno', { num: 3, actor: 'dueno', titulo: 'Pagar el dominio' }),
			],
			bitacora: [
				msg('q1', '¿Usa la opción corta o la larga?', { tarea: 'a' }),
				msg('q2', '¿Aprueba el PR #12?', { tarea: 'a' }),
			],
		};
		const rows = inbox(board);
		expect(rows.map((r: Json) => r.tipo).sort()).toEqual(['aprobar', 'decidir', 'hacer']);
		expect(
			rows.every((r: Json) => ['decidir', 'aprobar', 'hacer'].includes(String(r.tipo))),
		).toBe(true);
		expect(rows.find((r: Json) => r.tipo === 'hacer').texto).toContain('Pagar el dominio');
		const coordinador = probe(
			board,
			`console.log(JSON.stringify(n.nextSections(board, { now }).coordinador.map(r => r.texto)));`,
		);
		expect(coordinador.join('\n')).toContain('T2');
		expect(rows.map((r: Json) => r.texto).join('\n')).not.toContain('T2');
	});

	it('merges near-identical questions of one task and sender and keeps different ones apart', () => {
		const rows = inbox({
			tareas: [task('a')],
			bitacora: [
				msg('q1', 'Para T1 a, ¿publica la invitación hoy o mañana?'),
				msg('q2', '¿Publica la invitación hoy o mañana?', { en: ago(5) }),
				msg('q3', '¿Qué color lleva el botón principal?', { en: ago(4) }),
				msg('q4', '¿Publica la invitación hoy o mañana?', { quien: 'codex', en: ago(3) }),
			],
		});
		expect(rows).toHaveLength(3);
		const merged = rows.find((r: Json) => r.clave === 'mensaje:q1');
		expect(merged).toMatchObject({ tipo: 'decidir', veces: 2 });
		expect(merged.texto).toContain('(×2)');
	});

	it('merges every approval request of one task and sender into one aprobar row', () => {
		const rows = inbox({
			tareas: [task('a', { pr: '#7' })],
			bitacora: [
				msg('q1', '¿Aprueba unir el PR #7?'),
				msg('q2', '¿Aprueba el cambio de la tarjeta?', { en: ago(5) }),
			],
		});
		expect(rows).toEqual([
			expect.objectContaining({ tipo: 'aprobar', clave: 'mensaje:q1', veces: 2 }),
		]);
	});

	it('groups prod-alerta tasks of one problem with a counter and their dates', () => {
		const alert = (day: string, num: number, titulo: string) =>
			task(`prod-alerta-${day}-r2`, { num, actor: 'coordinador', titulo });
		const texts = probe(
			{
				tareas: [
					alert('2026-10-27', 1, 'Producción: fallan las subidas a R2'),
					alert('2026-10-29', 2, 'Producción: fallan las subidas a R2 (otra vez)'),
					alert('2026-10-28', 3, 'Producción: el inicio de sesión responde 500'),
				],
			},
			`console.log(JSON.stringify(n.nextSections(board, { now }).coordinador.map(r => r.texto)));`,
		);
		const grouped = texts.filter((x: string) => x.includes('×'));
		expect(grouped).toEqual([expect.stringContaining('×2 (2026-10-27, 2026-10-29)')]);
		expect(grouped[0]).toContain('T2');
		expect(texts.filter((x: string) => x.includes('inicio de sesión'))).toHaveLength(1);
	});
});

describe('T489 aviso', () => {
	const issues = (aviso: unknown) =>
		probe(
			{ t: { aviso } },
			`console.log(JSON.stringify(t.taskTextChecks.filter(([bad]) => bad(board.t)).map(([, why]) => why(board.t))));`,
		);

	it('accepts a plain aviso and rejects non-text, client names and amounts', () => {
		expect(issues('Falta aprobar la portada')).toEqual([]);
		expect(issues(3)).toEqual(['aviso debe ser texto']);
		expect(issues('Revisar la invitación de Andrea')).toEqual([
			'aviso no puede nombrar clientes (andrea)',
		]);
		expect(issues('Cobrar $1,500 del anticipo')).toEqual(['aviso no puede llevar montos']);
		expect(issues('Cobrar 800 pesos')).toEqual(['aviso no puede llevar montos']);
	});

	it('keeps CLIENT_NAMES in step with the published invitation slugs', () => {
		const tooling = new Set([
			'canonical-definition',
			'client-registry.generated',
			'generate-client-registry',
			'invitation-definition',
			'lifecycle-gate',
			'registry',
		]);
		const provision = readdirSync(path.join(ROOT, 'scripts', 'provision', 'invitations'))
			.filter((f) => f.endsWith('.ts'))
			.map((f) => f.replace(/\.ts$/, ''))
			.filter((f) => !tooling.has(f));
		const clients = readdirSync(path.join(ROOT, 'src', 'invitations', 'clients'), {
			withFileTypes: true,
		})
			.filter((d) => d.isDirectory())
			.map((d) => d.name);
		const slugWords = [
			...new Set([...provision, ...clients].flatMap((s) => s.split('-'))),
		].filter(
			(w) => w.length > 1, // «y» joins two names
		);
		const missing = probe(
			{ words: slugWords },
			`console.log(JSON.stringify(board.words.filter(w => !t.CLIENT_NAMES.has(t.fold(w)))));`,
		);
		expect(missing).toEqual([]);
	});
});
