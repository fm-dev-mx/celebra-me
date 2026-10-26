/**
 * Local server for the board view: the page, the shared model and the board as JSON.
 * `/api/stream` pushes the board as Server-Sent Events whenever a file in the store changes, so the page
 * shows a write in under a second; `/api/board` stays for one-off reads.
 *
 * Three writes, all only from this same page on 127.0.0.1: `POST /api/archivar` (d167) archives or unarchives a
 * finished task through the `archive` option `pnpm board view` passes, `POST /api/entregada` (d249) marks a task
 * whose prompt «Copiar prompt» copied as delivered through the `deliver` option (without them the server stays
 * read-only), and `POST /api/sync` (the «Sincronizar» button) runs the no-AI `scripts/board/sync.mjs`. Any website can make
 * the browser send a request to 127.0.0.1, so every request must carry a local `Host` (DNS rebinding), and the
 * sync POST must also come from the page's own `Origin` with the per-process random token the page embeds.
 *
 * Under `view-supervisor.mjs` (d210) the token and a code `version` come from the supervisor, so they stay the
 * same across worker swaps; the stream announces the version and the page reloads itself when it changes.
 */
import { execFile } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBoard } from './store.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FILES = {
	'/': ['view.html', 'text/html; charset=utf-8'],
	'/model.mjs': ['model.mjs', 'text/javascript; charset=utf-8'],
	'/prompt.mjs': ['prompt.mjs', 'text/javascript; charset=utf-8'],
	'/pr-ref.mjs': ['pr-ref.mjs', 'text/javascript; charset=utf-8'],
	'/next.mjs': ['next.mjs', 'text/javascript; charset=utf-8'],
	'/cierre.mjs': ['cierre.mjs', 'text/javascript; charset=utf-8'],
	'/format.mjs': ['format.mjs', 'text/javascript; charset=utf-8'],
	'/delivery.mjs': ['delivery.mjs', 'text/javascript; charset=utf-8'],
	'/requisito-text.mjs': ['requisito-text.mjs', 'text/javascript; charset=utf-8'],
	'/subtasks.mjs': ['subtasks.mjs', 'text/javascript; charset=utf-8'],
	'/findings.mjs': ['findings.mjs', 'text/javascript; charset=utf-8'],
	'/require-cierre.mjs': ['require-cierre.mjs', 'text/javascript; charset=utf-8'],
	'/owner-text.mjs': ['owner-text.mjs', 'text/javascript; charset=utf-8'],
	'/changelog.mjs': ['changelog.mjs', 'text/javascript; charset=utf-8'],
};
const SETTLE_MS = 150;
const HEARTBEAT_MS = 25_000;
const SYNC_TIMEOUT_MS = 120_000;
const TOKEN_SLOT = '__BOARD_TOKEN__';
const VERSION_SLOT = '__BOARD_VERSION__';
// The page reconnects one second after a worker swap ends its stream.
const RETRY_MS = 1000;
/** How often the `live` reads (Git lanes, open PRs) refresh; they ride along in the board as `vivo` (T126). */
const LIVE_MS = 60_000;

/** Runs `pnpm board:sync --json [--dry-run]` against this store and resolves its parsed report. */
export function runSyncScript(dir, { dryRun }) {
	const args = [join(here, 'sync.mjs'), '--json', ...(dryRun ? ['--dry-run'] : [])];
	return new Promise((ok, fail) => {
		execFile(
			process.execPath,
			args,
			{
				env: { ...process.env, CELEBRA_BOARD_DIR: dir },
				timeout: SYNC_TIMEOUT_MS,
				windowsHide: true,
				maxBuffer: 4 * 1024 * 1024,
			},
			(error, stdout, stderr) => {
				try {
					return ok(JSON.parse(stdout));
				} catch {
					fail(new Error(String(stderr).trim() || error?.message || 'board:sync falló'));
				}
			},
		);
	});
}

const sameToken = (a, b) => {
	const x = Buffer.from(String(a ?? ''));
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
};

function readJson(req, limit = 1024) {
	return new Promise((ok, fail) => {
		let body = '';
		req.on('data', (c) => {
			body += c;
			if (body.length > limit) {
				fail(new Error('too large'));
				req.destroy();
			}
		});
		req.on('end', () => {
			try {
				ok(JSON.parse(body || '{}'));
			} catch (e) {
				fail(e);
			}
		});
		req.on('error', fail);
	});
}

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

/**
 * A same-origin JSON write: `handle(input)` answers `[status, body]`; `denied` is the 403 text, a body that is
 * not JSON a 400 and a throw a 500.
 */
function writeRequest(req, res, denied, handle) {
	if (!sameOrigin(req)) {
		req.resume();
		return json(res, 403, { error: denied });
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
		try {
			json(res, ...handle(input));
		} catch (e) {
			json(res, 500, { error: String(e.message ?? e) });
		}
	});
}

/** `archive(id, archivar, opts)` answers `{ task }` or `{ error }` for a refused write, and throws otherwise. */
function archiveRequest(archive, req, res) {
	writeRequest(req, res, 'Solo se archiva desde esta página en 127.0.0.1.', (input) => {
		if (typeof input?.id !== 'string' || typeof input.archivar !== 'boolean')
			return [400, { error: 'Falta id o archivar.' }];
		const { task: t, error } = archive(input.id, input.archivar, {
			rev: input.rev === undefined ? undefined : String(input.rev),
			quien: 'dueño',
			corrio: input.archivar ? 'Archivar en la página' : 'Desarchivar en la página',
		});
		if (error) return [409, { error }];
		return [200, { id: t.id, rev: t.rev, archivada: t.archivada ?? null }];
	});
}

