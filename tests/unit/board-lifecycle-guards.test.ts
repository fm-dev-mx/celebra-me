import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/board-command';

/**
 * T543: the board's lifecycle guards. A claim always records its session, a close never leaves a pendiente
 * without its task, and a review round lives only inside its task: a legacy `<id>-revision.json` moves in.
 */
const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const STORE_PATH = path.join(ROOT, 'scripts', 'board', 'store.mjs');
const OLD = '2026-10-01T08:00:00Z';
const SHA = `3c35826${'b'.repeat(33)}`;
const SHA2 = `4d46937${'c'.repeat(33)}`;

type Json = Record<string, any>;
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const BASE: Json = {
	urgencia: 'normal',
	actor: 'sesion',
	agente: 'cualquiera',
	requisitos: [],
	rev: 1,
	actualizado: OLD,
};

const ORIGIN: Json = {
	...BASE,
	id: 'codigo',
	num: 1,
	titulo: 'codigo',
	estado: 'en revision',
	agente: 'claude',
	pr: '#530',
	cierre: { resumen: 'Hecho.', comprobaciones: [], saltadas: [], pendientes: [], en: OLD },
};

/** A round written as its own task file, as the board did before T529. */
const LEGACY: Json = {
	...BASE,
	id: 'codigo-revision',
	num: 2,
	titulo: 'Revisión de codigo',
	estado: 'hecha',
	agente: 'gemini',
	origen: 'codigo',
	revisionSha: SHA,
	vuelta: 1,
};

const LISTS = ['--fallida=ninguna', '--riesgo=ninguno', '--duda=ninguna', '--excepcion=ninguna'];

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-guards-'));
	dirs.push(dir);
	writeFileSync(path.join(dir, 'answers.json'), '{}');
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
			CELEBRA_BOARD_COMMAND_FIXTURE: path.join(dir, 'answers.json'),
			CLAUDE_CODE_HOST_SESSION_ID: '',
		}),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

const fileOf = (dir: string, id: string) => path.join(dir, 'tareas', `${id}.json`);
const onDisk = (dir: string, id: string): Json => JSON.parse(readFileSync(fileOf(dir, id), 'utf8'));

describe('board lifecycle guards (T543)', () => {
	it('refuses a claim with no session and writes nothing', () => {
		const dir = makeBoard([
			{ ...BASE, id: 'tarea', num: 1, titulo: 'tarea', estado: 'pendiente' },
		]);
		const codex = cli(dir, 'claim', 'tarea', '--agente=codex');
		expect(codex.status).toBe(2);
		expect(codex.err).toContain('falta --sesion=<id>');
		const claude = cli(dir, 'claim', 'tarea', '--agente=claude');
		expect(claude.status).toBe(2);
		expect(claude.err).toContain('falta --sesion');
		expect(onDisk(dir, 'tarea').candado).toBeUndefined();
	});

	it('refuses a close whose pendiente names no task', () => {
		const dir = makeBoard([
			{ ...BASE, id: 'tarea', num: 1, titulo: 'tarea', estado: 'en curso' },
		]);
		const r = cli(
			dir,
			'close',
			'tarea',
			'--coordinador',
			'--quien=claude',
			'--resumen=Hecho.',
			...LISTS,
			'--comprobacion=pnpm validate:changed',
			'--saltada=ninguna',
			'--pendiente=Falta la segunda vuelta',
		);
		expect(r.status).not.toBe(0);
		expect(`${r.out}${r.err}`).toContain('pendiente sin tarea: «Falta la segunda vuelta»');
		expect(onDisk(dir, 'tarea').estado).toBe('en curso');
	});

	it('moves a legacy round file into its task before opening the next round', () => {
		const dir = makeBoard([ORIGIN, LEGACY]);
		const r = cli(
			dir,
			'review',
			'codigo',
			`--sha=${SHA2}`,
			'--agente=gemini',
			'--coordinador',
			'--quien=claude',
		);
		expect(r.status).toBe(0);
		expect(existsSync(fileOf(dir, 'codigo-revision'))).toBe(false);
		expect(existsSync(fileOf(dir, 'codigo-revision-2'))).toBe(false);
		const rondas = onDisk(dir, 'codigo').rondas;
		expect(rondas.map((x: Json) => [x.id, x.vuelta, x.estado])).toEqual([
			['codigo-revision', 1, 'hecha'],
			['codigo-revision-2', 2, 'pendiente'],
		]);
		expect(rondas[0].origen).toBeUndefined();
	});

	it('leaves a task merely named <id>-revision where it is', () => {
		const { origen, ...task } = LEGACY;
		const dir = makeBoard([ORIGIN, { ...task, estado: 'pendiente' }]);
		const r = cli(dir, 'migrate-rounds', 'codigo', '--aplicar');
		expect(r.out).toContain('Movidas 0 rondas');
		expect(origen).toBe('codigo');
		expect(existsSync(fileOf(dir, 'codigo-revision'))).toBe(true);
		expect(onDisk(dir, 'codigo').rondas).toBeUndefined();
	});

	it('migrate-rounds lists legacy rounds and moves them only with --aplicar', () => {
		const dir = makeBoard([ORIGIN, LEGACY]);
		const dry = cli(dir, 'migrate-rounds', 'codigo');
		expect(dry.status).toBe(0);
		expect(dry.out).toContain('Por mover 1 rondas a tareas/codigo.json');
		expect(dry.out).toContain('Para moverlas: --aplicar');
		expect(existsSync(fileOf(dir, 'codigo-revision'))).toBe(true);
		expect(onDisk(dir, 'codigo').rondas).toBeUndefined();

		const applied = cli(dir, 'migrate-rounds', 'codigo', '--aplicar');
		expect(applied.status).toBe(0);
		expect(applied.out).toContain('Movidas 1 rondas a tareas/codigo.json');
		expect(existsSync(fileOf(dir, 'codigo-revision'))).toBe(false);
		expect(onDisk(dir, 'codigo').rondas).toMatchObject([
			{ id: 'codigo-revision', num: 2, vuelta: 1, estado: 'hecha', revisionSha: SHA },
		]);
		const shown = cli(dir, 'show', 'codigo-revision');
		expect(shown.status).toBe(0);

		const again = cli(dir, 'migrate-rounds', 'codigo', '--aplicar');
		expect(again.out).toContain('Movidas 0 rondas');
	});

	it('never writes a round as a task file of its own', () => {
		const dir = makeBoard([]);
		const doc = { ...LEGACY, origen: 'huerfana', ronda: true };
		const src = `const m = await import(process.argv[1]); m.writeDoc(process.argv[2], 'tareas', 'huerfana-revision', ${JSON.stringify(doc)});`;
		const result = runCommand(
			process.execPath,
			['--input-type=module', '-e', src, pathToFileURL(STORE_PATH).href, dir],
			{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
		);
		expect(result.status).not.toBe(0);
		expect(String(result.stderr)).toContain(
			'huerfana-revision es una ronda de revisión sin tarea en tareas',
		);
		expect(existsSync(fileOf(dir, 'huerfana-revision'))).toBe(false);
	});
});
