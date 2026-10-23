/**
 * Local server for the board view: the page, the shared model and the board as JSON.
 * `/api/stream` pushes the board as Server-Sent Events whenever a file in the store changes, so the page
 * shows a write in under a second; `/api/board` stays for one-off reads.
 * Its only write is `POST /api/archivar` (d167): archive or unarchive a finished task, accepted only from
 * this same page on 127.0.0.1, through the `archive` option `pnpm board view` passes (the function behind
 * `pnpm board archive`). Without that option the server stays read-only.
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
const LOOPBACK = new Set(['127.0.0.1', '::ffff:127.0.0.1']);
const MAX_BODY = 4096;

/**
 * A write must come from this page: loopback socket, Host and Origin equal to this server's own
 * 127.0.0.1 address (no other site, no DNS rebinding) and a JSON body, which a plain cross-site form
 * cannot send without a preflight this server never answers.
 */
function sameOrigin(req) {
	const own = `127.0.0.1:${req.socket.localPort}`;
	const site = req.headers['sec-fetch-site'];
	return (
		LOOPBACK.has(req.socket.remoteAddress) &&
		req.headers.host === own &&
		req.headers.origin === `http://${own}` &&
		(site === undefined || site === 'same-origin') &&
		/^application\/json\b/i.test(req.headers['content-type'] ?? '')
	);
}

function json(res, status, body) {
	res.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		'cache-control': 'no-store',
	});
	res.end(JSON.stringify(body));
}

/** `archive(id, archivar, opts)` answers `{ task }` or `{ error }` for a refused write, and throws otherwise. */
function archiveRequest(archive, req, res) {
	if (!sameOrigin(req)) {
		req.resume();
		return json(res, 403, { error: 'Solo se archiva desde esta página en 127.0.0.1.' });
	}
	let body = '';
	req.setEncoding('utf8');
	req.on('data', (chunk) => {
		body += chunk;
		if (body.length > MAX_BODY) req.destroy();
	});
	req.on('end', () => {
		let input;
		try {
			input = JSON.parse(body);
		} catch {
			return json(res, 400, { error: 'Petición no válida.' });
		}
		if (typeof input?.id !== 'string' || typeof input.archivar !== 'boolean')
			return json(res, 400, { error: 'Falta id o archivar.' });
		try {
			const { task: t, error } = archive(input.id, input.archivar, {
				rev: input.rev === undefined ? undefined : String(input.rev),
				quien: 'dueño',
				corrio: input.archivar ? 'Archivar en la página' : 'Desarchivar en la página',
			});
			if (error) return json(res, 409, { error });
			json(res, 200, { id: t.id, rev: t.rev, archivada: t.archivada ?? null });
		} catch (e) {
			json(res, 500, { error: String(e.message ?? e) });
		}
	});
}

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
		archive,
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
		if (archive && req.method === 'POST' && path === '/api/archivar') {
			archiveRequest(archive, req, res);
			return;
		}
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