/** `deliver(id, agente, opts)` answers like `archive`: the owner copied the prompt to paste it into `agente`. */
function deliverRequest(deliver, req, res) {
	writeRequest(req, res, 'Solo se marca desde esta página en 127.0.0.1.', (input) => {
		if (typeof input?.id !== 'string' || typeof input.agente !== 'string')
			return [400, { error: 'Falta id o agente.' }];
		const { task: t, error } = deliver(input.id, input.agente, {
			quien: 'dueño',
			corrio: 'Copiar prompt en la página',
		});
		if (error) return [409, { error }];
		return [200, { id: t.id, rev: t.rev, entregada: t.entregada }];
	});
}

/**
 * Calls `onChange(json)` once a burst of writes settles and the board really changed; `extra()` adds fields
 * that do not live in the store (the `vivo` reads).
 */
function watchBoard(dir, onChange, onStatus, { settleMs, reconcileMs, watchFactory, extra }) {
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
			next = JSON.stringify({ ...loadBoard(dir), ...extra() });
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
				// .jsonl: a bitácora row, such as a message (T126), shows without waiting for reconciliation.
				if (file && !/\.jsonl?$/.test(name) && name !== '.lock') return;
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
		check,
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
		sync = (opts) => runSyncScript(dir, opts),
		archive,
		deliver,
		live,
		liveMs = LIVE_MS,
		token = randomBytes(32).toString('hex'),
		version = 'dev',
	} = {},
) {
	let syncing = false;
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
	// T126: `live(board)` resolves `{carriles, prs, en}` from Git and GitHub; the last answer rides in `vivo`.
	let vivo;
	const board = watchBoard(
		dir,
		(json) => {
			for (const res of clients) send(res, json);
		},
		(status) => {
			for (const res of clients) send(res, JSON.stringify(status), 'status');
		},
		{ settleMs, reconcileMs, watchFactory, extra: () => (vivo ? { vivo } : {}) },
	);
	let reading = false;
	const readLive = async () => {
		if (!live || reading) return;
		reading = true;
		try {
			vivo = await live(loadBoard(dir));
			board.check();
		} catch {
			// The page keeps the previous reads; the hand-written lane records still show.
		} finally {
			reading = false;
		}
	};
	readLive();
	const liveTimer = live ? setInterval(readLive, liveMs) : null;
	const heartbeat = setInterval(() => {
		for (const res of clients) send(res, JSON.stringify(board.status()), 'status');
	}, heartbeatMs);

	const localHosts = () => {
		const { port } = server.address();
		return [`127.0.0.1:${port}`, `localhost:${port}`];
	};

	const handleSync = async (req, res) => {
		const hosts = localHosts();
		if (
			!hosts.some((h) => req.headers.origin === `http://${h}`) ||
			!sameToken(req.headers['x-board-token'], token) ||
			!String(req.headers['content-type'] ?? '').startsWith('application/json')
		)
			return json(res, 403, { error: 'Solicitud no autorizada' });
		let body;
		try {
			body = await readJson(req);
		} catch {
			return json(res, 400, { error: 'Cuerpo no válido' });
		}
		if (syncing) return json(res, 409, { error: 'Ya hay una sincronización en curso' });
		syncing = true;
		try {
			json(res, 200, await sync({ dryRun: body.dryRun === true }));
		} catch (e) {
			json(res, 500, { error: e.message });
		} finally {
			syncing = false;
		}
	};

	const server = createServer((req, res) => {
		const path = new URL(req.url ?? '/', 'http://localhost').pathname;
		if (!localHosts().includes(String(req.headers.host ?? ''))) {
			res.writeHead(421).end();
			return;
		}
		if (req.method === 'POST' && path === '/api/sync') {
			handleSync(req, res);
			return;
		}
		if (archive && req.method === 'POST' && path === '/api/archivar') {
			archiveRequest(archive, req, res);
			return;
		}
		if (deliver && req.method === 'POST' && path === '/api/entregada') {
			deliverRequest(deliver, req, res);
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
			res.write(`retry: ${RETRY_MS}

`);
			send(res, JSON.stringify({ version }), 'version');
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
		const content = readFileSync(join(here, f[0]), 'utf8');
		res.end(
			path === '/'
				? content.replace(TOKEN_SLOT, token).replace(VERSION_SLOT, version)
				: content,
		);
	});
	let cleaned = false;
	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		clearInterval(heartbeat);
		clearInterval(liveTimer);
		board.close();
		for (const res of clients) res.end();
	};
	server.on('close', cleanup);
	/** Stops taking requests and ends the live streams; 'close' follows once the last request is answered. */
	server.drain = () => {
		cleanup();
		server.close();
		server.closeIdleConnections();
		// An ended stream leaves its keep-alive socket idle only after the response flushes.
		setTimeout(() => server.closeIdleConnections(), 100).unref();
	};
	return new Promise((ok, fail) => {
		server.once('error', (error) => {
			cleanup();
			fail(error);
		});
		server.listen(port, '127.0.0.1', () => ok(server));
	});
}
