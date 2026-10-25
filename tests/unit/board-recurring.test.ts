import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const RECURRING_PATH = path.join(ROOT, 'scripts', 'board', 'recurring.mjs');
const OLD = '2026-10-01T08:00:00Z';

type Json = Record<string, unknown>;
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const PERIODIC: Json = {
	id: 'salud-carriles',
	titulo: 'salud-carriles',
	estado: 'en curso',
	urgencia: 'normal',
	actor: 'sesion',
	agente: 'claude',
	cada: '7d',
	requisitos: [{ tipo: 'fecha', ref: OLD, ok: true }],
	rev: 1,
	actualizado: OLD,
	carril: 'f10-libre',
	rama: 'chore/salud-carriles',
	pr: '#600',
	candado: { agente: 'claude', desde: OLD, sesion: 'local_x', carril: 'f10-libre' },
};

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-recurring-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	for (const { id, ...doc } of tareas)
		writeFileSync(path.join(dir, 'tareas', `${id}.json`), JSON.stringify(doc));
	return dir;
}

function cli(dir: string, ...args: string[]) {
	const result = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({
			CELEBRA_BOARD_DIR: dir,
			INIT_CWD: ROOT,
			CLAUDE_CODE_HOST_SESSION_ID: '',
		}),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

const read = (dir: string, id: string): Json =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

const CLOSE = [
	'--resumen=Carriles revisados.',
	'--comprobacion=pnpm board:verify',
	'--saltada=ninguna',
	'--pendiente=ninguno',
	'--coordinador',
];

/** recurring.mjs's nextCycle at a fixed `now`. */
function nextCycle(t: Json, now: string) {
	const src = `const m = await import(process.argv[1]); console.log(JSON.stringify(m.nextCycle(${JSON.stringify(t)}, Date.parse('${now}'))));`;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, pathToFileURL(RECURRING_PATH).href],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

describe('periodic tasks (cada, d268)', () => {
	it('moves the fecha requisito by whole cycles past now, or adds one a cycle away', () => {
		const tarea = { tipo: 'tarea', ref: 'otra' };
		expect(
			nextCycle(
				{ cada: '7d', requisitos: [{ tipo: 'fecha', ref: OLD, ok: true }, tarea] },
				'2026-10-20T00:00:00Z',
			),
		).toEqual([{ tipo: 'fecha', ref: '2026-10-22T08:00:00Z' }, tarea]);
		// Closed before its date: still one cycle ahead.
		expect(
			nextCycle(
				{ cada: '14d', requisitos: [{ tipo: 'fecha', ref: OLD }] },
				'2026-09-30T00:00:00Z',
			),
		).toEqual([{ tipo: 'fecha', ref: '2026-10-15T08:00:00Z' }]);
		expect(nextCycle({ cada: '7d', requisitos: [tarea] }, '2026-10-20T00:00:00Z')).toEqual([
			tarea,
			{ tipo: 'fecha', ref: '2026-10-27T00:00:00Z' },
		]);
	});

	it('close ends the cycle: back to pendiente without lock, lane, PR or branch, with the next fecha', () => {
		const dir = makeBoard([PERIODIC]);
		const closed = cli(dir, 'close', 'salud-carriles', ...CLOSE);
		expect(closed.err).toBe('');
		expect(closed.status).toBe(0);
		expect(closed.out).toMatch(/cada 7d: vuelve a pendiente hasta \d{4}-\d{2}-\d{2}T08:00:00Z/);
		const t = read(dir, 'salud-carriles');
		expect(t).toMatchObject({ estado: 'pendiente', cada: '7d', rev: 2 });
		for (const k of ['candado', 'carril', 'pr', 'rama']) expect(t[k]).toBeUndefined();
		expect(t.sesion).toMatchObject({ id: 'local_x', agente: 'claude' });
		expect(t.cierre).toMatchObject({ resumen: 'Carriles revisados.' });
		const [fecha] = t.requisitos as Json[];
		expect(fecha.tipo).toBe('fecha');
		expect(Date.parse(String(fecha.ref))).toBeGreaterThan(Date.now());
		expect((Date.parse(String(fecha.ref)) - Date.parse(OLD)) % (7 * 86_400_000)).toBe(0);
	});

	it('leaves tasks without cada closed as before and refuses a cada that is not <n>d', () => {
		const dir = makeBoard([{ ...PERIODIC, id: 'normal', cada: undefined }]);
		expect(cli(dir, 'close', 'normal', ...CLOSE).status).toBe(0);
		expect(read(dir, 'normal')).toMatchObject({ estado: 'en curso', pr: '#600' });
		const bad = cli(
			dir,
			'set',
			'normal',
			'--rev=2',
			'--agente=claude',
			'--sesion=local_x',
			'cada=semanal',
		);
		expect(bad.status).not.toBe(0);
		expect(bad.err).toContain('cada debe ser <n>d');
	});
});
