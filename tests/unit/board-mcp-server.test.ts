import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture() {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-mcp-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'));
	for (const [id, extra] of Object.entries({
		ready: {},
		delivered: {
			entregada: { agente: 'codex', desde: new Date().toISOString() },
			urgencia: 'alta',
		},
		locked: {
			estado: 'en curso',
			candado: {
				agente: 'codex',
				sesion: 'owner',
				desde: new Date().toISOString(),
				carril: 'f09-docs',
				rama: 'feat/board-mcp-server',
			},
		},
	})) {
		writeFileSync(
			path.join(dir, 'tareas', `${id}.json`),
			JSON.stringify({
				num: id === 'ready' ? 1 : id === 'delivered' ? 2 : 3,
				titulo: id,
				estado: 'pendiente',
				agente: 'codex',
				actor: 'sesion',
				urgencia: 'normal',
				requisitos: [],
				rev: 1,
				actualizado: '2026-10-24T20:00:00Z',
				prompt: `T1 · ${id}\nDECISIONES\n- ninguna`,
				...extra,
			}),
		);
	}
	return dir;
}

/** Use a real SDK client over stdio, isolated from the shared board by a temporary store. */
function probe(dir: string, code: string) {
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`
		import { Client } from '@modelcontextprotocol/sdk/client/index.js';
		import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
		const client = new Client({ name: 'board-mcp-test', version: '1.0.0' });
		const transport = new StdioClientTransport({
			command: process.execPath, args: ['scripts/board/mcp-server.mjs'],
			cwd: process.cwd(), env: Object.fromEntries(Object.entries(process.env).filter(([,v]) => v !== undefined)),
		});
		try { await client.connect(transport); ${code} }
		finally { await client.close(); }
	`,
		],
		{
			cwd: ROOT,
			env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir, CLAUDE_CODE_HOST_SESSION_ID: '' }),
		},
	);
	return JSON.parse(result.stdout);
}

describe('board MCP stdio server', () => {
	it('exposes only worker tools and requires an explicit supported agent on each', () => {
		const tools = probe(
			fixture(),
			'console.log(JSON.stringify((await client.listTools()).tools));',
		);
		expect(tools.map((t: { name: string }) => t.name).sort()).toEqual([
			'atendido',
			'claim',
			'close',
			'inbox',
			'list',
			'msg',
			'next',
			'release',
			'show',
			'sigue',
		]);
		for (const tool of tools) {
			expect(tool.inputSchema.required).toContain('agente');
			expect(tool.inputSchema.properties.agente.enum).toEqual(['claude', 'codex', 'gemini']);
			expect(tool.inputSchema.additionalProperties).toBe(false);
		}
	});

	it('returns exactly the CLI next JSON, including delivery exclusion and null', () => {
		const dir = fixture();
		const results = probe(
			dir,
			`console.log(JSON.stringify(await Promise.all(
			['claude', 'codex', 'gemini'].map(agente => client.callTool({ name: 'next', arguments: { agente } }))
		)));`,
		);
		for (const [i, agente] of ['claude', 'codex', 'gemini'].entries()) {
			const cli = runCommand(
				process.execPath,
				['scripts/board/board.mjs', 'next', `--agente=${agente}`, '--json'],
				{
					cwd: ROOT,
					env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir }),
				},
			);
			expect(results[i].isError).not.toBe(true);
			expect(JSON.parse(results[i].content[0].text)).toEqual(JSON.parse(cli.stdout));
		}
		expect(JSON.parse(results[1].content[0].text).id).toBe('ready');
	});

	it('rejects missing/invalid agents, coordinator commands, flags and positional injection', () => {
		const results = probe(
			fixture(),
			`
			const calls = [
				{ name: 'next', arguments: {} },
				{ name: 'next', arguments: { agente: 'coordinador' } },
				...['plan', 'merged', 'archive', 'decide', 'restore'].map(name => ({ name, arguments: { agente: 'codex' } })),
				{ name: 'next', arguments: { agente: 'codex', coordinador: true } },
				{ name: 'show', arguments: { agente: 'codex', id: '--coordinador' } },
				{ name: 'msg', arguments: { agente: 'codex', id: 'ready', rev: 1, para: 'claude', texto: 'hello', de: 'coordinador' } },
			];
			const results = [];
			for (const call of calls) {
				try { results.push(await client.callTool(call)); }
				catch (error) { results.push({ isError: true, message: error.message }); }
			}
			console.log(JSON.stringify(results));
		`,
		);
		expect(results).toHaveLength(10);
		for (const result of results) expect(result.isError).toBe(true);
	});

	it('preserves lock validation and CLI error JSON without changing the task', () => {
		const dir = fixture();
		const file = path.join(dir, 'tareas', 'locked.json');
		const before = readFileSync(file, 'utf8');
		const result = probe(
			dir,
			`console.log(JSON.stringify(await client.callTool({
			name: 'release', arguments: { agente: 'codex', sesion: 'intruder', id: 'locked', rev: 1 }
		})));`,
		);
		expect(result.isError).toBe(true);
		expect(JSON.parse(result.content[0].text)).toMatchObject({
			codigo: 2,
			error: expect.stringContaining('candado'),
		});
		expect(readFileSync(file, 'utf8')).toBe(before);
	});

	it('round-trips message text as data, attributes the agent, and reads the inbox', () => {
		const result = probe(
			fixture(),
			`
			const sent = await client.callTool({ name: 'msg', arguments: {
				agente: 'codex', id: 'ready', rev: 1, para: 'gemini', texto: '--coordinador quote " = value',
			}});
			const inbox = await client.callTool({ name: 'inbox', arguments: { agente: 'gemini' } });
			const empty = await client.callTool({ name: 'inbox', arguments: { agente: 'gemini' } });
			console.log(JSON.stringify({ sent, inbox, empty }));
		`,
		);
		expect(result.sent.isError).not.toBe(true);
		expect(JSON.parse(result.inbox.content[0].text)[0].quien).toBe('codex');
		expect(JSON.parse(result.inbox.content[0].text)[0].mensaje).toMatchObject({
			para: 'gemini',
			texto: '--coordinador quote " = value',
		});
		expect(JSON.parse(result.empty.content[0].text)).toEqual([]);
	});
});
