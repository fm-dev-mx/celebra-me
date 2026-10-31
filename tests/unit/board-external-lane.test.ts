import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const SCRIPT_PATH = path.join(BOARD, 'board.mjs');
const NOW = '2026-10-25T12:00:00Z';

function probe(code: string, file = 'model.mjs') {
	const href = (f: string) => pathToFileURL(path.join(BOARD, f)).href;
	const src = `const m = await import(process.argv[1]); ${code}`;
	const result = runCommand(process.execPath, ['--input-type=module', '-e', src, href(file)], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({}),
	});
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

type Json = Record<string, unknown>;
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function task(id: string, fields: Json = {}): Json {
	return {
		id,
		titulo: id,
		estado: 'pendiente',
		urgencia: 'normal',
		actor: 'sesion',
		agente: 'codex',
		requisitos: [],
		prompt: `externo · T1 · ${id}\nDECISIONES\n- ninguna`,
		rev: 1,
		actualizado: NOW,
		...fields,
	};
}

function makeBoard(collections: Record<string, Json[]>) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-external-'));
	dirs.push(dir);
	for (const [name, docs] of Object.entries(collections)) {
		mkdirSync(path.join(dir, name), { recursive: true });
		for (const [i, { id, ...doc }] of docs.entries())
			writeFileSync(
				path.join(dir, name, `${id}.json`),
				JSON.stringify(name === 'tareas' ? { num: i + 1, ...doc } : doc),
			);
	}
	return dir;
}

function cli(dir: string, args: string[], env: NodeJS.ProcessEnv = {}) {
	const result = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir, CLAUDE_CODE_HOST_SESSION_ID: '', ...env }),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

const readTask = (dir: string, id: string): Json =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

