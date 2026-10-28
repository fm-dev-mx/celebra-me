import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const CHECK = pathToFileURL(path.join(ROOT, 'scripts/board/mcp-check.mjs')).href;
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temporaryEntry(source: string) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-mcp-check-'));
	dirs.push(dir);
	const entry = path.join(dir, 'server.mjs');
	writeFileSync(entry, source);
	return entry;
}

describe('board MCP startup diagnostic', () => {
	it('discovers without invoking tools or inheriting credential variables', () => {
		const sdk = (file: string) =>
			pathToFileURL(path.join(ROOT, 'node_modules/@modelcontextprotocol/sdk/dist/esm', file))
				.href;
		const entry = temporaryEntry(`
			import { McpServer } from ${JSON.stringify(sdk('server/mcp.js'))};
			import { StdioServerTransport } from ${JSON.stringify(sdk('server/stdio.js'))};
			import { writeFileSync } from 'node:fs';
			if (process.env.SECRET_CHECK_SENTINEL || process.env.CELEBRA_BOARD_DIR) process.exit(3);
			const server = new McpServer({ name: 'probe', version: '1.0.0' });
			server.registerTool('forbidden_call', { inputSchema: {} }, async () => {
				writeFileSync(new URL('./called', import.meta.url), 'called');
				throw new Error('Tool must never run');
			});
			await server.connect(new StdioServerTransport());
		`);
		const result = runCommand(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				`import { checkMcp } from ${JSON.stringify(CHECK)};
			console.log(JSON.stringify(await checkMcp({ entry: process.argv[1] })));`,
				entry,
			],
			{
				cwd: ROOT,
				env: sanitizeEnv({ SECRET_CHECK_SENTINEL: 'hidden', CELEBRA_BOARD_DIR: 'unused' }),
			},
		);
		expect(JSON.parse(result.stdout)).toEqual({ ok: true, tools: ['forbidden_call'] });
		expect(existsSync(path.join(path.dirname(entry), 'called'))).toBe(false);
	});

	it('starts the real server and lists its tools without calling board commands', () => {
		// A broken board override must not affect discovery; no tool reads or consumes the inbox.
		const result = runCommand(process.execPath, ['scripts/board/mcp-check.mjs'], {
			cwd: ROOT,
			env: sanitizeEnv({ CELEBRA_BOARD_DIR: 'not-a-board', SECRET_CHECK_SENTINEL: 'hidden' }),
		});
		const data = JSON.parse(result.stdout);
		expect(data.ok).toBe(true);
		expect(data.tools).toEqual([
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
		expect(result.stderr).toBe('');
		expect(result.stdout).not.toContain('hidden');
	});

	it.each([
		['exits', 'process.exit(1);'],
		['stalls', 'setInterval(() => {}, 1000);'],
	])('fails and closes the child when initialization %s', (_name, source) => {
		const result = runCommand(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				`import { checkMcp } from ${JSON.stringify(CHECK)};
			try { await checkMcp({ entry: process.argv[1], timeout: 200 }); process.exitCode = 2; }
			catch { console.log('expected failure'); }`,
				temporaryEntry(source),
			],
			{ cwd: ROOT, env: sanitizeEnv({}) },
		);
		expect(result.stdout.trim()).toBe('expected failure');
	});
});
