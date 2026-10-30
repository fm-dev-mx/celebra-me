import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const MODULE = pathToFileURL(path.join(ROOT, 'scripts/board/owner-alerts.mjs')).href;
const TOKEN = '123456789:fake-token-for-tests-only-0000000000';
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function fixture() {
	const root = mkdtempSync(path.join(tmpdir(), 'board-owner-alerts-'));
	dirs.push(root);
	mkdirSync(path.join(root, 'board', 'tareas'), { recursive: true });
	return root;
}

/** Runs `code` with `m` (owner-alerts), `tg` (telegram), `dir`, `root` and a fake fetch; no network. */
function probe(code: string, root: string) {
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`
		import { existsSync, readFileSync } from 'node:fs';
		import { join } from 'node:path';
		const m = await import(process.argv[1]); const root = process.argv[2];
		const tg = await import(new URL('./telegram.mjs', process.argv[1]));
		const dir = join(root, 'board');
		const calls = [];
		const fakeFetch = (reply = { ok: true, status: 200, body: { ok: true } }) => async (url, init) => {
			calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
			return { ok: reply.ok, status: reply.status, json: async () => reply.body };
		};
		const msg = (id, tarea) => ({ tarea, en: '2026-10-29T10:00:00Z', quien: 'claude', mensaje: { id, para: 'dueno', texto: id } });
		const task = { id: 'andrea', num: 418, titulo: 'Andrea', estado: 'en curso', urgencia: 'alta', actor: 'sesion', agente: 'claude', requisitos: [], rev: 1, actualizado: '2026-10-29T10:00:00Z' };
		const NOW = Date.parse('2026-10-29T10:05:00Z');
		${code}`,
			MODULE,
			root,
		],
		{ cwd: ROOT, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr || result.stdout));
	return JSON.parse(result.stdout);
}

describe('T437 owner alerts on Telegram', () => {
	it('sends one grouped alert per new item, re-arms after it leaves and never sends an empty list', () => {
		const root = fixture();
		const r = probe(
			`
			const config = { token: 'x', chatId: '1' };
			const sent = [];
			const sendTelegram = async (text) => { sent.push(text); return { ok: true }; };
			const state = {};
			const run = (board) => m.checkOwnerAlerts({ dir, board, state, now: NOW, config, sendTelegram, log: () => {} });
			const empty = { tareas: [task], archivo: [], bitacora: [] };
			const one = { ...empty, bitacora: [msg('m1', 'andrea')] };
			const two = { ...empty, bitacora: [msg('m1', 'andrea'), msg('m2', 'andrea'), msg('m3', 'andrea')] };
			await run(empty);
			await run(one);
			await run(one);
			await run(two);
			await run(empty);
			await run(one);
			console.log(JSON.stringify({ sent, alertadas: state.owner.alertadas }));`,
			root,
		);
		expect(r.sent).toEqual([
			'Mensaje: claude → dueno sobre T418: m1. Tablero: http://127.0.0.1:4320',
			[
				'Le toca a usted (2 nuevas):',
				'- Mensaje: claude → dueno sobre T418: m2',
				'- Mensaje: claude → dueno sobre T418: m3',
				'Tablero: http://127.0.0.1:4320',
			].join('\n'),
			'Mensaje: claude → dueno sobre T418: m1. Tablero: http://127.0.0.1:4320',
		]);
		expect(r.alertadas).toEqual(['mensaje:m1']);
	});

	it('without configuration keeps working, logs once and does not flood later', () => {
		const root = fixture();
		const r = probe(
			`
			const logged = [];
			const sent = [];
			const sendTelegram = async (text) => { sent.push(text); return { ok: true }; };
			const state = {};
			const log = (line) => logged.push(line);
			const board = (...ids) => ({ tareas: [task], archivo: [], bitacora: ids.map((id) => msg(id, 'andrea')) });
			await m.checkOwnerAlerts({ dir, board: board('m1'), state, now: NOW, config: null, sendTelegram, log });
			await m.checkOwnerAlerts({ dir, board: board('m1', 'm2'), state, now: NOW, config: null, sendTelegram, log });
			const config = { token: 'x', chatId: '1' };
			await m.checkOwnerAlerts({ dir, board: board('m1', 'm2', 'm3'), state, now: NOW, config, sendTelegram, log });
			console.log(JSON.stringify({ logged, sent, sinConfig: state.owner.sinConfig ?? null }));`,
			root,
		);
		expect(r.logged).toHaveLength(1);
		expect(r.logged[0]).toContain('Telegram sin configurar');
		expect(r.sent).toEqual([
			'Mensaje: claude → dueno sobre T418: m3. Tablero: http://127.0.0.1:4320',
		]);
		expect(r.sinConfig).toBeNull();
	});

	it('retries after a failed send and prints only a preview in dry-run', () => {
		const root = fixture();
		const r = probe(
			`
			const config = { token: 'x', chatId: '1' };
			const board = { tareas: [task], archivo: [], bitacora: [msg('m1', 'andrea')] };
			const state = {};
			const printed = [];
			let attempts = 0;
			const failing = async () => { attempts++; return { ok: false, status: 502 }; };
			const dry = await m.checkOwnerAlerts({ dir, board, state, now: NOW, config, dryRun: true, out: (t) => printed.push(t), sendTelegram: failing, log: () => {} });
			const stateAfterDry = JSON.stringify(state);
			await m.checkOwnerAlerts({ dir, board, state, now: NOW, config, sendTelegram: failing, log: () => {} });
			const sent = await m.checkOwnerAlerts({ dir, board, state, now: NOW, config, sendTelegram: async () => ({ ok: true }), log: () => {} });
			console.log(JSON.stringify({ dry: dry.length, printed, stateAfterDry, attempts, sent: sent.map((x) => x.clave) }));`,
			root,
		);
		expect(r.dry).toBe(1);
		expect(r.printed[0]).toMatch(/^\[prueba\] telegram: Mensaje/);
		expect(r.stateAfterDry).toBe('{}');
		expect(r.attempts).toBe(1);
		expect(r.sent).toEqual(['mensaje:m1']);
	});

	it('real transport goes through the fake fetch with the configured chat', () => {
		const root = fixture();
		const r = probe(
			`
			const board = { tareas: [task], archivo: [], bitacora: [msg('m1', 'andrea')] };
			const config = { token: 'x', chatId: '42' };
			const sendTelegram = (text, opts) => tg.sendTelegramAlert(text, { ...opts, fetch: fakeFetch() });
			await m.checkOwnerAlerts({ dir, board, state: {}, now: NOW, config, sendTelegram, log: () => {} });
			console.log(JSON.stringify(calls));`,
			root,
		);
		expect(r).toEqual([
			{
				url: 'https://api.telegram.org/botx/sendMessage',
				body: {
					chat_id: '42',
					text: 'Mensaje: claude → dueno sobre T418: m1. Tablero: http://127.0.0.1:4320',
				},
			},
		]);
	});
});