describe('carril externo', () => {
	it('defines external lane constants and helpers', () => {
		const res = probe(`
			console.log(JSON.stringify({
				EXTERNAL_LANE: m.EXTERNAL_LANE,
				laneAllowed: m.laneAllowed('externo', { actor: 'sesion' }, []),
				laneFolder: m.laneFolder('externo'),
				isExternal1: m.isExternal({ carril: 'externo' }),
				isExternal2: m.isExternal({ carrilPlaneado: 'externo' }),
				isExternal3: m.isExternal({ candado: { carril: 'externo' } }),
				isExternal4: m.isExternal({ carril: 'f05-plataforma' }),
				laneHolder: m.laneHolder('externo', { tareas: [{ id: 'a', candado: { carril: 'externo' } }] }),
			}));
		`);
		expect(res.EXTERNAL_LANE).toBe('externo');
		expect(res.laneAllowed).toBe(true);
		expect(res.laneFolder).toBe('(sin checkout)');
		expect(res.isExternal1).toBe(true);
		expect(res.isExternal2).toBe(true);
		expect(res.isExternal3).toBe(true);
		expect(res.isExternal4).toBe(false);
		expect(res.laneHolder).toBeNull();
	});

	it('allows coordinator to plan carril externo without checkout', () => {
		const dir = makeBoard({
			tareas: [
				task('creative-task', {
					carrilPlaneado: undefined,
					prompt: 'externo · T1 · creative-task\nDECISIONES\n- ninguna',
				}),
			],
		});
		const plan = cli(dir, [
			'plan',
			'creative-task',
			'--carril=externo',
			'--coordinador',
			'--quien=claude',
			'--rev=1',
		]);
		if (plan.status !== 0) console.error(plan.err);
		expect(plan.status).toBe(0);
		expect(plan.out).toContain('Corre en: externo · carpeta (sin checkout)');
		expect(plan.out).toContain('carril libre');
		const t = readTask(dir, 'creative-task');
		expect(t.carrilPlaneado).toBe('externo');
	});

	it('generates prompt-v1 with session title starting with externo and carpeta (sin checkout)', () => {
		const href = (file: string) => pathToFileURL(path.join(BOARD, file)).href;
		const src = `
			const kp = await import(process.argv[1]);
			const k = await import(process.argv[2]);
			const fs = await import('node:fs');
			const path = await import('node:path');
			const kindDoc = k.parseKind(fs.readFileSync(path.join('${ROOT.replace(/\\/g, '/')}', '.agent', 'kinds', 'creativo.yaml'), 'utf8'));
			const t = {
				id: 't-externa',
				num: 476,
				rev: 1,
				carrilPlaneado: 'externo',
				tipo: 'creativo',
				busca: 'Fotos fuera de celebra-me.\\nTerminado cuando: entregadas.',
				corto: 'Fotos Editorial',
			};
			const board = { tareas: [t], decisiones: [] };
			const prompt = kp.kindPrompt(t, board, kindDoc, { num: 476, rev: 1, generado: '2026-10-31T00:00:00Z' });
			console.log(JSON.stringify({ prompt }));
		`;
		const result = runCommand(
			process.execPath,
			['--input-type=module', '-e', src, href('kind-prompt.mjs'), href('kinds.mjs')],
			{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
		);
		expect(result.status).toBe(0);
		const { prompt } = JSON.parse(String(result.stdout));
		expect(prompt).not.toBeNull();
		const lines = prompt.split('\n');
		expect(lines[0]).toBe('externo · T476 · Fotos Editorial');
		expect(prompt).toContain('Carril externo (sin checkout).');
		expect(prompt).toContain('carril: externo');
		expect(prompt).toContain('carpeta: (sin checkout)');
	});

	it('claims an external lane task without requiring worktree lane folder or git-safety', () => {
		const dir = makeBoard({
			tareas: [
				task('t-ext', {
					num: 476,
					carrilPlaneado: 'externo',
					prompt: 'externo · T476 · Fotos Editorial\nDECISIONES\n- ninguna',
				}),
			],
		});
		const res = cli(dir, [
			'claim',
			't-ext',
			'--agente=codex',
			'--titulo=externo · T476 · Fotos Editorial',
			'--sesion=test-sesion',
		]);
		expect(res.status).toBe(0);
		expect(res.out).toContain('t-ext es de codex');
		expect(res.out).not.toContain('git-safety:');
		const saved = readTask(dir, 't-ext');
		expect(saved.candado).toMatchObject({
			agente: 'codex',
			carril: 'externo',
			sesion: 'test-sesion',
		});
		expect(saved.carril).toBe('externo');
		expect(saved.estado).toBe('en curso');
	});

	it('allows multiple external tasks to run concurrently without lane conflict', () => {
		const dir = makeBoard({
			tareas: [
				task('task-1', {
					num: 101,
					agente: 'codex',
					carrilPlaneado: 'externo',
					candado: { agente: 'codex', carril: 'externo', sesion: 's1', desde: NOW },
					carril: 'externo',
					estado: 'en curso',
				}),
				task('task-2', {
					num: 102,
					agente: 'gemini',
					carrilPlaneado: 'externo',
					prompt: 'externo · T102 · Segunda tarea\nDECISIONES\n- ninguna',
				}),
			],
		});
		const res = cli(dir, [
			'claim',
			'task-2',
			'--agente=gemini',
			'--titulo=externo · T102 · Segunda tarea',
			'--sesion=s2',
		]);
		if (res.status !== 0) console.error(res.err);
		expect(res.status).toBe(0);
		expect(res.out).toContain('task-2 es de gemini');
		const saved = readTask(dir, 'task-2');
		expect(saved.candado).toMatchObject({ agente: 'gemini', carril: 'externo' });
	});

	it('releases and closes external task without requiring git safety finish', () => {
		const dir = makeBoard({
			tareas: [
				task('release-ext', {
					num: 201,
					carrilPlaneado: 'externo',
					carril: 'externo',
					candado: { agente: 'codex', carril: 'externo', sesion: 's1', desde: NOW },
					estado: 'en curso',
				}),
			],
		});
		const rel = cli(dir, ['release', 'release-ext', '--agente=codex', '--sesion=s1']);
		expect(rel.status).toBe(0);
		expect(rel.out).toContain('release-ext libre');
		expect(rel.out).not.toContain('git-safety:');
	});
});

describe('next con tareas bloqueadas y motivo', () => {
	it('preserves nextFor contract returning null when no task is eligible', () => {
		const res = probe(`
			const t = {
				id: 'bloqueada-1',
				agente: 'codex',
				tipo: 'creativo',
				busca: 'Falta carril',
				carrilPlaneado: undefined,
				prompt: undefined,
			};
			const board = { tareas: [t] };
			console.log(JSON.stringify({ next: m.nextFor('codex', board) }));
		`);
		expect(res.next).toBeNull();
	});

	it('blockedFor lists blocked tasks of the agent with their reason', () => {
		const res = probe(
			`
			const t1 = {
				id: 'sin-carril',
				num: 476,
				titulo: 'Fotos',
				agente: 'codex',
				tipo: 'creativo',
				busca: 'Fotos sin carril',
				carrilPlaneado: undefined,
				prompt: undefined,
			};
			const t2 = {
				id: 'espera-tarea',
				num: 477,
				titulo: 'Segunda',
				agente: 'codex',
				requisitos: [{ tipo: 'tarea', ref: 'otra-tarea', ok: false }],
			};
			const board = { tareas: [t1, t2] };
			console.log(JSON.stringify({ blocked: m.blockedFor('codex', board) }));
		`,
			'next-commands.mjs',
		);
		expect(res.blocked).toHaveLength(2);
		expect(res.blocked[0]).toMatchObject({
			id: 'sin-carril',
			num: 476,
			motivo: expect.stringContaining('Espera su carril'),
		});
		expect(res.blocked[1]).toMatchObject({
			id: 'espera-tarea',
			num: 477,
			motivo: expect.stringContaining('Espera'),
		});
	});

	it('prints blocked tasks and reasons in CLI text mode when next has nothing ready', () => {
		const dir = makeBoard({
			tareas: [
				task('t-bloqueada', {
					num: 476,
					titulo: 'Fotos Editorial',
					agente: 'codex',
					tipo: 'creativo',
					busca: 'Fotos sin carril',
					carrilPlaneado: undefined,
					prompt: undefined,
				}),
			],
		});
		const res = cli(dir, ['next', '--agente=codex']);
		expect(res.status).toBe(0);
		expect(res.out).toContain('Nada listo para codex.');
		expect(res.out).toContain('Tareas bloqueadas (1):');
		expect(res.out).toContain('T476 t-bloqueada: Espera su carril');
	});

	it('returns { tarea: null, bloqueadas } in CLI --json when next has nothing ready but tasks are blocked', () => {
		const dir = makeBoard({
			tareas: [
				task('t-bloqueada', {
					num: 476,
					titulo: 'Fotos Editorial',
					agente: 'codex',
					tipo: 'creativo',
					busca: 'Fotos sin carril',
					carrilPlaneado: undefined,
					prompt: undefined,
				}),
			],
		});
		const res = cli(dir, ['next', '--agente=codex', '--json']);
		expect(res.status).toBe(0);
		const parsed = JSON.parse(res.out);
		expect(parsed).toMatchObject({
			tarea: null,
			bloqueadas: [
				{
					id: 't-bloqueada',
					num: 476,
					titulo: 'Fotos Editorial',
					motivo: expect.stringContaining('Espera su carril'),
				},
			],
		});
	});

	it('returns null in CLI --json when agent has no ready and no blocked tasks', () => {
		const dir = makeBoard({
			tareas: [
				task('de-claude', {
					agente: 'claude',
					prompt: 'f05 · T1 · Claude\nDECISIONES\n- ninguna',
					carrilPlaneado: 'f05-plataforma',
				}),
			],
		});
		const res = cli(dir, ['next', '--agente=gemini', '--json']);
		expect(res.status).toBe(0);
		expect(JSON.parse(res.out)).toBeNull();
	});

	it('returns the ready task directly in CLI --json when one is eligible', () => {
		const dir = makeBoard({
			tareas: [
				task('ready-task', {
					num: 50,
					agente: 'gemini',
					prompt: 'f08 · T50 · Ready\nDECISIONES\n- ninguna',
					carrilPlaneado: 'f08-demos',
				}),
			],
		});
		const res = cli(dir, ['next', '--agente=gemini', '--json']);
		expect(res.status).toBe(0);
		const parsed = JSON.parse(res.out);
		expect(parsed.id).toBe('ready-task');
	});
});
