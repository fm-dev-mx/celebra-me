import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const SCRIPT_PATH = path.join(BOARD, 'board.mjs');

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
		agente: 'cualquiera',
		requisitos: [],
		prompt: `T1 · ${id}\nDECISIONES\n- ninguna`,
		rev: 1,
		actualizado: new Date().toISOString(),
		...fields,
	};
}

function makeBoard(tareas: Json[], extra: Record<string, Json[]> = {}) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-resumen-'));
	dirs.push(dir);
	for (const [name, docs] of Object.entries({ tareas, ...extra })) {
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

describe('pnpm board resumen', () => {
	it('prints a table per agent with task, status, PR, SHA, latest novelty and wait', async () => {
		const dir = makeBoard([
			task('task-claude', {
				agente: 'claude',
				estado: 'hecha',
				pr: '#620',
				cierre: {
					resultado: { sha: 'c53718fb0377473c97087e9b3cf15fa80769c3e8' },
					resumen: 'First line of closure summary\nSecond line',
				},
			}),
			task('task-codex', {
				agente: 'codex',
				estado: 'en revision',
				pr: '#623',
				cierre: {
					sha: '51eb343977300eef15a5fd971092732c8f78e0df',
					resumen: 'Codex closure summary',
				},
			}),
			task('task-gemini', {
				agente: 'gemini',
				estado: 'en curso',
				candado: {
					agente: 'gemini',
					desde: '2026-10-26T17:00:00Z',
					titulo: 'f10 · T3 · Gemini task in progress',
				},
			}),
		]);

		const res = cli(dir, ['resumen']);
		expect(res.status).toBe(0);
		expect(res.out).toContain('Agente: Claude');
		expect(res.out).toContain('Agente: Codex');
		expect(res.out).toContain('Agente: Gemini');
		expect(res.out).toContain('task-claude');
		expect(res.out).toContain('#620');
		expect(res.out).toContain('c53718f');
		expect(res.out).toContain('unión (merge) por coordinador');
		expect(res.out).toContain('task-codex');
		expect(res.out).toContain('#623');
		expect(res.out).toContain('51eb343');
		expect(res.out).toContain('task-gemini');
		expect(res.out).toContain('cierre / PR');
	});

	it('supports filtering by --agente', async () => {
		const dir = makeBoard([
			task('task-claude', {
				agente: 'claude',
				estado: 'en curso',
			}),
			task('task-codex', {
				agente: 'codex',
				estado: 'en curso',
			}),
		]);

		const res = cli(dir, ['resumen', '--agente=codex']);
		expect(res.status).toBe(0);
		expect(res.out).toContain('Agente: Codex');
		expect(res.out).toContain('task-codex');
		expect(res.out).not.toContain('Agente: Claude');
		expect(res.out).not.toContain('task-claude');
	});

	it('supports structured output with --json', async () => {
		const dir = makeBoard([
			task('task-codex', {
				agente: 'codex',
				estado: 'en revision',
				pr: '#627',
				cierre: {
					resultado: { sha: '9caacb7aef7dc443ea4bbe27b521f793206854c9' },
					resumen: 'Payload optimization',
				},
			}),
		]);

		const res = cli(dir, ['resumen', '--json']);
		expect(res.status).toBe(0);
		const json = JSON.parse(res.out) as Array<{
			agente: string;
			id: string;
			estado: string;
			pr: string;
			sha: string;
			novedad: string;
			espera: string;
		}>;

		expect(json).toHaveLength(1);
		expect(json[0]).toEqual({
			agente: 'codex',
			id: 'task-codex',
			num: 1,
			tarea: 'T1 task-codex',
			estado: 'en revision',
			pr: '#627',
			sha: '9caacb7',
			novedad: 'Payload optimization',
			espera: 'revisión cruzada',
		});
	});

	it('shows (sin tareas activas) when an agent has no in-progress work', async () => {
		const dir = makeBoard([
			task('idle-task', {
				agente: 'codex',
				estado: 'pendiente',
			}),
		]);

		const res = cli(dir, ['resumen', '--agente=claude']);
		expect(res.status).toBe(0);
		expect(res.out).toContain('Agente: Claude');
		expect(res.out).toContain('(sin tareas activas)');
	});
});
