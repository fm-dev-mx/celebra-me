import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const SCRIPT_PATH = path.join(BOARD, 'board.mjs');
const NOW = Date.parse('2026-10-29T18:00:00Z');
const PAUSE = { hasta: '2026-11-02T00:00:00-07:00', desde: '2026-10-29T17:00:00Z' };

type Json = Record<string, unknown>;
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const href = (file: string) => pathToFileURL(path.join(BOARD, file)).href;

/** Run `body` in a module child with model (m), reviewer (r), watch (w) and next (n) imported. */
function probe(body: string) {
	const src = `
		const [m, r, w, n] = await Promise.all(process.argv.slice(1).map((u) => import(u)));
		${body}
	`;
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			src,
			href('model.mjs'),
			href('reviewer.mjs'),
			href('watch.mjs'),
			href('next.mjs'),
		],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

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
		actualizado: new Date(NOW).toISOString(),
		...fields,
	};
}

function makeBoard(collections: Record<string, Json[]>) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-t382-'));
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

const agentDoc = (dir: string, id: string): Json =>
	JSON.parse(readFileSync(path.join(dir, 'agentes', `${id}.json`), 'utf8'));

describe('T382 paused agents', () => {
	it('pauses and reactivates an agent only as the coordinator', () => {
		const dir = makeBoard({ tareas: [] });
		expect(cli(dir, ['agentes', 'codex=pausado', 'hasta=2099-01-01', '--rev=0']).err).toContain(
			'requiere --coordinador',
		);
		expect(
			cli(dir, [
				'agentes',
				'codex=pausado',
				'hasta=2001-01-01',
				'--rev=0',
				'--coordinador',
				'--quien=claude',
			]).err,
		).toContain('la pausa ya terminó: 2001-01-01');
		expect(
			cli(dir, ['agentes', 'codex=dormido', '--rev=0', '--coordinador', '--quien=claude'])
				.err,
		).toContain('codex=pausado hasta=<fecha> o codex=activo');
		const paused = cli(dir, [
			'agentes',
			'codex=pausado',
			'hasta=2099-01-01',
			'--rev=0',
			'--coordinador',
			'--quien=claude',
		]);
		expect(paused.out).toContain('codex rev 1 · en pausa hasta 2099-01-01T00:00:00-07:00');
		expect(agentDoc(dir, 'codex').pausa).toMatchObject({
			hasta: '2099-01-01T00:00:00-07:00',
			quien: 'claude',
		});
		const active = cli(dir, [
			'agentes',
			'codex=activo',
			'--rev=1',
			'--coordinador',
			'--quien=claude',
		]);
		expect(active.out).toContain('codex rev 2 · activo');
		expect(agentDoc(dir, 'codex').pausa).toBeUndefined();
	});

	it('routes reviews, dispatch and stall rows around a paused agent', () => {
		const out = probe(`
			const now = ${NOW};
			const board = (paused) => ({
				tareas: [{ id: 'a', titulo: 'a', estado: 'pendiente', actor: 'sesion', agente: 'codex', requisitos: [], prompt: 'x', rev: 1, actualizado: new Date(now - 7200000).toISOString() }],
				agentes: paused.map((id) => ({ id, pausa: ${JSON.stringify(PAUSE)} })),
				bitacora: [],
			});
			console.log(JSON.stringify({
				paused: m.agentPaused('codex', board(['codex']), now),
				over: m.agentPaused('codex', board(['codex']), Date.parse('2026-11-03T00:00:00Z')),
				byClaudePaused: r.pickReviewer('codex', board(['claude']), { now }),
				noneFree: r.pickReviewer('codex', board(['claude', 'gemini']), { now }),
				claudeAuthor: r.pickReviewer('claude', board(['gemini']), { now }).agente,
				chosen: r.chooseReviewer('claude', 'codex', board(['codex']), [], {}, now).issue ?? null,
				ready: w.readyByAgent(board(['codex']), now).codex.length,
				readyActive: w.readyByAgent(board([]), now).codex.length,
				stalls: n.stalls(board(['codex']), now).dueno.length,
				stallsActive: n.stalls(board([]), now).dueno.length,
			}));
		`);
		expect(out.paused).toBe(true);
		expect(out.over).toBe(false);
		expect(out.byClaudePaused).toMatchObject({ agente: 'gemini', claudePaused: true });
		expect(out.byClaudePaused.motivo).toContain('claude en pausa hasta');
		expect(out.noneFree.issue).toContain('no hay otro revisor libre');
		expect(out.claudeAuthor).toBe('codex');
		expect(out.chosen).toContain('codex en pausa hasta');
		expect(out.ready).toBe(0);
		expect(out.readyActive).toBe(1);
		expect(out.stalls).toBe(0);
		expect(out.stallsActive).toBe(1);
	});
});

describe('T382 plan checks the lane Git state', () => {
	function planBoard() {
		const dir = makeBoard({
			tareas: [
				task('nueva'),
				task('ramificada', { rama: 'feat/x' }),
				task('ocupa', {
					estado: 'en curso',
					candado: { agente: 'codex', carril: 'f09-docs' },
				}),
			],
		});
		const fixture = path.join(dir, 'live.json');
		writeFileSync(
			fixture,
			JSON.stringify({
				carriles: [
					{ id: 'f07-invitaciones', rama: 'feat/x', limpio: false },
					{ id: 'f08-demos', rama: null, limpio: true },
					{ id: 'f09-docs', rama: null, limpio: true },
					{ id: 'f10-libre', rama: null, limpio: false },
					{ id: 'f11-preview', error: 'no se pudo leer' },
				],
			}),
		);
		return { dir, env: { CELEBRA_BOARD_LIVE_FIXTURE: fixture } };
	}
	const plan = (dir: string, env: Json, id: string, carril: string) =>
		cli(
			dir,
			['plan', id, `--carril=${carril}`, '--rev=1', '--coordinador', '--quien=claude'],
			env as never,
		);

	it('refuses a lane on another branch and suggests the idle, unlocked ones', () => {
		const { dir, env } = planBoard();
		const busy = plan(dir, env, 'nueva', 'f07-invitaciones');
		expect(busy.status).not.toBe(0);
		expect(busy.err).toContain(
			'f07-invitaciones está en la rama feat/x con cambios sin commit; carriles libres: f08-demos',
		);
		expect(plan(dir, env, 'nueva', 'f10-libre').err).toContain(
			'f10-libre está en HEAD separado con cambios sin commit',
		);
	});

	it('accepts an idle lane, the task’s own branch and an unreadable lane', () => {
		const { dir, env } = planBoard();
		expect(plan(dir, env, 'nueva', 'f08-demos').status).toBe(0);
		expect(plan(dir, env, 'ramificada', 'f07-invitaciones').status).toBe(0);
		expect(plan(dir, env, 'ocupa', 'f11-preview').err).not.toContain('carriles libres');
	});
});
