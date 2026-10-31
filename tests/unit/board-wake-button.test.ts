import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const WAKE_PATH = path.join(ROOT, 'scripts', 'board', 'wake-button.mjs');
const SERVER_PATH = path.join(ROOT, 'scripts', 'board', 'view-server.mjs');
const NOW = '2026-10-30T12:00:00Z';

type Json = Record<string, unknown>;
const dirs: string[] = [];

const task = (id: string, fields: Json = {}): Json => ({
	id,
	titulo: id,
	estado: 'en curso',
	urgencia: 'normal',
	actor: 'sesion',
	agente: 'codex',
	requisitos: [],
	rev: 1,
	actualizado: NOW,
	...fields,
});

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-wake-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	for (const { id, ...doc } of tareas)
		writeFileSync(path.join(dir, 'tareas', `${id}.json`), JSON.stringify(doc));
	return dir;
}

/** Run an async module snippet with `m` = the imported module; its printed JSON is returned. */
function probe(file: string, code: string, env: Json = {}) {
	const src = `const m = await import(process.argv[1]); ${code}`;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, pathToFileURL(file).href],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv(env as NodeJS.ProcessEnv) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const BOARD = [
	task('codex-task', { num: 435, candado: { agente: 'codex', desde: NOW } }),
	task('gemini-task', { num: 436, agente: 'gemini' }),
	task('claude-task', { num: 437, agente: 'claude' }),
	task('relay', { num: 438, agente: 'dueno' }),
	task('done-task', { num: 439, estado: 'hecha' }),
];

/** Runs wakeTask calls with a fake exec that records every command; nothing is spawned. */
const WAKE_PROBE = String.raw`
	const { loadBoard } = await import(new URL('./store.mjs', process.argv[1]).href);
	const dir = process.env.CELEBRA_BOARD_DIR;
	const now = Date.parse('${NOW}');
	const calls = [];
	const exec = async (bin, args) => { calls.push([bin === process.execPath ? 'node' : bin, ...args.map(String)]); return ''; };
	const config = () => ({ masters: { codex: 'thread-codex', gemini: 'thread-gemini' }, relayTask: 'relay', codexBin: process.execPath });
	const wake = (id, at = now, opts = {}) => m.wakeTask(dir, id, { now: at, exec, config, ...opts });
	const out = {};
	for (const [key, run] of Object.entries(STEPS)) out[key] = await run();
	const rows = (loadBoard(dir, { since: now - 60 * 60_000 }).bitacora ?? [])
		.filter((r) => r.mensaje)
		.map((r) => ({ tarea: r.tarea, de: r.quien, para: r.mensaje.para, texto: r.mensaje.texto, wake: String(r.mensaje.id).startsWith('despertar-') }));
	console.log(JSON.stringify({ out, calls, rows }));
	process.exit(0);
`;
const wakeProbe = (dir: string, steps: string) =>
	probe(WAKE_PATH, `const STEPS = {${steps}};` + WAKE_PROBE, { CELEBRA_BOARD_DIR: dir });

