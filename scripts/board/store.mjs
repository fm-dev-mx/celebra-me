/**
 * Local JSON store of the board (d143). One file per document: <dir>/<collection>/<id>.json, the same layout as an
 * ArtifactData export, so `pnpm board:verify` reads both.
 *
 * The store lives in the ignored `.agent/tmp/board/` of the Integration checkout, found through the Git common
 * dir, so every lane and agent shares one board. CELEBRA_BOARD_DIR overrides it (tests).
 * The Gemini relay heartbeat lives beside the store; CELEBRA_GEMINI_RELAY_FILE overrides its path.
 *
 * The bitácora is the exception: one JSONL file per UTC day, <dir>/bitacora/<YYYY-MM-DD>.jsonl, one row per line.
 * Old one-file-per-row documents are still read until `pnpm board migrate-log` converts them.
 *
 * Before a document is overwritten, its previous content is copied to
 * <dir>/.respaldos/<collection>/<id>/<time>.json; the newest BACKUPS_KEPT copies per document stay (d185). A
 * finished task gets no new copy: its closing summary and the month's .zip already keep what it was.
 *
 * What leaves the live board goes to <dir>/mensual/<YYYY-MM>.zip (d186, d187), never to the bin.
 */
import { execFileSync } from 'node:child_process';
import {
	appendFileSync,
	closeSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { isFinished, legacyLogRow, logRowIssues } from './model.mjs';
import { WORKTREE_LANES } from '../shared/worktree-lane.ts';
import { readZip } from './zip.mjs';

/** Lane metadata is code-owned; task locks and Git supply its live state. */
export const canonicalLanes = () =>
	WORKTREE_LANES.map((lane) => ({
		id: lane.id,
		orden: lane.key ?? lane.port - 4320,
		tecla: lane.key === null ? 'sin tecla' : `Win + F${lane.key}`,
		puerto: lane.port,
		uso: lane.displayName,
	}));

export const COLLECTIONS = [
	'tareas',
	'decisiones',
	'bitacora',
	'estado',
	'agentes',
	'archivo',
	'prompts',
	'bandejas',
];
const SAFE_ID = /^[A-Za-z0-9._~:@+-]{1,200}$/;
export const BACKUP_DIR = '.respaldos';
export const BACKUPS_KEPT = 2;
export const MONTHLY_DIR = 'mensual';

/** The month's .zip file, `month` as YYYY-MM. */
export const monthlyZip = (dir, month) => join(dir, MONTHLY_DIR, `${month}.zip`);

export function boardDir(cwd = process.cwd()) {
	if (process.env.CELEBRA_BOARD_DIR) return resolve(cwd, process.env.CELEBRA_BOARD_DIR);
	const common = execFileSync(
		'git',
		['rev-parse', '--path-format=absolute', '--git-common-dir'],
		{
			cwd,
			encoding: 'utf8',
		},
	).trim();
	return join(dirname(common), '.agent', 'tmp', 'board');
}

/** Heartbeat shares the Integration store location; tests may override the file directly. */
export function geminiRelayPath(dir) {
	return process.env.CELEBRA_GEMINI_RELAY_FILE
		? resolve(process.env.CELEBRA_GEMINI_RELAY_FILE)
		: join(dirname(dir), 'gemini-relay.json');
}

function readGeminiRelay(dir) {
	try {
		const { at } = JSON.parse(readFileSync(geminiRelayPath(dir), 'utf8'));
		return { at };
	} catch {
		return null;
	}
}

/** T477: the registered coordinator Claude session and its last turn, `{sesion, at}`, written by session-notice.mjs. */
export const coordinatorPath = (dir) => join(dirname(dir), 'board-coordinator.json');

export function readCoordinator(dir) {
	try {
		const { sesion, at } = JSON.parse(readFileSync(coordinatorPath(dir), 'utf8'));
		return { sesion, at };
	} catch {
		return null;
	}
}

export function assertId(id) {
	if (!SAFE_ID.test(String(id ?? '')) || id === '.' || id === '..')
		throw new Error(`id no válido: ${id}`);
	return id;
}

/**
 * A cross review is a round inside the task it reviews (T529): its record lives in the parent's `rondas`, never in
 * its own file. Readers still see every round as a task `<origen>-revision(-N)` with `ronda: true`, so the review
 * logic reads one shape for embedded and legacy rounds. Collections that hold tasks expand them.
 */
export const ROUND_ID = /^(.+)-revision(?:-([1-9]\d*))?$/;
const TASK_COLLECTIONS = new Set(['tareas', 'archivo']);

const roundsOf = (parent) =>
	(Array.isArray(parent.rondas) ? parent.rondas : []).map((r) => ({
		...(parent.archivada && !r.archivada ? { archivada: parent.archivada } : {}),
		...r,
		origen: parent.id,
		ronda: true,
	}));

function withoutRounds(doc) {
	const rest = { ...doc };
	delete rest.rondas;
	return rest;
}

const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

export function readCollection(dir, collection) {
	const d = join(dir, collection);
	if (!existsSync(d)) return [];
	const docs = readdirSync(d)
		.filter((f) => f.endsWith('.json'))
		.map((f) => ({ id: f.slice(0, -5), ...readJson(join(d, f)) }));
	return TASK_COLLECTIONS.has(collection) ? expandRounds(docs) : docs;
}

/** T529: task docs as read from disk, each followed by the review rounds kept in its `rondas`. */
export const expandRounds = (docs) => docs.flatMap((doc) => [withoutRounds(doc), ...roundsOf(doc)]);

export function readDoc(dir, collection, id) {
	const f = join(dir, collection, `${assertId(id)}.json`);
	if (existsSync(f)) {
		const doc = { id, ...readJson(f) };
		return TASK_COLLECTIONS.has(collection) ? withoutRounds(doc) : doc;
	}
	const parent = TASK_COLLECTIONS.has(collection) && roundParent(dir, collection, id);
	return parent ? (roundsOf(parent).find((r) => r.id === id) ?? null) : null;
}

/** The parent document whose `rondas` would hold round `id`, read from its own file; null when there is none. */
function roundParent(dir, collection, id) {
	const m = ROUND_ID.exec(id);
	if (!m) return null;
	const f = join(dir, collection, `${assertId(m[1])}.json`);
	return existsSync(f) ? { id: m[1], ...readJson(f) } : null;
}

/** The whole board, in the shape model.mjs reads. */
export function loadBoard(dir, { since } = {}) {
	const [estado] = readCollection(dir, 'estado').filter((d) => d.id === 'actual');
	const tareas = readCollection(dir, 'tareas');
	const archivo = readCollection(dir, 'archivo');
	const archivoZip = zipOnlyTasks(dir, tareas, archivo);
	return {
		geminiRelay: readGeminiRelay(dir),
		coordinador: readCoordinator(dir),
		tareas,
		decisiones: readCollection(dir, 'decisiones'),
		bitacora: readLog(dir, { since }),
		carriles: canonicalLanes(),
		agentes: readCollection(dir, 'agentes'),
		archivo,
		...(archivoZip.length ? { archivoZip } : {}),
		bandejas: readCollection(dir, 'bandejas'),
		estado: estado ?? null,
	};
}

const zipCache = new Map();

/** Every task kept whole in one monthly .zip, read once per file version. */
function zipTasks(file) {
	const st = statSync(file);
	const key = `${st.mtimeMs}:${st.size}`;
	const hit = zipCache.get(file);
	if (hit?.key === key) return hit.tasks;
	const tasks = new Map();
	for (const e of readZip(file)) {
		const m = /^tareas\/(.+)\.json$/.exec(e.name);
		if (!m) continue;
		try {
			tasks.set(m[1], JSON.parse(e.data.toString('utf8')));
		} catch {
			// One unreadable entry does not hide the rest of the month.
		}
	}
	zipCache.set(file, { key, tasks });
	return tasks;
}

/**
 * A tarea or revision requisito, a padre or a deriva, whose task is in neither tareas/ nor archivo/ (its small record
 * lost, or the task only kept in a monthly .zip) is looked up in mensual/*.zip, newest first; the zip opens only when
 * such a ref exists. A short record per hit, so `requisitos()` reads it as archived.
 */
export function zipOnlyTasks(dir, tareas, archivo) {
	const known = new Set([...tareas, ...archivo].map((t) => t.id));
	const missing = new Set(
		tareas.flatMap((t) =>
			(t.requisitos ?? [])
				.filter((r) => ['tarea', 'revision'].includes(r.tipo) && r.ref)
				.map((r) => r.ref)
				.concat(t.padre ? [t.padre] : [], t.deriva ? [t.deriva] : [])
				.filter((ref) => !known.has(ref)),
		),
	);
	const d = join(dir, MONTHLY_DIR);
	if (!missing.size || !existsSync(d)) return [];
	const found = [];
	const months = readdirSync(d).filter((f) => /^\d{4}-\d{2}\.zip$/.test(f));
	for (const f of months.sort().reverse()) {
		let tasks;
		try {
			tasks = zipTasks(join(d, f));
		} catch {
			continue;
		}
		for (const id of missing) {
			const t = tasks.get(id);
			if (!t) continue;
			missing.delete(id);
			const keep = ['num', 'titulo', 'estado', 'pr', 'archivada'].filter(
				(k) => t[k] !== undefined,
			);
			found.push({
				id,
				...Object.fromEntries(keep.map((k) => [k, t[k]])),
				zip: `${MONTHLY_DIR}/${f}`,
			});
		}
	}
	return found;
}

export const LOG_DIR = 'bitacora';
const LOG_FILE = /^\d{4}-\d{2}-\d{2}\.jsonl$/;

/** Every bitácora row: the daily JSONL files, then any old one-file-per-row document not converted yet. */
export function readLog(dir, { since } = {}) {
	const d = join(dir, LOG_DIR);
	if (!existsSync(d)) return [];
	const files = readdirSync(d).sort();
	const rows = files
		.filter(
			(f) =>
				LOG_FILE.test(f) &&
				(since === undefined ||
					f.slice(0, 10) >= new Date(since).toISOString().slice(0, 10)),
		)
		.flatMap((f) =>
			readFileSync(join(d, f), 'utf8')
				.split('\n')
				.filter((line) => line.trim())
				.map((line) => JSON.parse(line)),
		);
	return [...rows, ...readCollection(dir, LOG_DIR)].filter(
		(r) => since === undefined || Date.parse(r.en) >= since,
	);
}

/** Transport recorded on each row: `cli` unless the MCP adapter or the watcher sets its own. */
export const LOG_VIAS = ['cli', 'mcp', 'watch'];

/** Append one row to its day's file; the caller holds the store lock. */
export function appendLog(dir, row) {
	const d = join(dir, LOG_DIR);
	mkdirSync(d, { recursive: true });
	const via = process.env.CELEBRA_BOARD_VIA || 'cli';
	const out = LOG_VIAS.includes(via) && row.via === undefined ? { ...row, via } : row;
	appendFileSync(join(d, `${row.en.slice(0, 10)}.jsonl`), `${JSON.stringify(out)}\n`);
}

/**
 * `pnpm board migrate-log`: every old one-file-per-row document becomes a line of its day's JSONL file (via
 * legacyLogRow), then the old files move to <dir>/.respaldos/bitacora-legado/<time>/; nothing is deleted. The
 * move happens only when the daily files hold every converted row. `dryRun` counts and writes nothing.
 */
export function migrateLegacyLog(dir, { dryRun = false } = {}) {
	const d = join(dir, LOG_DIR);
	const old = existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.json')) : [];
	const rows = old.map((f) => legacyLogRow(JSON.parse(readFileSync(join(d, f), 'utf8')), f));
	const days = {};
	for (const r of rows.sort((x, y) => Date.parse(x.en) - Date.parse(y.en)))
		(days[String(r.en).slice(0, 10)] ??= []).push(r);
	const report = {
		filas: rows.length,
		dias: Object.keys(days).sort(),
		sinQuien: rows.filter((r) => !r.quien).length,
		agente: rows.filter((r) => r.agente).length,
		carril: rows.filter((r) => r.carril).length,
		problemas: rows.flatMap((r) => logRowIssues(r).map((msg) => `${r.archivo}: ${msg}`)),
	};
	if (dryRun || !rows.length) return { ...report, escrito: false };
	if (report.problemas.length || report.dias.some((day) => !/^\d{4}-\d{2}-\d{2}$/.test(day)))
		throw new Error(
			`no se convirtió la bitácora: ${report.problemas.join('; ') || 'fila sin fecha'}`,
		);
	// Daily-file rows before and after the append; the old files are still in place both times.
	const before = readLog(dir).length - old.length;
	for (const [day, list] of Object.entries(days))
		appendFileSync(join(d, `${day}.jsonl`), list.map((r) => `${JSON.stringify(r)}\n`).join(''));
	if (readLog(dir).length - old.length !== before + rows.length)
		throw new Error(
			'la bitácora convertida no tiene todas las filas; los archivos viejos siguen en su lugar',
		);
	const keep = join(
		dir,
		BACKUP_DIR,
		'bitacora-legado',
		new Date().toISOString().replace(/[-:.]/g, ''),
	);
	mkdirSync(keep, { recursive: true });
	for (const f of old) renameSync(join(d, f), join(keep, f));
	return { ...report, escrito: true, respaldo: keep };
}

/** What `pnpm board migrate-log` prints for a migrateLegacyLog report. */
export function migrateLogLines(r) {
	return [
		`${r.escrito ? 'Convertidas' : 'Se convertirían'} ${r.filas} filas en ${r.dias.length} archivos por día.`,
		`Sin quién (quedan con legado y quienTexto): ${r.sinQuien}. Cambios de agente: ${r.agente}. De carril: ${r.carril}.`,
		...r.problemas.map((p) => `Problema: ${p}`),
		...(r.respaldo ? [`Archivos viejos en ${r.respaldo}`] : []),
	];
}

/**
 * Write through a temp file and rename, so a reader never sees half a document. A task document keeps the rounds
 * already on disk (T529): only a round write changes them. A `ronda` task with no file of its own is written into
 * its parent's `rondas`, ordered by `vuelta`; without a parent it is refused (T543).
 */
export function writeDoc(dir, collection, id, data, { backup: keep = true } = {}) {
	const d = join(dir, collection);
	mkdirSync(d, { recursive: true });
	const f = join(d, `${assertId(id)}.json`);
	if (TASK_COLLECTIONS.has(collection) && data.ronda && !existsSync(f)) {
		const parent = roundParent(dir, collection, id);
		if (parent) return writeRound(dir, collection, parent, id, data, { keep });
		// T543: a new round never becomes a task file of its own.
		throw new Error(`${id} es una ronda de revisión sin tarea en ${collection}`);
	}
	const rest = { ...data };
	delete rest.id;
	if (TASK_COLLECTIONS.has(collection)) {
		delete rest.rondas;
		const kept = existsSync(f) ? readJson(f).rondas : data.rondas;
		if (Array.isArray(kept) && kept.length) rest.rondas = kept;
	}
	if (keep && existsSync(f)) backup(dir, collection, id, f);
	writeAtomic(f, rest);
}

const byVuelta = (a, b) => (a.vuelta ?? 0) - (b.vuelta ?? 0);

/** A round as `rondas` keeps it: its parent and flag come back from where it lives. */
function asRound(data, id) {
	const round = { ...data, id };
	delete round.origen;
	delete round.ronda;
	return round;
}

function writeRound(dir, collection, parent, id, data, { keep }) {
	const round = asRound(data, id);
	const others = (parent.rondas ?? []).filter((r) => r.id !== id);
	const rondas = [...others, round].sort(byVuelta);
	const f = join(dir, collection, `${parent.id}.json`);
	if (keep) backup(dir, collection, parent.id, f);
	const rest = { ...parent, rondas };
	delete rest.id;
	writeAtomic(f, rest);
}

/**
 * T543: the review rounds of task `id` that still have a file of their own (`<id>-revision(-N).json`, from before
 * T529), with `aplicar` moved into its `rondas` as written (`num` included, so its T<n> still resolves), each file
 * backed up first. Returns the ids found.
 */
export function embedLegacyRounds(dir, collection, id, { aplicar = true } = {}) {
	const d = join(dir, collection);
	const parentFile = join(d, `${assertId(id)}.json`);
	if (!TASK_COLLECTIONS.has(collection) || !existsSync(parentFile)) return [];
	const legacy = readdirSync(d)
		.filter((f) => f.endsWith('.json') && ROUND_ID.exec(f.slice(0, -5))?.[1] === id)
		.map((f) => f.slice(0, -5))
		// A task merely named `<id>-revision` is not a round: only one that names `id` as its origen moves in.
		.filter((rid) => readJson(join(d, `${rid}.json`)).origen === id);
	if (!aplicar || !legacy.length) return legacy;
	const parent = readJson(parentFile);
	const moved = legacy.map((rid) => asRound(readJson(join(d, `${rid}.json`)), rid));
	const kept = (parent.rondas ?? []).filter((r) => !legacy.includes(r.id));
	backup(dir, collection, id, parentFile);
	writeAtomic(parentFile, { ...parent, rondas: [...kept, ...moved].sort(byVuelta) });
	for (const rid of legacy) {
		const f = join(d, `${rid}.json`);
		backup(dir, collection, rid, f);
		rmSync(f);
	}
	return legacy;
}

function writeAtomic(f, doc) {
	const tmp = `${f}.${process.pid}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(doc, null, '\t')}\n`);
	renameSync(tmp, f);
}

