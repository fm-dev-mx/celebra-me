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
import { WORKTREE_LANES, getLanePortForKey } from '../shared/worktree-lane.ts';

/** Lane metadata is code-owned; task locks and Git supply its live state. */
export const canonicalLanes = () =>
	WORKTREE_LANES.map((lane) => ({
		id: lane.id,
		orden: lane.key,
		tecla: `Win + F${lane.key}`,
		puerto: getLanePortForKey(lane.key),
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

export function assertId(id) {
	if (!SAFE_ID.test(String(id ?? '')) || id === '.' || id === '..')
		throw new Error(`id no válido: ${id}`);
	return id;
}

export function readCollection(dir, collection) {
	const d = join(dir, collection);
	if (!existsSync(d)) return [];
	return readdirSync(d)
		.filter((f) => f.endsWith('.json'))
		.map((f) => ({ id: f.slice(0, -5), ...JSON.parse(readFileSync(join(d, f), 'utf8')) }));
}

export function readDoc(dir, collection, id) {
	const f = join(dir, collection, `${assertId(id)}.json`);
	return existsSync(f) ? { id, ...JSON.parse(readFileSync(f, 'utf8')) } : null;
}

/** The whole board, in the shape model.mjs reads. */
export function loadBoard(dir, { since } = {}) {
	const [estado] = readCollection(dir, 'estado').filter((d) => d.id === 'actual');
	return {
		geminiRelay: readGeminiRelay(dir),
		tareas: readCollection(dir, 'tareas'),
		decisiones: readCollection(dir, 'decisiones'),
		bitacora: readLog(dir, { since }),
		carriles: canonicalLanes(),
		agentes: readCollection(dir, 'agentes'),
		archivo: readCollection(dir, 'archivo'),
		bandejas: readCollection(dir, 'bandejas'),
		estado: estado ?? null,
	};
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

/** Append one row to its day's file; the caller holds the store lock. */
export function appendLog(dir, row) {
	const d = join(dir, LOG_DIR);
	mkdirSync(d, { recursive: true });
	appendFileSync(join(d, `${row.en.slice(0, 10)}.jsonl`), `${JSON.stringify(row)}\n`);
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

/** Write through a temp file and rename, so a reader never sees half a document. */
export function writeDoc(dir, collection, id, data, { backup: keep = true } = {}) {
	const d = join(dir, collection);
	mkdirSync(d, { recursive: true });
	const rest = { ...data };
	delete rest.id;
	const f = join(d, `${assertId(id)}.json`);
	if (keep && existsSync(f)) backup(dir, collection, id, f);
	const tmp = `${f}.${process.pid}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(rest, null, '\t')}\n`);
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
