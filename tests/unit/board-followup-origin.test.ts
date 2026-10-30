import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

/**
 * T481: a follow-up names the finished task it came from with `deriva`, an independent task that is neither a
 * subtask nor a waits-on edge; `show`, the sheet and the Mapa name the source.
 */
const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const SCRIPT_PATH = path.join(BOARD, 'board.mjs');
const NOW = '2026-10-30T12:00:00Z';

type Json = Record<string, any>;
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const base = (t: Json, i: number): Json => ({
	num: i + 1,
	titulo: t.id,
	estado: 'pendiente',
	urgencia: 'normal',
	actor: 'sesion',
	requisitos: [],
	rev: 1,
	actualizado: NOW,
	...t,
});

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-followup-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'));
	for (const [i, t] of tareas.entries())
		writeFileSync(path.join(dir, 'tareas', `${t.id}.json`), JSON.stringify(base(t, i)));
	return dir;
}

function cli(dir: string, args: string[]) {
	const result = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir, CLAUDE_CODE_HOST_SESSION_ID: '' }),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

const readTask = (dir: string, id: string): Json =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

/** Runs `code` with `m` = the board module `file`; its printed JSON is returned. */
function probe(file: string, code: string) {
	const src = `const m = await import(process.argv[1]); ${code}`;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, pathToFileURL(path.join(BOARD, file)).href],
		{ cwd: ROOT },
	);
	return JSON.parse(String(result.stdout));
}

describe('deriva on write and in show (T481)', () => {
	it('stores the source by id, refuses a missing source or the task itself and prints «Viene de»', () => {
		const dir = makeBoard([
			{ id: 'fuente', titulo: 'Fuente', estado: 'unida' },
			{ id: 'seguimiento', titulo: 'Seguimiento' },
		]);
		const set = (rev: number, value: string) =>
			cli(dir, ['set', 'seguimiento', `--rev=${rev}`, `deriva=${value}`, '--coordinador']);
		expect(set(1, 'nadie').err).toContain('deriva nadie no está en el tablero');
		expect(set(1, 'seguimiento').err).toContain('deriva no puede ser la misma tarea');
		expect(set(1, 'T1').status).toBe(0);
		const saved = readTask(dir, 'seguimiento');
		expect(saved.deriva).toBe('fuente');
		expect(saved.padre).toBeUndefined();
		const shown = cli(dir, ['show', 'seguimiento']).out;
		expect(shown).toContain('Viene de T1 · Fuente (unida)');
		expect(shown).not.toContain('Parte de');
		// The follow-up waits on nothing: the finished source is no requisito.
		expect(cli(dir, ['show', 'fuente']).out).not.toContain('Subtareas');
	});

	it('board:verify reports an open follow-up whose source left the board', () => {
		const r = probe(
			'subtasks.mjs',
			`console.log(JSON.stringify([
				m.sourceIssue({ id: 'b', deriva: 'a' }, { tareas: [{ id: 'a' }] }),
				m.sourceIssue({ id: 'b', deriva: 'x' }, { tareas: [{ id: 'a' }] }),
				m.sourceIssue({ id: 'b' }, { tareas: [] }),
				m.sourceText({ id: 'b', deriva: 'x' }, { tareas: [] }),
			]))`,
		);
		expect(r).toEqual([
			null,
			'deriva x no está en el tablero',
			null,
			'Viene de x (no está en el tablero)',
		]);
	});
});

describe('deriva in the Mapa (T481)', () => {
	it('draws a gray link from the finished source, right of it, that never waits or unlocks', () => {
		const g = probe(
			'dependency-graph.mjs',
			`console.log(JSON.stringify(m.dependencyGraph({ tareas: [
				{ id: 'fuente', num: 1, titulo: 'Fuente', estado: 'unida', requisitos: [] },
				{ id: 'seguimiento', num: 2, titulo: 'Seguimiento', estado: 'pendiente', requisitos: [], deriva: 'fuente' },
				{ id: 'huerfana', num: 3, titulo: 'Huérfana', estado: 'pendiente', requisitos: [], deriva: 'nadie' },
			] })))`,
		);
		expect(g.aristas).toEqual([{ de: 'fuente', a: 'seguimiento', tipo: 'deriva', ok: true }]);
		const node = (id: string) => g.nodos.find((n: Json) => n.id === id);
		expect(node('fuente')).toMatchObject({ tipo: 'hecha', capa: 0, desbloquea: 0 });
		expect(node('seguimiento')).toMatchObject({ tipo: 'tarea', capa: 1, desbloquea: 0 });
		expect(g.avisos).toEqual([
			expect.objectContaining({
				tipo: 'ref',
				tarea: 'huerfana',
				texto: expect.stringContaining('viene de «nadie»'),
			}),
		]);
	});
});

describe('deriva survives archive and compaction (T481)', () => {
	it('the view payload keeps an archived source a live follow-up names', () => {
		const p = probe(
			'view-payload.mjs',
			`const board = { tareas: [
				{ id: 'fuente', num: 1, titulo: 'Fuente', estado: 'unida', archivada: '2026-10-29T00:00:00Z', prompt: 'x' },
				{ id: 'seguimiento', num: 2, titulo: 'Seguimiento', estado: 'pendiente', requisitos: [], deriva: 'fuente' },
			], archivo: [], decisiones: [], bitacora: [] };
			const live = m.liveBoard(board);
			console.log(JSON.stringify({
				tareas: live.tareas.map((t) => [t.id, t.deriva ?? null]),
				archivo: live.archivo.map((t) => t.id),
			}))`,
		);
		expect(p.tareas).toEqual([['seguimiento', 'fuente']]);
		expect(p.archivo).toEqual(['fuente']);
	});
});
