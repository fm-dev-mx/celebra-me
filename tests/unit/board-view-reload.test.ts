import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SUPERVISOR = pathToFileURL(path.join(ROOT, 'scripts', 'board', 'view-supervisor.mjs')).href;
const SERVER = pathToFileURL(path.join(ROOT, 'scripts', 'board', 'view-server.mjs')).href;

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tempDir() {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-view-reload-'));
	dirs.push(dir);
	return dir;
}

/** A stand-in for view-worker.mjs: answers its code tag and drains like the real worker. */
const worker = (tag: string) => `
import { createServer } from 'node:http';
const server = createServer((_req, res) => res.end('${tag}|' + process.env.BOARD_VIEW_TOKEN.length));
server.listen(Number(process.env.BOARD_VIEW_PORT), '127.0.0.1');
process.on('message', (m) => { if (m === 'drain') server.close(() => process.exit(0)); });
`;

/** `quiet: false` when a worker is meant to fail and print its error. */
function probe(script: string, args: string[], { quiet = true } = {}) {
	const result = runCommand(process.execPath, ['--input-type=module', '-e', script, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv(),
	});
	if (quiet) expect(result.stderr).toBe('');
	expect(result.status).toBe(0);
	return JSON.parse(result.stdout);
}

describe('board view hot reload (d210)', () => {
	it('swaps in new code on the same port without a failed request, and keeps it on broken code', () => {
		const code = tempDir();
		writeFileSync(path.join(code, 'worker.mjs'), worker('v1'));
		const script = String.raw`
			import { createServer, get } from 'node:http';
			import { writeFileSync } from 'node:fs';
			import { join } from 'node:path';
			const [, url, code] = process.argv;
			const { superviseView } = await import(url);
			const free = await new Promise((ok) => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
			const logs = [];
			const view = await superviseView({ port: free, exec: join(code, 'worker.mjs'), watchDirs: [code], settleMs: 50, reconcileMs: 60_000, drainMs: 2000, log: (l) => logs.push(l) });
			const ask = () => new Promise((ok) => get({ host: '127.0.0.1', port: free, path: '/', agent: false }, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => ok(b)); }).on('error', () => ok('ERROR')));
			const answers = [];
			let polling = true;
			const poller = (async () => { while (polling) { answers.push(await ask()); await new Promise((r) => setTimeout(r, 10)); } })();
			const until = async (fn) => { for (let i = 0; i < 300; i++) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 20)); } return false; };
			const first = view.version();
			writeFileSync(join(code, 'worker.mjs'), ${JSON.stringify(worker('v2'))});
			const swapped = await until(async () => (await ask()).startsWith('v2|'));
			const second = view.version();
			writeFileSync(join(code, 'worker.mjs'), 'export const = ;');
			const refused = await until(() => logs.some((l) => l.includes('no arrancó')));
			const kept = await ask();
			polling = false;
			await poller;
			view.close();
			console.log(JSON.stringify({ swapped, refused, kept, changed: first !== second, failed: answers.filter((a) => a === 'ERROR').length, tags: [...new Set(answers)] }));
			process.exit(0);
		`;
		const r = probe(script, [SUPERVISOR, code], { quiet: false });
		expect(r).toMatchObject({
			swapped: true,
			refused: true,
			kept: 'v2|64',
			changed: true,
			failed: 0,
		});
		expect(r.tags).toEqual(expect.arrayContaining(['v1|64', 'v2|64']));
	});

	it('hashes only code files, so data or notes in the folder never restart the view', () => {
		const code = tempDir();
		writeFileSync(path.join(code, 'a.mjs'), 'export const a = 1;');
		const script = String.raw`
			import { writeFileSync } from 'node:fs';
			import { join } from 'node:path';
			const [, url, code] = process.argv;
			const { codeVersion } = await import(url);
			const first = codeVersion([code]);
			writeFileSync(join(code, 'notes.json'), '{}');
			const sameAfterData = codeVersion([code]) === first;
			writeFileSync(join(code, 'view.html'), '<p>');
			const changedAfterPage = codeVersion([code]) !== first;
			console.log(JSON.stringify({ sameAfterData, changedAfterPage, missingDirOk: typeof codeVersion([join(code, 'none')]) === 'string' }));
		`;
		expect(probe(script, [SUPERVISOR, code])).toEqual({
			sameAfterData: true,
			changedAfterPage: true,
			missingDirOk: true,
		});
	});

	it('serves the shared token and version, and drain ends the live stream so the page reconnects', () => {
		const board = tempDir();
		const script = String.raw`
			import { request } from 'node:http';
			const [, url, dir] = process.argv;
			const { serveView } = await import(url);
			const token = 'a'.repeat(64);
			const server = await serveView(dir, 0, { token, version: 'abc123', reconcileMs: 60_000 });
			const port = server.address().port;
			const closed = new Promise((ok) => server.once('close', ok));
			const page = await new Promise((ok) => request({ host: '127.0.0.1', port, path: '/' }, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => ok(b)); }).end());
			const stream = await new Promise((ok) => {
				request({ host: '127.0.0.1', port, path: '/api/stream' }, (res) => {
					let b = '';
					res.on('data', (c) => { b += c; if (b.includes('event: version')) server.drain(); });
					res.on('end', () => ok(b));
				}).end();
			});
			await closed;
			console.log(JSON.stringify({
				token: page.includes('content="' + token + '"'),
				version: page.includes('content="abc123"'),
				retry: stream.startsWith('retry: 1000'),
				announced: stream.includes('event: version\ndata: {"version":"abc123"}'),
			}));
		`;
		expect(probe(script, [SERVER, board])).toEqual({
			token: true,
			version: true,
			retry: true,
			announced: true,
		});
	});
});