/** Keep the previous version of a document, rotating out all but the newest BACKUPS_KEPT copies. */
function backup(dir, collection, id, file) {
	const d = join(dir, BACKUP_DIR, collection, id);
	mkdirSync(d, { recursive: true });
	const stamp = new Date().toISOString().replace(/[-:.]/g, '');
	let name = `${stamp}.json`;
	for (let i = 2; existsSync(join(d, name)); i++) name = `${stamp}-${i}.json`;
	copyFileSync(file, join(d, name));
	const copies = readdirSync(d)
		.filter((n) => n.endsWith('.json'))
		.sort();
	for (const old of copies.slice(0, -BACKUPS_KEPT)) rmSync(join(d, old), { force: true });
}

/**
 * Backup copies `pnpm board prune-backups` removes (d185): all but the newest BACKUPS_KEPT per document, and
 * every copy of a task that is finished or no longer in tareas/. Paths are relative to the board directory.
 */
export function surplusBackups(dir) {
	const root = join(dir, BACKUP_DIR);
	const open = new Set(
		readCollection(dir, 'tareas')
			.filter((t) => !isFinished(t))
			.map((t) => t.id),
	);
	const out = [];
	for (const collection of COLLECTIONS.filter((c) => existsSync(join(root, c))))
		for (const id of readdirSync(join(root, collection))) {
			const d = join(root, collection, id);
			const copies = readdirSync(d)
				.filter((n) => n.endsWith('.json'))
				.sort();
			const drop =
				collection === 'tareas' && !open.has(id) ? copies : copies.slice(0, -BACKUPS_KEPT);
			for (const name of drop) {
				const file = join(d, name);
				out.push({
					archivo: relative(dir, file).split(sep).join('/'),
					bytes: statSync(file).size,
				});
			}
		}
	return out;
}

