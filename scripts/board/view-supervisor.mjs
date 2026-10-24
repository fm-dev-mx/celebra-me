/**
 * Keeps the board view's port open while its code changes (d210). This primary process never serves a
 * request: it owns the listening socket through `node:cluster` and runs one worker (`view-worker.mjs`)
 * that does. When a watched file changes (a `git pull` in Integration), it starts a new worker on the
 * same port, waits until that worker listens, and only then asks the old one to drain and exit. A new
 * worker that fails to start leaves the old one serving. No session restarts the board by hand.
 *
 * Every worker gets the same random token (the «Sincronizar» button keeps working across swaps) and a
 * `version` hash of the watched files, which the page compares to reload itself when the code changed.
 */
import cluster from 'node:cluster';
import { createHash, randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CODE = /\.(mjs|ts|html)$/;
const SETTLE_MS = 400;
const RECONCILE_MS = 30_000;
// Long enough for a running «Sincronizar» (120 s) to answer before the old worker is killed.
const DRAIN_MS = 125_000;
const RETRY_MS = 2_000;

/** Hash of every code file in `dirs`: equal hashes mean the running worker already has this code. */
export function codeVersion(dirs) {
	const hash = createHash('sha256');
	for (const dir of dirs) {
		let names;
		try {
			names = readdirSync(dir)
				.filter((n) => CODE.test(n))
				.sort();
		} catch {
			continue;
		}
		for (const name of names) {
			try {
				hash.update(`${dir}/${name}\0`)
					.update(readFileSync(join(dir, name)))
					.update('\0');
			} catch {
				// A file a pull is replacing right now: the next settle sees it.
			}
		}
	}
	return hash.digest('hex').slice(0, 16);
}

/**
 * Resolves `{ port, version, reload, close }` once the first worker listens.
 * `env` reaches every worker; `log` gets one line per swap or failure.
 */
export function superviseView({
	port,
	exec = join(here, 'view-worker.mjs'),
	watchDirs = [here, join(here, '..', 'shared')],
	env = {},
	settleMs = SETTLE_MS,
	reconcileMs = RECONCILE_MS,
	drainMs = DRAIN_MS,
	retryMs = RETRY_MS,
	log = () => {},
} = {}) {
	if (!cluster.isPrimary) throw new Error('superviseView runs only in the primary process');
	// Workers accept from one shared socket (the Windows default). Round-robin, the Linux default, can
	// hand a connection to a draining worker, and that request then never gets an answer.
	cluster.schedulingPolicy = cluster.SCHED_NONE;
	// No inherited execArgv: a primary started with `-e` would make each worker run that script again.
	cluster.setupPrimary({ exec, args: [], execArgv: [], silent: false, windowsHide: true });
	const token = randomBytes(32).toString('hex');
	let current = null;
	let version = null;
	let starting = null;
	let pending = false;
	let closed = false;
	let timer = null;

	/** Starts one worker; resolves it once it listens, or null if it exits first. */
	const start = (next) =>
		new Promise((ok) => {
			const worker = cluster.fork({
				...env,
				BOARD_VIEW_PORT: String(port),
				BOARD_VIEW_TOKEN: token,
				BOARD_VIEW_VERSION: next,
			});
			const done = (value) => {
				worker.removeListener('listening', listening);
				worker.removeListener('exit', exited);
				ok(value);
			};
			const listening = () => done(worker);
			const exited = () => done(null);
			worker.once('listening', listening);
			worker.once('exit', exited);
		});

	const retire = (worker) => {
		if (!worker || worker.isDead()) return;
		const kill = setTimeout(() => worker.process.kill(), drainMs);
		kill.unref();
		worker.once('exit', () => clearTimeout(kill));
		worker.send('drain');
	};

	const watchCurrent = (worker) => {
		worker.once('exit', () => {
			if (closed || worker !== current) return;
			// The serving worker died on its own: replace it right away.
			current = null;
			log('El tablero se detuvo; arrancando de nuevo.');
			setTimeout(reload, retryMs).unref();
		});
	};

	/** Swaps in a worker with the code on disk; a burst of calls runs at most one more swap. */
	async function reload() {
		if (closed) return;
		if (starting) {
			pending = true;
			return starting;
		}
		const next = codeVersion(watchDirs);
		if (current && next === version) return;
		starting = (async () => {
			const worker = await start(next);
			if (closed) {
				worker?.process.kill();
				return;
			}
			if (!worker) {
				log(
					`El código nuevo del tablero no arrancó (${next}); sigue la versión ${version}.`,
				);
				if (!current) setTimeout(reload, retryMs).unref();
				return;
			}
			const old = current;
			current = worker;
			const from = version;
			version = next;
			watchCurrent(worker);
			retire(old);
			if (old) log(`Tablero actualizado: ${from} → ${next}.`);
		})();
		try {
			await starting;
		} finally {
			starting = null;
		}
		if (pending) {
			pending = false;
			await reload();
		}
	}

	const schedule = () => {
		if (!timer)
			timer = setTimeout(() => {
				timer = null;
				reload();
			}, settleMs);
	};
	const watchers = [];
	for (const dir of watchDirs) {
		try {
			const w = watch(dir, (_event, file) => {
				if (!file || CODE.test(String(file))) schedule();
			});
			w.on('error', () => {});
			watchers.push(w);
		} catch {
			// The periodic check below still picks up changes.
		}
	}
	const reconcile = setInterval(schedule, reconcileMs);

	const close = () => {
		closed = true;
		clearTimeout(timer);
		clearInterval(reconcile);
		for (const w of watchers) w.close();
		for (const worker of Object.values(cluster.workers ?? {})) worker?.process.kill();
	};

	return (async () => {
		await reload();
		if (!current) {
			close();
			throw new Error(`El tablero no pudo arrancar en el puerto ${port}.`);
		}
		return { port, version: () => version, reload, close };
	})();
}
