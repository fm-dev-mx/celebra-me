import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const NOW = '2026-10-24T18:00:00Z';
const PROJECT = path.join('code', 'celebra-me');

type Json = Record<string, unknown>;
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string) {
	const dir = mkdtempSync(path.join(tmpdir(), prefix));
	dirs.push(dir);
	return dir;
}

function makeBoard(tareas: Json[], archivo: Json[] = []) {
	const dir = tempDir('board-sesiones-');
	for (const [name, docs] of Object.entries({ tareas, archivo })) {
		mkdirSync(path.join(dir, name), { recursive: true });
		for (const { id, ...doc } of docs)
			writeFileSync(path.join(dir, name, `${id}.json`), JSON.stringify(doc));
	}
	return dir;
}

const task = (id: string, num: number, estado: string, extra: Json = {}): Json => ({
	id,
	num,
	titulo: id,
	estado,
	urgencia: 'normal',
	actor: 'sesion',
	agente: 'codex',
	requisitos: [],
	rev: 1,
	actualizado: NOW,
	...extra,
});

/** Fake Codex/Gemini stores written by node:sqlite in a child process, under a fake home directory. */
function makeHome({ codex, gemini }: { codex?: Json[]; gemini?: Json[] }) {
	const home = tempDir('board-home-');
	const build = `
		import { mkdirSync, writeFileSync } from 'node:fs';
		import { join } from 'node:path';
		import { DatabaseSync } from 'node:sqlite';
		const [home, codex, gemini] = process.argv.slice(1);
		if (codex !== 'null') {
			mkdirSync(join(home, '.codex'), { recursive: true });
			const file = join(home, '.codex', 'state_5.sqlite');
			if (codex === '"broken"') writeFileSync(file, 'not a database');
			else {
				const db = new DatabaseSync(file);
				db.exec('create table threads (id text, name text, title text, cwd text, archived integer, updated_at_ms integer, thread_source text)');
				const add = db.prepare('insert into threads values (?, ?, ?, ?, ?, ?, ?)');
				for (const [i, r] of JSON.parse(codex).entries())
					add.run(String(i), r.name ?? null, r.title ?? '', r.cwd, r.archived ?? 0, r.en, r.source ?? 'user');
				db.close();
			}
		}
		if (gemini !== 'null') {
			mkdirSync(join(home, '.gemini', 'antigravity'), { recursive: true });
			const db = new DatabaseSync(join(home, '.gemini', 'antigravity', 'conversation_summaries.db'));
			db.exec('create table conversation_summaries (conversation_id text, title text, last_modified_time text, workspace_uris text, status text)');
			db.exec('create table conversations_fts (conversation_id text, archived integer)');
			const add = db.prepare('insert into conversation_summaries values (?, ?, ?, ?, ?)');
			const chunk = db.prepare('insert into conversations_fts values (?, ?)');
			for (const [i, r] of JSON.parse(gemini).entries()) {
				add.run(String(i), r.title, r.en, r.uris, 'CASCADE_RUN_STATUS_IDLE');
				// Two chunks per conversation, as the real full-text index keeps them.
				chunk.run(String(i), 0);
				chunk.run(String(i), r.archived ?? 0);
			}
			db.close();
		}
	`;
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			build,
			home,
			JSON.stringify(codex ?? null),
			JSON.stringify(gemini ?? null),
		],
		{ cwd: ROOT, env: sanitizeEnv({}) },
	);
	expect(result.status).toBe(0);
	return home;
}

