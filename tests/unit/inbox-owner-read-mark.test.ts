import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'board', 'board.mjs');
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeBoard() {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-inbox-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	writeFileSync(
		path.join(dir, 'tareas', 'servicio.json'),
		JSON.stringify({
			num: 1,
			titulo: 'servicio',
			estado: 'pendiente',
			urgencia: 'normal',
			actor: 'sesion',
			agente: 'cualquiera',
			requisitos: [],
			prompt: 'T1 · servicio\nDECISIONES\n- ninguna',
			rev: 1,
			actualizado: '2026-10-26T10:00:00Z',
		}),
	);
	return dir;
}

function cli(dir: string, args: string[]) {
	const result = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: process.cwd(),
		allowFailure: true,
		env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir, CLAUDE_CODE_HOST_SESSION_ID: '' }),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

describe('owner inbox read mark', () => {
	it('lists the owner messages to an agent without marking them read', () => {
		const dir = makeBoard();
		const sent = cli(dir, ['msg', 'T1', '--de=codex', '--para=dueno', '¿Publica hoy?']);
		expect(sent.status).toBe(0);

		for (let i = 0; i < 2; i++)
			expect(cli(dir, ['inbox', '--agente=dueno']).out).toContain(
				'codex → dueno sobre T1: ¿Publica hoy?',
			);
		expect(existsSync(path.join(dir, 'bandejas', 'dueno.json'))).toBe(false);
		// The question still waits in «Le toca a usted».
		expect(cli(dir, ['list']).out).toContain('¿Publica hoy?');
	});

	it('marks them read only when the owner passes --leido', () => {
		const dir = makeBoard();
		cli(dir, ['msg', 'T1', '--de=codex', '--para=dueno', '¿Publica hoy?']);

		expect(cli(dir, ['inbox', '--agente=dueno', '--leido']).out).toContain('¿Publica hoy?');
		expect(existsSync(path.join(dir, 'bandejas', 'dueno.json'))).toBe(true);
		expect(cli(dir, ['inbox', '--agente=dueno']).out).toBe('Sin mensajes nuevos para dueno.\n');
	});
});