/** Remove the surplus copies (and the folders they leave empty); `aplicar: false` only lists them. */
export function pruneBackups(dir, { aplicar = false } = {}) {
	const sobran = surplusBackups(dir);
	if (aplicar)
		for (const { archivo } of sobran) {
			const file = join(dir, archivo);
			rmSync(file, { force: true });
			if (!readdirSync(dirname(file)).length) rmSync(dirname(file), { recursive: true });
		}
	return { sobran, bytes: sobran.reduce((n, x) => n + x.bytes, 0), aplicado: aplicar };
}

/** Run `fn` holding the store lock, so two agents never interleave a read-modify-write. */
export function withLock(dir, fn, { waitMs = 5000 } = {}) {
	mkdirSync(dir, { recursive: true });
	const lock = join(dir, '.lock');
	const until = Date.now() + waitMs;
	for (;;) {
		try {
			const fd = openSync(lock, 'wx');
			try {
				writeFileSync(
					fd,
					JSON.stringify({ pid: process.pid, desde: new Date().toISOString() }),
				);
			} finally {
				closeSync(fd);
			}
			break;
		} catch (e) {
			if (e.code !== 'EEXIST') throw e;
			if (Date.now() > until)
				throw new Error(
					'el tablero está ocupado; reintente. Si el escritor terminó, el coordinador debe inspeccionar el candado antes de recuperarlo.',
					{
						cause: e,
					},
				);
			else Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
		}
	}
	try {
		return fn();
	} finally {
		rmSync(lock, { force: true });
	}
}