describe('board «Despertar» button', () => {
	it('queues the fixed text to the Codex master and wakes one task at most every 10 minutes', () => {
		const dir = makeBoard(BOARD);
		const { out, calls, rows } = wakeProbe(
			dir,
			`first: () => wake('codex-task'),
			 again: () => wake('codex-task', now + 9 * 60_000),
			 later: () => wake('codex-task', now + m.WAKE_EVERY_MS),`,
		);
		expect(out.first).toEqual([
			200,
			{ id: 'codex-task', agente: 'codex', para: 'codex', texto: 'Revise su bandeja: T435' },
		]);
		expect(out.again[0]).toBe(429);
		expect(out.again[1].error).toContain('espere 1 min');
		expect(out.later[0]).toBe(200);
		expect(calls).toEqual([
			['node', 'queue', '--thread', 'thread-codex', '--message', 'Revise su bandeja: T435'],
			['node', 'queue', '--thread', 'thread-codex', '--message', 'Revise su bandeja: T435'],
		]);
		expect(rows).toEqual([
			{
				tarea: 'codex-task',
				de: 'dueno',
				para: 'codex',
				texto: 'Revise su bandeja: T435',
				wake: true,
			},
			{
				tarea: 'codex-task',
				de: 'dueno',
				para: 'codex',
				texto: 'Revise su bandeja: T435',
				wake: true,
			},
		]);
	});

	it('relays Gemini through the relay task and leaves Claude a note to the coordinator without spawning anything', () => {
		const dir = makeBoard(BOARD);
		const { out, calls, rows } = wakeProbe(
			dir,
			`gemini: () => wake('gemini-task'),
			 claude: () => wake('claude-task'),`,
		);
		expect(out.gemini[0]).toBe(200);
		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual(
			expect.arrayContaining(['msg', 'relay', '--para=gemini', 'Revise su bandeja: T436']),
		);
		expect(out.claude).toEqual([
			200,
			expect.objectContaining({ agente: 'claude', para: 'coordinador' }),
		]);
		expect(rows.map((r: Json) => [r.tarea, r.para])).toEqual([
			['gemini-task', 'gemini'],
			['claude-task', 'coordinador'],
		]);
	});

	it('refuses unknown, finished and unwakeable tasks, a missing master and a failed transport without logging', () => {
		const dir = makeBoard(BOARD);
		const { out, calls, rows } = wakeProbe(
			dir,
			`unknown: () => wake('nope'),
			 done: () => wake('done-task'),
			 owner: () => wake('relay'),
			 noMaster: () => wake('codex-task', now, { config: () => ({ masters: {} }) }),
			 broken: () => wake('codex-task', now, { exec: async () => { throw new Error('sin red'); } }),`,
		);
		expect([out.unknown[0], out.done[0], out.owner[0], out.noMaster[0], out.broken[0]]).toEqual(
			[404, 409, 409, 409, 502],
		);
		expect(out.noMaster[1].error).toContain('pnpm board master');
		expect(out.broken[1].error).toContain('sin red');
		expect(calls).toEqual([]);
		expect(rows).toEqual([]);
	});

	it('keeps the master watcher from waking Codex again for a «Despertar» row', () => {
		const code = String.raw`
			const { wakeEvents } = await import(new URL('./master-watch.mjs', process.argv[1]).href);
			const row = (id, para) => ({ tarea: 'codex-task', en: '${NOW}', mensaje: { id, de: 'dueno', para, texto: 'Revise su bandeja: T435' } });
			const board = { tareas: [], bitacora: [row('despertar-codex-task-1', 'codex'), row('m-2', 'codex'), row('despertar-claude-task-1', 'coordinador')] };
			const keys = (agent) => wakeEvents(board, { chats: [] }, agent, '2026-10-30T00:00:00Z', { now: Date.parse('${NOW}') }).map((e) => e.key);
			console.log(JSON.stringify({ codex: keys('codex'), claude: keys('claude') }));
			process.exit(0);
		`;
		const out = probe(WAKE_PATH, code);
		expect(out.codex).toContain('message:m-2');
		expect(out.codex).not.toContain('message:despertar-codex-task-1');
		expect(out.claude).toContain('message:despertar-claude-task-1');
	});
});

describe('board view wake endpoint', () => {
	it('needs the page token, its own origin and an id, and exists only when the view is given a waker', () => {
		const dir = makeBoard([]);
		const code = String.raw`
			import { request } from 'node:http';
			const calls = [];
			const start = (opts) => m.serveView(process.env.CELEBRA_BOARD_DIR, 0, opts);
			const send = (port, method, p, headers = {}, body) => new Promise((ok) => {
				const req = request({ host: '127.0.0.1', port, path: p, method, headers }, (res) => {
					let data = ''; res.on('data', (c) => data += c); res.on('end', () => ok({ status: res.statusCode, data }));
				});
				if (body) req.write(body);
				req.end();
			});
			const server = await start({ wake: async (id) => { calls.push(id); return [200, { id }]; } });
			const port = server.address().port;
			const token = (await send(port, 'GET', '/')).data.match(/name="board-token" content="([a-f0-9]{64})"/)?.[1];
			const origin = 'http://127.0.0.1:' + port;
			const json = { 'content-type': 'application/json' };
			const post = (headers, body) => send(port, 'POST', '/api/despertar', { ...json, ...headers }, body).then((r) => r.status);
			const body = JSON.stringify({ id: 'codex-task' });
			const out = {
				noToken: await post({ origin }, body),
				foreignOrigin: await post({ origin: 'https://evil.example', 'x-board-token': token }, body),
				noId: await post({ origin, 'x-board-token': token }, '{}'),
				nullBody: await post({ origin, 'x-board-token': token }, 'null'),
				ok: await post({ origin, 'x-board-token': token }, body),
			};
			server.closeAllConnections();
			server.close();
			const bare = await start({});
			const bport = bare.address().port;
			const btoken = (await send(bport, 'GET', '/')).data.match(/name="board-token" content="([a-f0-9]{64})"/)?.[1];
			out.withoutWaker = (await send(bport, 'POST', '/api/despertar', { ...json, origin: 'http://127.0.0.1:' + bport, 'x-board-token': btoken }, body)).status;
			bare.closeAllConnections();
			bare.close();
			console.log(JSON.stringify({ ...out, calls }));
			process.exit(0);
		`;
		expect(probe(SERVER_PATH, code, { CELEBRA_BOARD_DIR: dir })).toEqual({
			noToken: 403,
			foreignOrigin: 403,
			noId: 400,
			nullBody: 400,
			ok: 200,
			withoutWaker: 405,
			calls: ['codex-task'],
		});
	});
});
