import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BASE = pathToFileURL(path.join(ROOT, 'scripts/board/')).href;
const NOW = Date.parse('2026-10-30T12:00:00Z');
const SESSION = 'local_aaaa1111';
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

type Row = Record<string, unknown>;

function fixture({ tasks = [] as Row[], log = [] as Row[], bandejas = [] as Row[] } = {}) {
	const root = mkdtempSync(path.join(tmpdir(), 'board-realtime-notices-'));
	dirs.push(root);
	const dir = path.join(root, 'board');
	for (const c of ['tareas', 'bandejas', 'bitacora'])
		mkdirSync(path.join(dir, c), { recursive: true });
	for (const t of tasks)
		writeFileSync(path.join(dir, 'tareas', `${t.id}.json`), JSON.stringify(t));
	for (const b of bandejas)
		writeFileSync(path.join(dir, 'bandejas', `${b.id}.json`), JSON.stringify(b));
	if (log.length)
		writeFileSync(
			path.join(dir, 'bitacora', '2026-10-30.jsonl'),
			`${log.map((r) => JSON.stringify(r)).join('\n')}\n`,
		);
	return { root, dir };
}

function probe(code: string, root: string) {
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`
		import { readFileSync, writeFileSync, existsSync } from 'node:fs';
		import { join } from 'node:path';
		const base = process.argv[1]; const root = process.argv[2]; const dir = join(root, 'board');
		const sn = await import(new URL('./session-notice.mjs', base));
		const next = await import(new URL('./next.mjs', base));
		const store = await import(new URL('./store.mjs', base));
		const mw = await import(new URL('./master-watch.mjs', base));
		${code}`,
			BASE,
			root,
		],
		{ cwd: ROOT, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr || result.stdout));
	return JSON.parse(result.stdout);
}

const at = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();
const msg = (id: string, para: string, tarea: string, quien: string, minAgo: number) => ({
	tarea,
	en: at(minAgo),
	quien,
	mensaje: { id, para, texto: `texto ${id}` },
});
const held = {
	id: 'mine',
	num: 7,
	titulo: 'Mine',
	estado: 'en curso',
	candado: { agente: 'claude', sesion: SESSION, latido: at(1) },
};
const other = {
	id: 'other',
	num: 8,
	titulo: 'Other',
	estado: 'en curso',
	candado: { agente: 'claude', sesion: 'local_bbbb2222', latido: at(1) },
};
const free = { id: 'free', num: 9, titulo: 'Free', estado: 'pendiente' };

describe('T477 session hook', () => {
	it('prints nothing without new messages and one line with them, once', () => {
		const { root } = fixture({
			tasks: [held, other],
			log: [
				msg('m1', 'claude', 'mine', 'gemini', 3),
				msg('m2', 'claude', 'other', 'codex', 2),
			],
		});
		const out = probe(
			`
			const run = (input) => {
				const r = sn.evaluate({ dir, session: '${SESSION}', input, now: ${NOW} });
				for (const [f, v] of r.writes ?? []) writeFileSync(f, JSON.stringify(v));
				return r.line;
			};
			const empty = sn.evaluate({ dir, session: 'local_nobody', input: {}, now: ${NOW} }).line;
			const noSession = sn.evaluate({ dir, session: undefined, input: {}, now: ${NOW} }).line;
			const first = run({ hook_event_name: 'UserPromptSubmit' });
			const second = run({ hook_event_name: 'UserPromptSubmit' });
			console.log(JSON.stringify({ empty, noSession, first, second }));`,
			root,
		);
		expect(out.empty).toBe('');
		expect(out.noSession).toBe('');
		expect(out.first).toBe(
			'Tablero: 1 mensaje nuevo (T7 de gemini). Léalos con «pnpm board inbox --agente=claude».',
		);
		expect(out.second).toBe('');
		// Cost guard: the line stays far below 100 tokens (~4 characters per token).
		expect(out.first.length).toBeLessThan(200);
	});

	it('widens the coordinator to para=coordinador and unheld para=claude messages, and renews its heartbeat', () => {
		const { root } = fixture({
			tasks: [held, other, free],
			log: [
				msg('c1', 'coordinador', 'free', 'codex', 5),
				msg('c2', 'coordinador', 'other', 'gemini', 4),
				msg('k1', 'claude', 'free', 'gemini', 3),
				msg('k2', 'claude', 'other', 'gemini', 2),
			],
			bandejas: [{ id: 'coordinador', leidos: ['c2'] }],
		});
		const out = probe(
			`
			sn.registerCoordinator(dir, '${SESSION}', ${NOW - 3 * 3_600_000});
			const r = sn.evaluate({ dir, session: '${SESSION}', input: { hook_event_name: 'UserPromptSubmit' }, now: ${NOW} });
			for (const [f, v] of r.writes) writeFileSync(f, JSON.stringify(v));
			console.log(JSON.stringify({ line: r.line, beat: store.readCoordinator(dir) }));`,
			root,
		);
		expect(out.line).toBe(
			'Tablero: 2 mensajes nuevos (T9 ×2 de codex/gemini). Léalos con «pnpm board inbox --agente=coordinador» y «--agente=claude».',
		);
		expect(out.beat).toEqual({ sesion: SESSION, at: new Date(NOW).toISOString() });
	});

	it('Stop blocks once with the line and never when the stop hook is already active', () => {
		const { root } = fixture({
			tasks: [held],
			log: [msg('m1', 'claude', 'mine', 'gemini', 3)],
		});
		const out = probe(
			`
			const active = sn.evaluate({ dir, session: '${SESSION}', input: { hook_event_name: 'Stop', stop_hook_active: true }, now: ${NOW} });
			for (const [f, v] of active.writes) writeFileSync(f, JSON.stringify(v));
			const stop = sn.evaluate({ dir, session: '${SESSION}', input: { hook_event_name: 'Stop' }, now: ${NOW} });
			console.log(JSON.stringify({ active: active.line, stop: JSON.parse(stop.line) }));`,
			root,
		);
		expect(out.active).toBe('');
		expect(out.stop).toEqual({
			decision: 'block',
			reason: 'Tablero: 1 mensaje nuevo (T7 de gemini). Léalos con «pnpm board inbox --agente=claude».',
		});
	});

	it('installs both hooks idempotently and keeps other hooks', () => {
		const { root } = fixture();
		const out = probe(
			`
			const file = join(root, 'settings.json');
			writeFileSync(file, JSON.stringify({ model: 'x', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'other' }] }] } }));
			sn.install({ file, node: 'C:\\\\node\\\\node.exe', script: 'D:\\\\repo\\\\scripts\\\\board\\\\session-notice.mjs' });
			sn.install({ file, node: 'C:\\\\node\\\\node.exe', script: 'D:\\\\repo\\\\scripts\\\\board\\\\session-notice.mjs' });
			console.log(readFileSync(file, 'utf8'));`,
			root,
		);
		const command = '"C:/node/node.exe" "D:/repo/scripts/board/session-notice.mjs"';
		expect(out.model).toBe('x');
		expect(out.hooks.UserPromptSubmit).toEqual([
			{ hooks: [{ type: 'command', command, timeout: 10 }] },
		]);
		expect(out.hooks.Stop).toEqual([
			{ hooks: [{ type: 'command', command: 'other' }] },
			{ hooks: [{ type: 'command', command, timeout: 10 }] },
		]);
	});
});

