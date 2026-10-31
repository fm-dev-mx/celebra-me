import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const NOW = '2026-10-30T12:00:00Z';

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
		actualizado: NOW,
		...fields,
	};
}

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-t478-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	for (const [i, { id, ...doc }] of tareas.entries())
		writeFileSync(
			path.join(dir, 'tareas', `${id}.json`),
			JSON.stringify({ num: i + 1, ...doc }),
		);
	return dir;
}

function cli(dir: string, ...args: string[]) {
	const result = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir, CLAUDE_CODE_HOST_SESSION_ID: '' }),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

const readTask = (dir: string, id: string): Json =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

const readLog = (dir: string): Json[] => {
	const logDir = path.join(dir, 'bitacora');
	try {
		return readdirSync(logDir)
			.filter((f) => f.endsWith('.jsonl'))
			.flatMap((f) =>
				readFileSync(path.join(logDir, f), 'utf8')
					.split('\n')
					.filter(Boolean)
					.map((line) => JSON.parse(line)),
			);
	} catch {
		return [];
	}
};

describe('T478 coordinator authority', () => {
	it('lets the Claude coordinator and the owner write with --coordinador and logs the real actor', () => {
		const dir = makeBoard([task('a'), task('b')]);
		expect(
			cli(dir, 'set', 'a', '--rev=1', 'estado=en curso', '--coordinador', '--quien=claude')
				.status,
		).toBe(0);
		expect(
			cli(dir, 'set', 'b', '--rev=1', 'estado=en curso', '--coordinador', '--quien=dueno')
				.status,
		).toBe(0);
		expect(readLog(dir)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ tarea: 'a', a: 'en curso', quien: 'claude' }),
				expect.objectContaining({ tarea: 'b', a: 'en curso', quien: 'dueno' }),
			]),
		);
		expect(readLog(dir).map((row) => row.quien)).not.toContain('coordinador');
	});

	it('refuses --coordinador without a real --quien and writes nothing', () => {
		const dir = makeBoard([task('a')]);
		for (const who of [[], ['--quien=coordinador']]) {
			const res = cli(dir, 'set', 'a', '--rev=1', 'estado=en curso', '--coordinador', ...who);
			expect(res.status).toBe(2);
			expect(res.err).toContain('--quien=claude|dueno');
		}
		expect(readTask(dir, 'a')).toMatchObject({ estado: 'pendiente', rev: 1 });
		expect(readLog(dir)).toEqual([]);
	});

	it("lets a master plan the lane of its own agent's task and logs it as that master", () => {
		const dir = makeBoard([task('suya', { agente: 'gemini' })]);
		const res = cli(
			dir,
			'plan',
			'suya',
			'--rev=1',
			'--carril=f10-libre',
			'--coordinador',
			'--quien=gemini',
		);
		expect(res.status).toBe(0);
		expect(readTask(dir, 'suya')).toMatchObject({
			carrilPlaneado: 'f10-libre',
			seguimientoPor: 'gemini',
		});
		expect(readLog(dir)).toEqual([
			expect.objectContaining({
				tarea: 'suya',
				carril: { de: '', a: 'f10-libre' },
				quien: 'gemini',
			}),
		]);
	});

	it("refuses a master planning another agent's task and any other --coordinador write by a master", () => {
		const dir = makeBoard([task('ajena', { agente: 'claude' })]);
		const plan = cli(
			dir,
			'plan',
			'ajena',
			'--rev=1',
			'--carril=f10-libre',
			'--coordinador',
			'--quien=codex',
		);
		expect(plan.status).toBe(2);
		expect(plan.err).toContain(
			'codex solo planea el carril de tareas de codex; ajena es de claude',
		);
		const set = cli(
			dir,
			'set',
			'ajena',
			'--rev=1',
			'estado=en curso',
			'--coordinador',
			'--quien=gemini',
		);
		expect(set.status).toBe(2);
		expect(set.err).toContain('no gemini');
		expect(readTask(dir, 'ajena')).toMatchObject({ estado: 'pendiente', rev: 1 });
		expect(readTask(dir, 'ajena').carrilPlaneado).toBeUndefined();
		expect(readLog(dir)).toEqual([]);
	});
});
