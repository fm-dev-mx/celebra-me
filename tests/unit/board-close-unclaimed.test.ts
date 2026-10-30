import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

/**
 * T480: a kind's task waiting for its lane says so instead of «Falta el prompt», the coordinator closes a task
 * nobody claimed without a git-safety failure, and `merged` never takes a review round for its origin.
 */
const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const SCRIPT_PATH = path.join(BOARD, 'board.mjs');
const NOW = '2026-10-29T12:00:00Z';
const FULL = [
	'--resumen=Hecho.',
	'--comprobacion=type-check',
	'--saltada=ninguna',
	'--pendiente=ninguno',
	'--fallida=ninguna',
	'--riesgo=ninguno',
	'--duda=ninguna',
	'--excepcion=ninguna',
];

type Json = Record<string, any>;
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-unclaimed-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'));
	for (const [i, t] of tareas.entries())
		writeFileSync(
			path.join(dir, 'tareas', `${t.id}.json`),
			JSON.stringify({
				num: i + 1,
				titulo: t.id,
				estado: 'pendiente',
				urgencia: 'normal',
				actor: 'sesion',
				requisitos: [],
				rev: 1,
				actualizado: NOW,
				...t,
			}),
		);
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

describe('a kind task waiting for its lane (T480)', () => {
	it('asks for the lane, not for a prompt the coordinator never writes', () => {
		const r = probe(
			'model.mjs',
			`const board = { tareas: [] };
			const kind = { id: 'k', estado: 'pendiente', tipo: 'revision-landing', busca: 'landing' };
			const out = [kind, { ...kind, busca: '' }, { id: 'p', estado: 'pendiente' }].map((t) =>
				m.requisitos(t, board).map((q) => [q.tipo, m.requisitoText(q, board), m.requisitoText(q, board, { espera: true })]));
			console.log(JSON.stringify(out));`,
		);
		expect(r[0]).toEqual([
			[
				'carril',
				'Falta el carril: pnpm board plan k --carril=<carril> --coordinador --rev=<n>',
				'Espera su carril: pnpm board plan k --carril=<carril> --coordinador --rev=<n>',
			],
		]);
		expect(r[1][0][0]).toBe('prompt');
		expect(r[2][0][1]).toBe('Falta el prompt (lo escribe el coordinador)');
	});
});

describe('the coordinator closes a task nobody claimed (T480)', () => {
	it('moves it to revisión and skips git-safety instead of failing', () => {
		const dir = makeBoard([{ id: 'suelta', rama: 'fix/suelta' }]);
		const r = cli(dir, [
			'close',
			'suelta',
			'--coordinador',
			'--pr=#9',
			'--git-safety=commit',
			...FULL,
		]);
		expect(r.err).toBe('');
		expect(r.status).toBe(0);
		expect(r.out).toContain(
			'git-safety: suelta no tenía candado; se cerró sin sesión de carril',
		);
		expect(readTask(dir, 'suelta')).toMatchObject({ estado: 'en revision', pr: '#9' });
	});

	it('prints no git-safety line without --git-safety', () => {
		const dir = makeBoard([{ id: 'suelta' }]);
		const r = cli(dir, ['close', 'suelta', '--coordinador', '--pr=#9', ...FULL]);
		expect(r.status).toBe(0);
		expect(r.out).not.toContain('git-safety');
	});
});

describe('merged with a review round on the same PR (T480)', () => {
	const board = {
		tareas: [
			{ id: 'xv', num: 455, pr: '#670', estado: 'en revision' },
			{ id: 'xv-revision', num: 456, pr: '#670', origen: 'xv', revisionSha: 'a'.repeat(40) },
			{ id: 'otra', num: 7, pr: '#671' },
			{ id: 'otra-bis', num: 8, cierre: { pr: '#671' } },
		],
		archivo: [{ id: 'vieja', num: 3, pr: '#670' }],
	};
	const ref = (args: unknown[]) =>
		probe(
			'close-commands.mjs',
			`try { console.log(JSON.stringify({ id: m.mergedRef(...${JSON.stringify(args)}, ${JSON.stringify(board)}) })); }
			catch (e) { console.log(JSON.stringify({ error: e.message })); }`,
		);

	it('resolves --pr to the origin task, never its review or an archived one', () => {
		expect(ref([undefined, '670'])).toEqual({ id: 'xv' });
		expect(ref([undefined, '#670'])).toEqual({ id: 'xv' });
		expect(ref(['otra', '#671'])).toEqual({ id: 'otra' });
	});

	it('names the origin when given a review round', () => {
		expect(ref(['T456', undefined]).error).toBe(
			'T456 es la revisión de T455 (se cierra con su --sha); use pnpm board merged T455 --coordinador',
		);
	});

	it('asks for an id when the PR matches none or several tasks', () => {
		expect(ref([undefined, '#999']).error).toContain('ninguna tarea del tablero tiene #999');
		expect(ref([undefined, '#671']).error).toBe('#671 está en T7, T8: indique <id>');
		expect(ref([undefined, undefined]).error).toBe('falta <id> o --pr=#<número>');
	});

	it('moves the origin from the CLI with only --pr', () => {
		const dir = makeBoard([
			{ id: 'xv', pr: '#670', estado: 'en revision' },
			{ id: 'xv-revision', pr: '#670', origen: 'xv', revisionSha: 'a'.repeat(40) },
		]);
		const r = probe(
			'board.mjs',
			`const out = () => {};
			await m.run(['merged', '--coordinador', '--pr=#670'], { dir: ${JSON.stringify(dir)}, out, prState: () => 'MERGED' });
			console.log('null');`,
		);
		expect(r).toBeNull();
		expect(readTask(dir, 'xv').estado).toBe('unida');
		expect(readTask(dir, 'xv-revision').estado).toBe('pendiente');
	});
});