describe('T437 Telegram setup commands', () => {
	it('saves the token from a hidden prompt, finds the chat with getUpdates and sends the test', () => {
		const root = fixture();
		const r = probe(
			`
			const printed = [];
			const out = (t) => printed.push(t);
			const bad = await tg.saveToken(dir, { prompt: async () => 'not-a-token', out });
			const missing = existsSync(join(root, 'telegram.json'));
			await tg.saveToken(dir, { prompt: async () => '${TOKEN}', out });
			const updates = { ok: true, result: [
				{ message: { chat: { id: -5, type: 'group' }, text: 'hola' } },
				{ message: { chat: { id: 77, type: 'private' }, text: 'Hola' } },
				{ message: { chat: { id: 88, type: 'private' }, text: 'otra cosa' } },
			] };
			const chat = await tg.discoverChat(dir, { fetch: fakeFetch({ ok: true, status: 200, body: updates }), out });
			const saved = JSON.parse(readFileSync(join(root, 'telegram.json'), 'utf8'));
			const test = await tg.sendTest(dir, { fetch: fakeFetch(), out });
			console.log(JSON.stringify({ bad, missing, chat, saved, test, calls, printed }));`,
			root,
		);
		expect(r.bad).toBe(false);
		expect(r.missing).toBe(false);
		expect(r.chat).toBe(true);
		expect(r.saved).toEqual({ token: TOKEN, chatId: '77' });
		expect(r.test).toBe(true);
		expect(r.calls.map((c: { url: string }) => c.url.split('/').pop())).toEqual([
			'getUpdates',
			'sendMessage',
		]);
		expect(r.calls[1].body).toEqual({ chat_id: '77', text: 'Prueba de Celebra-me' });
		// Nothing printed ever contains the token or the chat id.
		expect(r.printed.join('\n')).not.toContain(TOKEN);
		expect(r.printed.join('\n')).not.toContain('77');
	});

	it('explains the next step when the owner has not written to the bot yet', () => {
		const root = fixture();
		const r = probe(
			`
			const printed = [];
			const out = (t) => printed.push(t);
			const noToken = await tg.discoverChat(dir, { fetch: fakeFetch(), out });
			await tg.saveToken(dir, { prompt: async () => '${TOKEN}', out });
			const empty = await tg.discoverChat(dir, { fetch: fakeFetch({ ok: true, status: 200, body: { ok: true, result: [] } }), out });
			const test = await tg.sendTest(dir, { fetch: fakeFetch(), out });
			console.log(JSON.stringify({ noToken, empty, test, calls: calls.length, printed }));`,
			root,
		);
		expect(r).toMatchObject({ noToken: false, empty: false, test: false, calls: 1 });
		expect(r.printed[0]).toContain('pnpm board:telegram:token');
		expect(r.printed.at(-2)).toContain('«hola»');
		expect(r.printed.at(-1)).toContain('Falta configuración');
	});
});
