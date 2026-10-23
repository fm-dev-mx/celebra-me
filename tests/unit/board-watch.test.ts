import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'watch.mjs');
const NOW = '2026-10-20T20:00:00Z';

type Json = Record<string, unknown>;
const dirs: string[] = [];

function task(id: string, fields: Json = {}): Json {
	return {
		id,
		titulo: id,
		estado: 'pendiente',
		urgencia: 'normal',
		actor: 'sesion',
		agente: 'codex',
		requisitos: [],
		prompt: `Tarea ${id}.\nDECISIONES\n- ninguna`,
		rev: 1,
		actualizado: NOW,
		...fields,
	};
}

/** Run a module snippet with the watcher's exports as `m`; the snippet's printed JSON is returned. */
function probe(code: string) {
	const src = `const m = await import(process.argv[1]); ${code}`;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, pathToFileURL(SCRIPT_PATH).href],
		{ cwd: ROOT, env: sanitizeEnv({}) },
	);
	return JSON.parse(String(result.stdout));
}

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-watch-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'board', 'tareas'), { recursive: true });
	for (const { id, ...doc } of tareas)
		writeFileSync(path.join(dir, 'board', 'tareas', `${id}.json`), JSON.stringify(doc));
	return dir;
}

function watch(dir: string, ...args: string[]) {
	const result = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({
			CELEBRA_BOARD_DIR: path.join(dir, 'board'),
			CELEBRA_BOARD_WATCH_STATE: path.join(dir, 'board-watch.json'),
		}),
	});
	return { status: result.status, out: String(result.stdout) };
}

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('pnpm board:watch', () => {
	it('writes the notice with the agent name, the T number and the short name', () => {
		const out = probe(`console.log(JSON.stringify([
			m.message('codex', [{ id: 'serenata-fotos', num: 34 }]),
			m.message('gemini', [{ id: 'a', num: 1 }, { id: 'b' }]),
		]));`);
		expect(out).toEqual([
			'Codex tiene 1 tarea lista: T34 serenata-fotos',
			'Gemini tiene 2 tareas listas: T1 a, b',
		]);
	});

	it('announces only tasks it has not announced yet, and forgets tasks that stop being ready', () => {
		const out = probe(`
			const a = { id: 'a', num: 1 }, b = { id: 'b', num: 2 };
			const first = m.diff({ codex: [a], claude: [] }, {});
			const again = m.diff({ codex: [a], claude: [] }, first.seen);
			const more = m.diff({ codex: [a, b], claude: [] }, again.seen);
			const gone = m.diff({ codex: [b], claude: [] }, more.seen);
			const back = m.diff({ codex: [a, b], claude: [] }, gone.seen);
			console.log(JSON.stringify({ first, again, more, back }));`);
		expect(out.first.notices).toEqual([
			{ agente: 'codex', text: 'Codex tiene 1 tarea lista: T1 a' },
		]);
		expect(out.again.notices).toEqual([]);
		expect(out.more.notices).toEqual([
			{ agente: 'codex', text: 'Codex tiene 1 tarea lista: T2 b' },
		]);
		expect(out.back.notices.map((n: Json) => n.text)).toEqual([
			'Codex tiene 1 tarea lista: T1 a',
		]);
	});

	it('picks only ready tasks each agent can take, and --dry-run keeps no memory', () => {
		const dir = makeBoard([
			task('lista', { num: 7 }),
			task('apartada', { candado: { agente: 'codex', desde: NOW } }),
			task('del-dueno', { toca: ['produccion'] }),
			task('espera', { requisitos: [{ tipo: 'tarea', ref: 'lista' }] }),
			task('de-gemini', { agente: 'gemini', num: 9 }),
		]);
		const dry = watch(dir, '--dry-run');
		expect(dry.status).toBe(0);
		expect(dry.out).toBe(
			'[prueba] Codex tiene 1 tarea lista: T7 lista\n[prueba] Gemini tiene 1 tarea lista: T9 de-gemini\n',
		);
		expect(existsSync(path.join(dir, 'board-watch.json'))).toBe(false);
		expect(watch(dir, '--dry-run').out).toBe(dry.out);
	});
});
