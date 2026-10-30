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
function probe(dir: string, code: string, serverCode?: string, env?: NodeJS.ProcessEnv) {
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
			command: process.execPath, args: ${JSON.stringify(serverCode ? ['--input-type=module', '-e', serverCode] : ['scripts/board/mcp-server.mjs'])},
			cwd: process.cwd(), env: Object.fromEntries(Object.entries(process.env).filter(([,v]) => v !== undefined)),
		});
		try { await client.connect(transport); ${code} }
		finally { await client.close(); }
	`,
		],
		{
			cwd: ROOT,
			env: sanitizeEnv({
				CELEBRA_BOARD_DIR: dir,
				CELEBRA_BOARD_CHECKOUT: '',
				CLAUDE_CODE_HOST_SESSION_ID: '',
				...env,
			}),
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
			expect(tool.inputSchema.required.includes('rev')).toBe(tool.name === 'close');
		}
	});

	it('claims with the explicit session, refuses another owner and releases without rev', () => {
		const dir = fixture();
		const result = probe(
			dir,
			`
			const args = { agente: 'codex', id: 'ready', carril: 'f10-libre', rama: 'fix/test', titulo: 'f10 · T1 · Test claim' };
			const missing = await client.callTool({ name: 'claim', arguments: args });
			const claimed = await client.callTool({ name: 'claim', arguments: { ...args, sesion: 'test-owner' } });
			const intruder = await client.callTool({ name: 'claim', arguments: { ...args, sesion: 'intruder' } });
			const released = await client.callTool({ name: 'release', arguments: { agente: 'codex', id: 'ready', sesion: 'test-owner' } });
			console.log(JSON.stringify({ missing, claimed, intruder, released }));
		`,
		);
		expect(result.missing.isError).toBe(true);
		expect(result.claimed).not.toMatchObject({ isError: true });
		expect(JSON.parse(result.claimed.content[0].text)).toMatchObject({
			estado: 'en curso',
			candado: {
				agente: 'codex',
				sesion: 'test-owner',
				carril: 'f10-libre',
				rama: 'fix/test',
			},
		});
		expect(result.intruder.isError).toBe(true);
		expect(result.released.isError).not.toBe(true);
		expect(
			JSON.parse(readFileSync(path.join(dir, 'tareas', 'ready.json'), 'utf8')).candado,
		).toBeUndefined();
	});

	it('derives the Claude lock session from the inherited host environment', () => {
		const dir = fixture();
		const file = path.join(dir, 'tareas', 'ready.json');
		writeFileSync(
			file,
			JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), agente: 'claude' }),
		);
		const result = probe(
			dir,
			`console.log(JSON.stringify(await client.callTool({ name: 'claim', arguments: {
			agente: 'claude', id: 'ready', carril: 'f10-libre', titulo: 'f10 · T1 · Test inherited session'
		} })));`,
			undefined,
			{ CLAUDE_CODE_HOST_SESSION_ID: 'local_test-host' },
		);
		expect(result).not.toMatchObject({ isError: true });
		expect(JSON.parse(result.content[0].text).candado.sesion).toBe('local_test-host');
	});

	it('round-trips repeated close flags and preserves omitted lists and changelog', () => {
		const result = probe(
			fixture(),
			`
			const args = { agente: 'codex', sesion: 'owner', id: 'locked', rev: 1,
				resumen: ['First line', 'Second line'], comprobacion: ['check one', 'check two'],
				saltada: ['skip one', 'skip two'], pendiente: ['Follow up→T1', 'Another follow up→T2'],
				fallida: ['failure one', 'failure two'], riesgo: ['risk one', 'risk two'], duda: ['question one', 'question two'],
				hallazgo: ['P3|scripts/example.mjs:1|First finding', 'P3|scripts/example.mjs:2|Second finding'],
				changelog: 'Fixed: Board adapter',
			};
			const first = await client.callTool({ name: 'close', arguments: args });
			const data = first.isError ? null : JSON.parse(first.content[0].text);
			const second = data && await client.callTool({ name: 'close', arguments: {
				agente: 'codex', sesion: 'owner', id: 'locked', rev: data.rev, resumen: ['Updated summary']
			} });
			const stale = data && await client.callTool({ name: 'close', arguments: args });
			const final = second && !second.isError && await client.callTool({ name: 'close', arguments: {
				agente: 'codex', sesion: 'owner', id: 'locked', rev: JSON.parse(second.content[0].text).rev,
				excepcion: ['exception one', 'exception two']
			} });
			console.log(JSON.stringify({ first, second, stale, final }));
		`,
		);
		expect(result.first.isError).not.toBe(true);
		const first = JSON.parse(result.first.content[0].text).cierre;
		expect(first).toMatchObject({
			resumen: 'First line\nSecond line',
			comprobaciones: ['check one', 'check two'],
			saltadas: ['skip one', 'skip two'],
			fallidas: ['failure one', 'failure two'],
			riesgos: ['risk one', 'risk two'],
			dudas: ['question one', 'question two'],
			pendientes: [
				{ texto: 'Follow up', tarea: 'ready' },
				{ texto: 'Another follow up', tarea: 'delivered' },
			],
			changelog: { grupo: 'Fixed', texto: 'Board adapter' },
			resultado: {
				hallazgos: [
					{ p: 'P3', archivo: 'scripts/example.mjs:1', texto: 'First finding' },
					{ p: 'P3', archivo: 'scripts/example.mjs:2', texto: 'Second finding' },
				],
			},
		});
		expect(result.second.isError).not.toBe(true);
		expect(JSON.parse(result.second.content[0].text).cierre).toMatchObject({
			...first,
			resumen: 'Updated summary',
			en: expect.any(String),
		});
		expect(result.stale.isError).toBe(true);
		expect(result.final.isError).not.toBe(true);
		expect(JSON.parse(result.final.content[0].text)).toMatchObject({
			estado: 'hecha',
			cierre: { excepcion: ['exception one', 'exception two'] },
		});
	});

	it('uses the model value enums and handles coordinator messages without rev', () => {
		const result = probe(
			fixture(),
			`
			const { AGENT_REGISTRY, DESTINOS, ATENDIBLES, NIVELES, VEREDICTOS } = await import('./scripts/board/model.mjs');
			const tools = (await client.listTools()).tools;
			const properties = name => tools.find(t => t.name === name).inputSchema.properties;
			const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
			const matches = [
				same(properties('claim').agente.enum, Object.keys(AGENT_REGISTRY)),
				same(properties('msg').para.enum, DESTINOS), same(properties('atendido').para.enum, ATENDIBLES),
				same(properties('close').nivel.enum, NIVELES), same(properties('close').veredicto.enum, VEREDICTOS)
			];
			const sent = await client.callTool({ name: 'msg', arguments: { agente: 'codex', id: 'ready', para: 'coordinador', texto: 'Test message' } });
			const handled = await client.callTool({ name: 'atendido', arguments: { agente: 'codex', id: 'ready', para: 'coordinador' } });
			console.log(JSON.stringify({ matches, sent, handled }));
		`,
		);
		expect(result.matches).toEqual([true, true, true, true, true]);
		expect(result.sent.isError).not.toBe(true);
		expect(result.handled.isError).not.toBe(true);
	});

	it('returns a clear MCP error when the CLI child exceeds its timeout', () => {
		const result = probe(
			fixture(),
			`console.log(JSON.stringify(await client.callTool({ name: 'show', arguments: { agente: 'codex', id: 'ready' } })));`,
			`
			import { createServer } from './scripts/board/mcp-server.mjs';
			import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
			await createServer({ cliTimeoutMs: 1 }).connect(new StdioServerTransport());
		`,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Board CLI timed out after 1 ms');
	});

	it('leaves required closing fields to the CLI and preserves the task on refusal', () => {
		const dir = fixture();
		const file = path.join(dir, 'tareas', 'locked.json');
		const task = { ...JSON.parse(readFileSync(file, 'utf8')), contrato: 2, tipo: 'codigo' };
		writeFileSync(file, JSON.stringify(task));
		const before = readFileSync(file, 'utf8');
		const result = probe(
			dir,
			`console.log(JSON.stringify(await client.callTool({ name: 'close', arguments: {
			agente: 'codex', sesion: 'owner', id: 'locked', rev: 1, resumen: ['Incomplete handoff']
		} })));`,
		);
		expect(result.isError).toBe(true);
		expect(JSON.parse(result.content[0].text)).toMatchObject({
			codigo: 2,
			error: expect.stringContaining('no se escribió'),
		});
		expect(readFileSync(file, 'utf8')).toBe(before);
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

	it('logs every call without message text and marks its bitácora rows as mcp', () => {
		const dir = fixture();
		const result = probe(
			dir,
			`
			const call = async (name, args) => {
				try { return await client.callTool({ name, arguments: args }); }
				catch (error) { return { isError: true, content: [{ text: error.message }] }; }
			};
			const sent = await call('msg', { agente: 'codex', id: 'ready', para: 'gemini', texto: 'secret body' });
			const missing = await call('show', { id: 'ready' });
			const wrong = await call('show', { agente: 'Gemini', id: 'ready' });
			const refused = await call('release', { agente: 'codex', sesion: 'intruder', id: 'locked' });
			console.log(JSON.stringify({ sent, missing, wrong, refused }));
		`,
		);
		expect(result.sent.isError).not.toBe(true);
		expect(result.missing.isError).toBe(true);
		expect(result.missing.content[0].text).toContain(
			'Falta `agente`: envíe "claude", "codex" o "gemini".',
		);
		expect(result.wrong.isError).toBe(true);
		expect(result.wrong.content[0].text).toContain('`agente` no válido ("Gemini")');
		expect(result.refused.isError).toBe(true);

		const day = (sub: string) => {
			const file = path.join(dir, sub, `${new Date().toISOString().slice(0, 10)}.jsonl`);
			return readFileSync(file, 'utf8');
		};
		const calls = day('mcp');
		expect(calls).not.toContain('secret body');
		expect(
			calls
				.trim()
				.split('\n')
				.map((line) => JSON.parse(line)),
		).toEqual([
			expect.objectContaining({
				herramienta: 'msg',
				agente: 'codex',
				tarea: 'ready',
				ok: true,
				codigo: 0,
				ms: expect.any(Number),
				en: expect.any(String),
			}),
			expect.objectContaining({
				herramienta: 'show',
				agente: null,
				ok: false,
				codigo: 'validacion',
				error: expect.stringContaining('Falta `agente`'),
			}),
			expect.objectContaining({
				herramienta: 'show',
				agente: 'Gemini',
				codigo: 'validacion',
			}),
			expect.objectContaining({
				herramienta: 'release',
				ok: false,
				codigo: 2,
				error: expect.stringContaining('candado'),
			}),
		]);
		const rows = day('bitacora')
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		expect(rows.find((row) => row.mensaje)).toMatchObject({ quien: 'codex', via: 'mcp' });
	});

	it('treats empty list fields as omitted', () => {
		const result = probe(
			fixture(),
			`console.log(JSON.stringify(await client.callTool({ name: 'close', arguments: {
			agente: 'codex', sesion: 'owner', id: 'locked', rev: 1, resumen: ['Done'], pendiente: [], riesgo: []
		} })));`,
		);
		expect(result.isError).not.toBe(true);
		expect(JSON.parse(result.content[0].text).cierre.resumen).toBe('Done');
	});

	it('marks rows written by a direct CLI call as cli', () => {
		const dir = fixture();
		runCommand(
			process.execPath,
			[
				'scripts/board/board.mjs',
				'msg',
				'ready',
				'--de=codex',
				'--quien=codex',
				'--para=gemini',
				'--texto=hello',
				'--json',
			],
			{ cwd: ROOT, env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir, CELEBRA_BOARD_VIA: '' }) },
		);
		const file = path.join(dir, 'bitacora', `${new Date().toISOString().slice(0, 10)}.jsonl`);
		const row = JSON.parse(readFileSync(file, 'utf8').trim().split('\n').at(-1) ?? '{}');
		expect(row).toMatchObject({ quien: 'codex', via: 'cli' });
	});
});
