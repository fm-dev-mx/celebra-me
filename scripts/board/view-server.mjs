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
function watchBoard(dir, onChange, onStatus, { settleMs, reconcileMs, watchFactory }) {
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	let last = null;
	let status = { state: 'connecting', observedAt: null };
	let timer = null;
	let watcher = null;
	const report = (state) => {
		status = {
			state,
			observedAt: state === 'live' ? new Date().toISOString() : status.observedAt,
		};
		onStatus(status);
	};
	const check = () => {
		let next;
		try {
			if (existsSync(join(dir, '.lock'))) {
				report('degraded');
				return;
			}
			next = JSON.stringify(loadBoard(dir));
			if (existsSync(join(dir, '.lock'))) {
				report('degraded');
				return;
			}
		} catch {
			report('degraded');
			return;
		}
		if (next !== last) {
			last = next;
			onChange(next);
		}
		report(watcher ? 'live' : 'degraded');
	};
	const start = () => {
		if (watcher) return;
		try {
			watcher = watchFactory(dir, { recursive: true }, (_event, file) => {
				const name = String(file ?? '');
				if (name.includes('.respaldos')) return;
				if (file && !name.endsWith('.json') && name !== '.lock') return;
				// A bounded leading debounce cannot be starved by continuous writes.
				if (!timer)
					timer = setTimeout(() => {
						timer = null;
						check();
					}, settleMs);
			});
			watcher.on('error', () => {
				watcher?.close();
				watcher = null;
				report('degraded');
			});
		} catch {
			watcher = null;
			report('degraded');
		}
	};
	start();
	check();
	const reconcile = setInterval(() => {
		start();
		check();
	}, reconcileMs);
	return {
		current: () => last,
		status: () => status,
		close: () => {
			clearTimeout(timer);
			clearInterval(reconcile);
			watcher?.close();
		},
	};
}

export function serveView(
	dir,
	port,
	{
		settleMs = SETTLE_MS,
		reconcileMs = 30_000,
		heartbeatMs = HEARTBEAT_MS,
		watchFactory = watch,
	} = {},
) {
	const clients = new Set();
	const stalled = new WeakMap();
	const send = (res, json, event) => {
		const flushed = res.write(`${event ? `event: ${event}\n` : ''}data: ${json}\n\n`);
		if (res.writableLength > 2 * 1024 * 1024) {
			res.destroy();
			return;
		}
		if (!flushed && !stalled.has(res)) {
			const timeout = setTimeout(() => res.destroy(), 5000);
			timeout.unref();
			stalled.set(res, timeout);
			const recover = () => {
				clearTimeout(timeout);
				stalled.delete(res);
				res.removeListener('drain', recover);
				res.removeListener('close', recover);
			};
			res.once('drain', recover);
			res.once('close', recover);
		}
	};
	const board = watchBoard(
		dir,
		(json) => {
			for (const res of clients) send(res, json);
		},
		(status) => {
			for (const res of clients) send(res, JSON.stringify(status), 'status');
		},
		{ settleMs, reconcileMs, watchFactory },
	);
	const heartbeat = setInterval(() => {
		for (const res of clients) send(res, JSON.stringify(board.status()), 'status');
	}, heartbeatMs);

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
			if (board.current() !== null) send(res, board.current());
			send(res, JSON.stringify(board.status()), 'status');
			clients.add(res);
			req.on('close', () => clients.delete(res));
			return;
		}
		if (path === '/api/board') {
			res.writeHead(board.status().state === 'live' ? 200 : 503, {
				'content-type': 'application/json; charset=utf-8',
				'cache-control': 'no-store',
			});
			res.end(
				board.status().state === 'live'
					? board.current()
					: JSON.stringify({ error: 'Tablero sin sincronizar' }),
			);
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
	const cleanup = () => {
		clearInterval(heartbeat);
		board.close();
		for (const res of clients) res.end();
	};
	server.on('close', cleanup);
	return new Promise((ok, fail) => {
		server.once('error', (error) => {
			cleanup();
			fail(error);
		});
		server.listen(port, '127.0.0.1', () => ok(server));
	});
}