describe('T477 coordinator alert', () => {
	const board = (extra: Row) => ({ tareas: [free], bandejas: [], bitacora: [], ...extra });
	it('alerts on 10-minute-old unread messages, an unregistered coordinator and a silent one', () => {
		const { root } = fixture();
		const out = probe(
			`
			const cases = ${JSON.stringify({
				none: board({}),
				fresh: board({
					bitacora: [msg('a', 'coordinador', 'free', 'codex', 5)],
					coordinador: { sesion: SESSION, at: at(1) },
				}),
				old: board({ bitacora: [msg('a', 'coordinador', 'free', 'codex', 11)] }),
				unregistered: board({ bitacora: [msg('a', 'coordinador', 'free', 'codex', 5)] }),
				silent: board({ coordinador: { sesion: SESSION, at: at(3 * 60) } }),
				alive: board({ coordinador: { sesion: SESSION, at: at(30) } }),
			})};
			const out = Object.fromEntries(Object.entries(cases).map(([k, b]) => [k, next.coordinatorAlert(b, ${NOW})?.clave ?? null]));
			out.inboxFirst = next.ownerInbox(cases.old, { now: ${NOW} })[0]?.clave ?? null;
			console.log(JSON.stringify(out));`,
			root,
		);
		expect(out).toEqual({
			none: null,
			fresh: null,
			old: 'coordinador:mensajes',
			unregistered: 'coordinador:registro',
			silent: 'coordinador:silencio',
			alive: null,
			inboxFirst: 'coordinador:mensajes',
		});
	});
});

describe('T477 state-change notices', () => {
	it('sends one notice per agent state change not covered by claim or close notices', () => {
		const review = {
			id: 'free-revision',
			num: 10,
			titulo: 'Review',
			tipo: 'revision',
			origen: 'free',
			estado: 'pendiente',
		};
		const { root } = fixture({
			tasks: [free, review],
			log: [
				{ tarea: 'free', en: at(20), quien: 'codex', de: 'en curso', a: 'pendiente' },
				{ tarea: 'free-revision', en: at(15), quien: 'claude', de: '', a: 'pendiente' },
				{ tarea: 'free', en: at(10), quien: 'gemini', de: 'pendiente', a: 'en curso' },
				{ tarea: 'free', en: at(9), quien: 'dueno', de: 'en curso', a: 'pendiente' },
				{ tarea: 'free', en: at(90), quien: 'codex', de: 'en curso', a: 'pendiente' },
			],
		});
		const out = probe(
			`
			const run = async (now) => {
				const board = store.loadBoard(dir);
				const state = existsSync(join(root, 's.json')) ? JSON.parse(readFileSync(join(root, 's.json'), 'utf8')) : {};
				const notices = await mw.checkAutomaticNotices({ dir, board, state, now, readPr: () => null, sendTelegram: async () => {} });
				writeFileSync(join(root, 's.json'), JSON.stringify(state));
				return notices.filter((n) => n.id.startsWith('aviso-estado-')).map((n) => n.texto);
			};
			const first = await run(${NOW});
			const second = await run(${NOW + 60_000});
			console.log(JSON.stringify({ first, second }));`,
			root,
		);
		expect(out.first.sort()).toEqual([
			'T10 · claude: nueva → pendiente',
			'T9 · codex: en curso → pendiente',
		]);
		expect(out.second).toEqual([]);
	});
});
