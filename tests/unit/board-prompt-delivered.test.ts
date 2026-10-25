import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const SCRIPT_PATH = path.join(BOARD, 'board.mjs');
const SERVER_PATH = path.join(BOARD, 'view-server.mjs');
const NOW = '2026-10-25T12:00:00Z';
const DESDE = '2026-10-25T20:35:00Z';
const MINUTE = 60_000;

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
		prompt: `T1 · ${id}\nDECISIONES\n- ninguna`,
		rev: 1,
		actualizado: NOW,
		...fields,
	};
}

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-t205-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	for (const [i, { id, ...doc }] of tareas.entries())
		writeFileSync(
			path.join(dir, 'tareas', `${id}.json`),
			JSON.stringify({ num: i + 1, ...doc }),
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

/** Run a snippet with `d` = delivery.mjs, `m` = model.mjs and `n` = next.mjs; its printed JSON is returned. */
function probe(code: string) {
	const href = (file: string) => pathToFileURL(path.join(BOARD, file)).href;
	const src = `const d = await import(process.argv[1]); const m = await import(process.argv[2]); const n = await import(process.argv[3]); ${code}`;
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			src,
			href('delivery.mjs'),
			href('model.mjs'),
			href('next.mjs'),
		],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

describe('T205 delivered prompt (d249)', () => {
	it('waits for a claim, then comes back to the owner after 30 minutes', () => {
		const at = (min: number) => Date.parse(DESDE) + min * MINUTE;
		const out = probe(`
			const t = ${JSON.stringify(task('pegar', { num: 1, entregada: { agente: 'codex', desde: DESDE } }))};
			const board = { tareas: [t] };
			const view = (now) => ({
				launches: m.ownerLaunches(t, board, now),
				color: m.color(t, board, { now }),
				line: n.deliveryLine(t, now),
				usted: n.nextSections(board, { now }).usted.map((r) => r.texto),
			});
			const plain = { ...t };
			delete plain.entregada;
			console.log(JSON.stringify({
				before: m.ownerLaunches(plain, { tareas: [plain] }, ${at(0)}),
				fresh: view(${at(10)}),
				edge: view(${at(29)}),
				stale: view(${at(30)}),
				later: view(${at(95)}),
				locked: d.delivery({ ...t, candado: { agente: 'codex', desde: t.entregada.desde } }, ${at(40)}),
				started: d.delivery({ ...t, estado: 'en curso' }, ${at(40)}),
				undelivered: 'entregada' in d.undelivered(t),
			}));
		`);
		expect(out.before).toEqual(['codex']);
		expect(out.fresh).toEqual({
			launches: [],
			color: 'auto',
			line: 'Entregada a Codex · 13:35 · esperando que la tome',
			usted: [],
		});
		expect(out.edge.color).toBe('auto');
		expect(out.stale).toEqual({
			launches: ['codex'],
			color: 'own',
			line: 'Entregada hace 30 min y nadie la tomó',
			usted: ['T1 · pegar · Pegar en Codex · Entregada hace 30 min y nadie la tomó'],
		});
		expect(out.later.line).toBe('Entregada hace 1 h 35 min y nadie la tomó');
		expect(out.locked).toBeNull();
		expect(out.started).toBeNull();
		expect(out.undelivered).toBe(false);
	});

	it('keeps a stale delivery out of the dispatcher stall row', () => {
		const out = probe(`
			const t = ${JSON.stringify(task('pegar', { entregada: { agente: 'codex', desde: DESDE } }))};
			const board = { tareas: [t], bitacora: [{ tarea: 'pegar', en: '2026-10-25T08:00:00Z', de: '', a: 'pendiente' }] };
			console.log(JSON.stringify(n.stalls(board, ${Date.parse(DESDE) + 60 * MINUTE}).dueno));
		`);
		expect(out).toEqual([]);
	});

	it('entregada marks a ready task, claim clears it, and set cannot write it', () => {
		const dir = makeBoard([
			task('pegar'),
			task('suya', { actor: 'dueno' }),
			task('tomada', { candado: { agente: 'codex', desde: NOW } }),
		]);
		const marked = cli(dir, ['entregada', 'pegar', '--agente=codex']);
		expect(marked.status).toBe(0);
		expect(marked.out).toContain('pegar entregada a codex');
		const saved = readTask(dir, 'pegar');
		expect(saved.entregada).toMatchObject({ agente: 'codex' });
		expect(Date.now() - Date.parse(String((saved.entregada as Json).desde))).toBeLessThan(
			60_000,
		);

		const list = cli(dir, ['list']);
		expect(list.out).toMatch(/Entregada a Codex · \d{2}:\d{2} · esperando que la tome/);
		expect(list.out).not.toContain('Pegar en Codex');
		expect(cli(dir, ['show', 'pegar']).out).toContain('esperando que la tome');

		expect(cli(dir, ['entregada', 'pegar']).err).toContain('falta --agente');
		expect(cli(dir, ['entregada', 'pegar', '--agente=nadie']).err).toContain(
			'agente desconocido',
		);
		expect(cli(dir, ['entregada', 'suya', '--agente=codex']).err).toContain('la hace usted');
		expect(cli(dir, ['entregada', 'tomada', '--agente=codex']).err).toContain('ya la tomó');
		expect(
			cli(dir, ['set', 'pegar', `--rev=${saved.rev}`, '--coordinador', 'entregada=null']).err,
		).toContain('entregada requiere su comando');

		const claim = cli(dir, [
			'claim',
			'pegar',
			'--agente=codex',
			'--sesion=codex-test',
			'--carril=f10-libre',
			'--titulo=f10 · T1 · prueba',
		]);
		expect(claim.status).toBe(0);
		const claimed = readTask(dir, 'pegar');
		expect(claimed.entregada).toBeUndefined();
		expect(claimed.estado).toBe('en curso');
	});

	it('marks from the view only for same-origin JSON requests to 127.0.0.1', () => {
		const dir = makeBoard([task('pegar'), task('suya', { actor: 'dueno' })]);
		const src = String.raw`
			import { request } from 'node:http';
			const { serveView } = await import(process.argv[1]);
			const { viewDeliverer } = await import(process.argv[2]);
			const dir = process.env.CELEBRA_BOARD_DIR;
			const readOnly = await serveView(dir, 0);
			const server = await serveView(dir, 0, { deliver: viewDeliverer(dir) });
			const port = server.address().port;
			const own = 'http://127.0.0.1:' + port;
			const post = (headers, body, to = port) => new Promise((ok) => {
				const req = request({ host: '127.0.0.1', port: to, path: '/api/entregada', method: 'POST', headers }, (res) => {
					res.resume();
					res.on('end', () => ok(res.statusCode));
				});
				req.end(JSON.stringify(body));
			});
			const json = { 'content-type': 'application/json' };
			const ro = readOnly.address().port;
			const body = { id: 'pegar', agente: 'codex' };
			const out = [
				await post({ ...json, origin: 'http://127.0.0.1:' + ro }, body, ro),
				await post({ ...json, origin: 'http://evil.example' }, body),
				await post({ origin: own, 'content-type': 'text/plain' }, body),
				await post({ ...json, origin: own }, { id: 'pegar' }),
				await post({ ...json, origin: own }, { id: 'suya', agente: 'codex' }),
				await post({ ...json, origin: own }, body),
			];
			console.log(JSON.stringify(out));
			for (const s of [server, readOnly]) {
				s.closeAllConnections();
				s.close();
			}
		`;
		const result = runCommand(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				src,
				pathToFileURL(SERVER_PATH).href,
				pathToFileURL(SCRIPT_PATH).href,
			],
			{
				cwd: ROOT,
				allowFailure: true,
				env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir, INIT_CWD: ROOT }),
			},
		);
		expect(JSON.parse(String(result.stdout))).toEqual([405, 403, 403, 400, 409, 200]);
		expect(readTask(dir, 'pegar').entregada).toMatchObject({ agente: 'codex' });
		expect(readTask(dir, 'suya').entregada).toBeUndefined();
	});
});
