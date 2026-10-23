/**
 * Read-only local server for the board view: the page, the shared model and the board as JSON.
 * `/api/stream` pushes the board as Server-Sent Events whenever a file in the store changes, so the page
 * shows a write in under a second; `/api/board` stays for one-off reads.
 */
import { existsSync, mkdirSync, readFileSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBoard } from './store.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FILES = {
	'/': ['view.html', 'text/html; charset=utf-8'],
	'/model.mjs': ['model.mjs', 'text/javascript; charset=utf-8'],
};
const SETTLE_MS = 150;
const HEARTBEAT_MS = 25_000;

/** Calls `onChange(json)` once a burst of writes settles and the board really changed. */
function watchBoard(dir, onChange) {
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	let last = JSON.stringify(loadBoard(dir));
	let timer = null;
	const check = () => {
		timer = null;
		let next;
		try {
			next = JSON.stringify(loadBoard(dir));
		} catch {
			return; // a half-renamed file: the next event reads it whole
		}
		if (next === last) return;
		last = next;
		onChange(next);
	};
	const watcher = watch(dir, { recursive: true }, (_event, file) => {
		if (file && !String(file).endsWith('.json')) return;
		clearTimeout(timer);
		timer = setTimeout(check, SETTLE_MS);
	});
	return { current: () => last, close: () => watcher.close() };
}

export function serveView(dir, port) {
	const clients = new Set();
	const send = (res, json) => res.write(`data: ${json}\n\n`);
	const board = watchBoard(dir, (json) => {
		for (const res of clients) send(res, json);
	});
	const heartbeat = setInterval(() => {
		for (const res of clients) res.write(': ping\n\n');
	}, HEARTBEAT_MS);

	const server = createServer((req, res) => {
		const path = new URL(req.url ?? '/', 'http://localhost').pathname;
		if (req.method !== 'GET') {
			res.writeHead(405).end();
			return;
		}
		if (path === '/api/stream') {
			res.writeHead(200, {
				'content-type': 'text/event-stream; charset=utf-8',
				'cache-control': 'no-store',
				connection: 'keep-alive',
			});
			send(res, board.current());
			clients.add(res);
			req.on('close', () => clients.delete(res));
			return;
		}
		if (path === '/api/board') {
			res.writeHead(200, {
				'content-type': 'application/json; charset=utf-8',
				'cache-control': 'no-store',
			});
			res.end(JSON.stringify(loadBoard(dir)));
			return;
		}
		const f = FILES[path];
		if (!f) {
			res.writeHead(404).end();
			return;
		}
		res.writeHead(200, { 'content-type': f[1], 'cache-control': 'no-store' });
		res.end(readFileSync(join(here, f[0])));
	});
	server.on('close', () => {
		clearInterval(heartbeat);
		board.close();
		for (const res of clients) res.end();
	});
	return new Promise((ok, fail) => {
		server.once('error', fail);
		server.listen(port, '127.0.0.1', () => ok(server));
	});
}