function sesiones(dir: string, home: string, ...args: string[]) {
	const result = runCommand(process.execPath, [SCRIPT_PATH, 'sesiones', ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir, HOME: home, USERPROFILE: home }),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

const cwd = path.join('D:', PROJECT);
const uris = JSON.stringify([`file:///d%3A/${PROJECT.replace(/\\/g, '/')}`]);

describe('board sesiones (d211)', () => {
	it('crosses open Codex and Gemini chats with the board and folds the dispatcher', () => {
		const dir = makeBoard(
			[
				task('hecha', 118, 'hecha'),
				task('en-curso', 120, 'en curso'),
				task('vieja', 108, 'unida', { archivada: NOW }),
			],
			[{ id: 'compactada', num: 90, estado: 'cancelada', archivada: NOW }],
		);
		const home = makeHome({
			codex: [
				{ name: 'f04 · T118 · PR #514 · Revisión', cwd, en: 5 },
				{ name: 'f05 · T120 · Recarga', cwd, en: 4 },
				{ title: 'f04 · T108 · Documentos', cwd, en: 3 },
				{ name: 'f04 · T90 · Compactada', cwd, en: 2 },
				{ name: 'f04 · T999 · Perdida', cwd, en: 1 },
				{ name: 'f04 · T118 · Ya archivado', cwd, en: 6, archived: 1 },
				{ name: 'Guardián', cwd, en: 7, source: 'guardian_review' },
				{ name: 'Subagente', cwd, en: 8, source: 'subagent' },
				{ name: 'Otro proyecto T118', cwd: path.join('D:', 'code', 'otro'), en: 9 },
				{ title: 'Analiza demo\nsegunda línea', cwd, en: 10 },
				{ name: 'f04 · Despachador Codex', cwd, en: 11 },
			],
			gemini: [
				{
					title: 'f04 · Despachador Gemini',
					en: '2026-10-24 18:02:10.6878704+00:00',
					uris,
				},
				{ title: 'f04 · Despachador Gemini', en: '2026-10-24 16:02:10.1+00:00', uris },
				{ title: 'f04 · Despachador Gemini', en: '2026-10-24 14:02:10.1+00:00', uris },
				{
					title: 'f04 · Despachador Gemini',
					en: '2026-10-24 12:00:00+00:00',
					uris,
					archived: 1,
				},
				{ title: 'Review PR 516', en: '2026-10-24 17:00:00+00:00', uris },
			],
		});

		const text = sesiones(dir, home);
		expect(text.status).toBe(0);
		const lines = text.out.trim().split('\n');
		expect(lines).toEqual([
			'Chats de Codex y Gemini sin archivar (el dueño los archiva a mano):',
			'  Codex · f04 · T118 · PR #514 · Revisión → tarea hecha → archivar',
			'  Codex · f04 · T108 · Documentos → tarea archivada → archivar',
			'  Codex · f04 · T90 · Compactada → tarea archivada → archivar',
			'  Codex · Analiza demo → sin tarea',
			'  Codex · f05 · T120 · Recarga → tarea en curso → dejar',
			'  Codex · f04 · T999 · Perdida → no está en el tablero',
			'  Gemini · Review PR 516 → sin tarea',
			'  Codex · f04 · Despachador Codex ×1 → dejar (es la más reciente)',
			'  Gemini · f04 · Despachador Gemini ×3 → archivar 2, dejar la más reciente',
			'Por archivar: 5. Codex: 7 abiertos, 1 archivados · Gemini: 4 abiertos, 1 archivados.',
		]);

		const json = JSON.parse(sesiones(dir, home, '--json').out);
		expect(json.fuentes.codex).toEqual({ disponible: true, abiertos: 7, archivados: 1 });
		expect(json.despachadores[1]).toMatchObject({
			fuente: 'Gemini',
			total: 3,
			archivar: 2,
			ultimo: '2026-10-24T18:02:10.687Z',
		});
	});

	it('reports a missing or unreadable store and still answers for the other', () => {
		const dir = makeBoard([task('hecha', 118, 'hecha')]);
		const missing = makeHome({ gemini: [{ title: 'f04 · T118 · Hecha', en: NOW, uris }] });
		const out = sesiones(dir, missing);
		expect(out.status).toBe(0);
		expect(out.out).toContain('  Gemini · f04 · T118 · Hecha → tarea hecha → archivar');
		expect(out.out).toContain('Codex: no disponible (no existe)');

		const broken = makeHome({ codex: 'broken' as unknown as Json[] });
		const both = sesiones(dir, broken);
		expect(both.status).toBe(0);
		expect(both.out).toMatch(/Codex: no disponible \(.+\)/);
		expect(both.out).toContain('Gemini: no disponible (no existe)');
		expect(both.out).toContain('  ninguno');
	});
});
