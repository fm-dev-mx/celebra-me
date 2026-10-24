/**
 * `pnpm board sesiones` (d211): the Codex and Gemini chats the coordinator cannot see, crossed with the board so the
 * owner knows which ones to archive by hand. Both stores are opened read-only and never waited on: a missing or busy
 * store is reported as «no disponible» and the other one still answers.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { FINALIZADOS } from './model.mjs';

export const SOURCES = {
	codex: { label: 'Codex', path: (home) => join(home, '.codex', 'state_5.sqlite') },
	gemini: {
		label: 'Gemini',
		path: (home) => join(home, '.gemini', 'antigravity', 'conversation_summaries.db'),
	},
};

/** Only chats a person or an agent opened; guardian reviews and subagents are not owner-facing. */
const CODEX_SQL = `select coalesce(name, title) as titulo, cwd as carpeta, archived as archivado,
	updated_at_ms as en from threads where thread_source in ('user', 'agent_created_thread')`;
/** One row per conversation: the full-text index keeps several chunks of each, any of them may carry the flag. */
const GEMINI_SQL = `select s.title as titulo, s.workspace_uris as carpeta, s.last_modified_time as en,
	coalesce((select max(f.archived) from conversations_fts f where f.conversation_id = s.conversation_id), 0)
	as archivado from conversation_summaries s`;

const PROJECT = /celebra-me/i;
const DISPATCHER = /Despachador (Codex|Gemini)/i;
const TASK_NUM = /\bT(\d+)\b/;
const TITLE_MAX = 90;

/** Codex falls back to the first prompt as a title: keep its first line, short enough for one row. */
export function shortTitle(v) {
	const line = String(v ?? '')
		.trim()
		.split(/\r?\n/)[0]
		.trim();
	if (!line) return '(sin título)';
	return line.length > TITLE_MAX ? `${line.slice(0, TITLE_MAX - 1)}…` : line;
}

/** Gemini stores `2026-10-24 18:02:10.6878704+00:00`; Codex stores epoch milliseconds. */
export function toMs(v) {
	if (typeof v === 'number') return v;
	const iso = String(v ?? '')
		.replace(' ', 'T')
		.replace(/(\.\d{3})\d+/, '$1');
	const ms = Date.parse(iso);
	return Number.isNaN(ms) ? 0 : ms;
}

function decoded(v) {
	try {
		return decodeURIComponent(String(v ?? ''));
	} catch {
		return String(v ?? '');
	}
}

async function readSource(key, home) {
	const file = SOURCES[key].path(home);
	if (!existsSync(file)) return { error: 'no existe' };
	let db;
	try {
		const { DatabaseSync } = await import('node:sqlite');
		// timeout 0: a locked store answers SQLITE_BUSY at once instead of making the command wait.
		db = new DatabaseSync(file, { readOnly: true, timeout: 0 });
		const rows = db.prepare(key === 'codex' ? CODEX_SQL : GEMINI_SQL).all();
		return {
			rows: rows
				.filter((r) => PROJECT.test(decoded(r.carpeta)))
				.map((r) => ({
					titulo: shortTitle(r.titulo),
					archivado: Number(r.archivado) === 1,
					en: toMs(r.en),
				})),
		};
	} catch (e) {
		return { error: String(e?.message ?? e).split('\n')[0] };
	} finally {
		db?.close();
	}
}

/** The board task a chat title names (`T118`), live or compacted into `archivo`. */
function taskOf(titulo, board) {
	const m = TASK_NUM.exec(titulo);
	if (!m) return null;
	const n = Number(m[1]);
	const t = [...board.tareas, ...board.archivo].find((x) => Number(x.num) === n);
	if (!t) return { tag: `T${n}`, estado: null };
	return { tag: `T${n}`, estado: t.archivada ? 'archivada' : (t.estado ?? 'pendiente') };
}

const DONE = new Set([...FINALIZADOS, 'archivada']);

/** What the owner does with one open chat. */
function verdict(tarea) {
	if (!tarea) return 'sin tarea';
	if (!tarea.estado) return 'no está en el tablero';
	return DONE.has(tarea.estado) ? 'archivar' : 'dejar';
}

/** Open chats per source with their verdict; the dispatcher's runs fold into one line each. */
export function crossChats(key, rows, board) {
	const fuente = SOURCES[key].label;
	const open = rows.filter((r) => !r.archivado).sort((a, b) => b.en - a.en);
	const despachadores = [];
	const chats = [];
	for (const r of open) {
		if (DISPATCHER.test(r.titulo)) {
			const d = despachadores.find((x) => x.titulo === r.titulo);
			if (d) d.total += 1;
			else despachadores.push({ fuente, titulo: r.titulo, total: 1, ultimo: r.en });
			continue;
		}
		const same = chats.find((c) => c.titulo === r.titulo);
		if (same) {
			same.total += 1;
			continue;
		}
		const tarea = taskOf(r.titulo, board);
		chats.push({
			fuente,
			titulo: r.titulo,
			tarea: tarea?.tag ?? null,
			estado: tarea?.estado ?? null,
			accion: verdict(tarea),
			total: 1,
			actualizado: new Date(r.en).toISOString(),
		});
	}
	const first = (c) => (c.accion === 'archivar' ? 0 : 1);
	chats.sort((a, b) => first(a) - first(b));
	return {
		chats,
		despachadores: despachadores.map((d) => ({
			...d,
			archivar: d.total - 1,
			ultimo: new Date(d.ultimo).toISOString(),
		})),
		archivados: rows.length - open.length,
	};
}

export async function externalSessions(board, { home = homedir() } = {}) {
	const fuentes = {};
	const chats = [];
	const despachadores = [];
	for (const key of Object.keys(SOURCES)) {
		const r = await readSource(key, home);
		if (r.error) {
			fuentes[key] = { disponible: false, motivo: r.error };
			continue;
		}
		const x = crossChats(key, r.rows, board);
		fuentes[key] = {
			disponible: true,
			abiertos:
				x.chats.reduce((s, c) => s + c.total, 0) +
				x.despachadores.reduce((s, d) => s + d.total, 0),
			archivados: x.archivados,
		};
		chats.push(...x.chats);
		despachadores.push(...x.despachadores);
	}
	return { fuentes, chats, despachadores };
}

export function externalSessionLines({ fuentes, chats, despachadores }) {
	const lines = ['Chats de Codex y Gemini sin archivar (el dueño los archiva a mano):'];
	for (const c of chats) {
		const why = c.estado ? `tarea ${c.estado} → ` : '';
		const times = c.total > 1 ? ` ×${c.total}` : '';
		lines.push(`  ${c.fuente} · ${c.titulo}${times} → ${why}${c.accion}`);
	}
	for (const d of despachadores)
		lines.push(
			d.archivar
				? `  ${d.fuente} · ${d.titulo} ×${d.total} → archivar ${d.archivar}, dejar la más reciente`
				: `  ${d.fuente} · ${d.titulo} ×1 → dejar (es la más reciente)`,
		);
	if (!chats.length && !despachadores.length) lines.push('  ninguno');
	const porArchivar =
		chats.filter((c) => c.accion === 'archivar').reduce((s, c) => s + c.total, 0) +
		despachadores.reduce((s, d) => s + d.archivar, 0);
	const estado = Object.entries(fuentes).map(([k, f]) =>
		f.disponible
			? `${SOURCES[k].label}: ${f.abiertos} abiertos, ${f.archivados} archivados`
			: `${SOURCES[k].label}: no disponible (${f.motivo})`,
	);
	lines.push(`Por archivar: ${porArchivar}. ${estado.join(' · ')}.`);
	return lines;
}
