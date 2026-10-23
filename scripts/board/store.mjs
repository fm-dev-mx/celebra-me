/**
 * Local JSON store of the board (d143). One file per document: <dir>/<collection>/<id>.json, the same layout as an
 * ArtifactData export, so `pnpm board:verify` and `pnpm board import` read both.
 *
 * The store lives in the ignored `.agent/tmp/board/` of the Integration checkout, found through the Git common
 * dir, so every lane and agent shares one board. CELEBRA_BOARD_DIR overrides it (tests).
 *
 * Before a document is overwritten, its previous content is copied to
 * <dir>/.respaldos/<collection>/<id>/<time>.json; the newest BACKUPS_KEPT copies per document stay.
 */
import { execFileSync } from 'node:child_process';
import {
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
import { dirname, join, resolve } from 'node:path';

export const COLLECTIONS = [
	'tareas',
	'decisiones',
	'bitacora',
	'carriles',
	'estado',
	'agentes',
	'prompts',
];
const SAFE_ID = /^[A-Za-z0-9._~:@+-]{1,200}$/;
const LOCK_STALE_MS = 30_000;
export const BACKUP_DIR = '.respaldos';
export const BACKUPS_KEPT = 5;

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
export function loadBoard(dir) {
	const [estado] = readCollection(dir, 'estado').filter((d) => d.id === 'actual');
	return {
		tareas: readCollection(dir, 'tareas'),
		decisiones: readCollection(dir, 'decisiones'),
		bitacora: readCollection(dir, 'bitacora'),
		carriles: readCollection(dir, 'carriles'),
		agentes: readCollection(dir, 'agentes'),
		estado: estado ?? null,
	};
}

/** Write through a temp file and rename, so a reader never sees half a document. */
export function writeDoc(dir, collection, id, data) {
	const d = join(dir, collection);
	mkdirSync(d, { recursive: true });
	const rest = { ...data };
	delete rest.id;
	const f = join(d, `${assertId(id)}.json`);
	if (existsSync(f)) backup(dir, collection, id, f);
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

/** Run `fn` holding the store lock, so two agents never interleave a read-modify-write. */
export function withLock(dir, fn, { waitMs = 5000 } = {}) {
	mkdirSync(dir, { recursive: true });
	const lock = join(dir, '.lock');
	const until = Date.now() + waitMs;
	for (;;) {
		try {
			closeSync(openSync(lock, 'wx'));
			break;
		} catch (e) {
			if (e.code !== 'EEXIST') throw e;
			if (Date.now() - statSync(lock, { throwIfNoEntry: false })?.mtimeMs > LOCK_STALE_MS)
				rmSync(lock, { force: true });
			else if (Date.now() > until)
				throw new Error('el tablero está ocupado por otra escritura; reintente', {
					cause: e,
				});
			else Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
		}
	}
	try {
		return fn();
	} finally {
		rmSync(lock, { force: true });
	}
}
