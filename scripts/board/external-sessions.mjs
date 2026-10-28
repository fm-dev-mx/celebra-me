/**
 * `pnpm board sesiones` (d211): the Codex and Gemini chats the coordinator cannot see, crossed with the board so the
 * owner knows which ones to archive by hand. Both stores are opened read-only and never waited on: a missing or busy
 * store is reported as «no disponible» and the other one still answers.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { FINALIZADOS, isReview, taskLabel } from './model.mjs';
import { isMaster, masterConfigPath, readLocal } from './master-config.mjs';

export const SOURCES = {
	codex: { label: 'Codex', path: (home) => join(home, '.codex', 'state_5.sqlite') },
	gemini: {
		label: 'Gemini',
		path: (home) => join(home, '.gemini', 'antigravity', 'conversation_summaries.db'),
	},
};

/** Only chats a person or an agent opened; guardian reviews and subagents are not owner-facing. */
const CODEX_SQL = `select id, coalesce(name, title) as titulo, cwd as carpeta, archived as archivado,
	updated_at_ms as en, (thread_source = 'user') as usuario from threads
	where thread_source in ('user', 'agent_created_thread')`;
/** One row per conversation: the full-text index keeps several chunks of each, any of them may carry the flag. */
const GEMINI_SQL = `select s.conversation_id as id, s.title as titulo, s.workspace_uris as carpeta, s.last_modified_time as en,
	coalesce((select max(f.archived) from conversations_fts f where f.conversation_id = s.conversation_id), 0)
	as archivado, 1 as usuario from conversation_summaries s`;

const PROJECT = /celebra-me/i;
const DISPATCHER = /Despachador (Codex|Gemini)/i;
const TASK_NUM = /\bT(\d+)\b/;
const TITLE_MAX = 90;
const UNTITLED = '(sin título)';
/** A chat without a task stays listed only while a person used it this recently. */
const RECENT_MS = 48 * 3600_000;

/** Codex falls back to the first prompt as a title: keep its first line, short enough for one row. */
export function shortTitle(v) {
	const line = String(v ?? '')
		.trim()
		.split(/\r?\n/)[0]
		.trim();
	if (!line) return UNTITLED;
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
					id: r.id,
					titulo: shortTitle(r.titulo),
					archivado: Number(r.archivado) === 1,
					en: toMs(r.en),
					usuario: Number(r.usuario) === 1,
				})),
		};
	} catch (e) {
		return { error: String(e?.message ?? e).split('\n')[0] };
	} finally {
		db?.close();
	}
}

/** Identity-preserving archive candidates; a board status alone never proves a PR merged. */
export function archiveCandidates(agent, rows, board, config, prStates = {}) {
	const tasks = [...board.tareas, ...board.archivo];
	return rows
		.filter(
			(r) =>
				!r.archivado &&
				!isMaster(r, config) &&
				!(agent === 'claude' && config.archivedClaude?.includes(r.id)),
		)
		.flatMap((r) => {
			const t = tasks.find(
				(t) =>
					t.sesion?.id === r.id ||
					t.candado?.sesion === r.id ||
					Number(t.num) === Number(TASK_NUM.exec(r.titulo)?.[1]),
			);
			let motivo;
			if (DISPATCHER.test(r.titulo) && config.masters?.[agent])
				motivo = 'Despachador anterior (d351)';
			else if (t && !t.candado && isReview(t) && FINALIZADOS.includes(t.estado))
				motivo = 'Revisión cerrada';
			else if (t && !t.candado && ['hecha', 'unida', 'comprobada'].includes(t.estado)) {
				const pr = t.pr ?? t.cierre?.pr;
				if (pr && prStates[pr] !== 'MERGED') return [];
				motivo = pr ? `Tarea terminada · PR ${pr} unido` : 'Tarea terminada sin PR';
			}
			return motivo
				? [
						{
							agente: agent,
							id: r.id,
							titulo: r.titulo,
							tarea: t ? taskLabel(t) : null,
							motivo,
						},
					]
				: [];
		});
}

const exec = promisify(execFile);
const prCache = new Map();
async function readPrState(pr, cwd) {
	const key = `${cwd}:${pr}`;
	const hit = prCache.get(key);
	if (hit && Date.now() - hit.at < 60_000) return hit.state;
	try {
		const { stdout } = await exec(
			'gh',
			['pr', 'view', String(pr).replace(/^#/, ''), '--json', 'state'],
			{
				cwd,
				encoding: 'utf8',
				timeout: 10_000,
				windowsHide: true,
			},
		);
		const state = JSON.parse(stdout).state;
		prCache.set(key, { at: Date.now(), state });
		return state;
	} catch {
		return null;
	}
}

/** Same read-only host readers as `sesiones`, plus Claude's board-registered session identities. */
export async function archiveSessions(
	board,
	{
		dir,
		home = homedir(),
		config = readLocal(masterConfigPath(dir)),
		readPr = (pr) => readPrState(pr, join(dir, '..', '..', '..')),
		read = readSource,
	} = {},
) {
	const fuentes = {};
	const rows = {};
	for (const agent of Object.keys(SOURCES)) {
		const result = await read(agent, home);
		fuentes[agent] = result.error
			? { disponible: false, motivo: result.error }
			: { disponible: true };
		rows[agent] = result.rows ?? [];
	}
	// Claude has no equivalent archive flag in its local index. These are board recommendations,
	// requiring the master's inventory check; do not claim they are confirmed open host chats.
	rows.claude = [...board.tareas, ...board.archivo]
		.filter((t) => t.sesion?.agente === 'claude')
		.map((t) => ({ id: t.sesion.id, titulo: t.sesion.nombre ?? taskLabel(t) }));
	fuentes.claude = {
		disponible: true,
		motivo: 'Sesiones registradas en el tablero; el maestro confirma cuáles siguen abiertas',
	};
	const possible = Object.entries(rows).flatMap(([agent, values]) =>
		archiveCandidates(
			agent,
			values,
			board,
			config,
			Object.fromEntries(
				[...board.tareas, ...board.archivo].map((t) => [t.pr ?? t.cierre?.pr, 'MERGED']),
			),
		),
	);
	const prs = [
		...new Set(
			possible.flatMap((c) => {
				const t = [...board.tareas, ...board.archivo].find((t) => taskLabel(t) === c.tarea);
				return t && !isReview(t) && (t.pr ?? t.cierre?.pr) ? [t.pr ?? t.cierre.pr] : [];
			}),
		),
	];
	const states = Object.fromEntries(
		await Promise.all(prs.map(async (pr) => [pr, await readPr(pr)])),
	);
	const chats = Object.entries(rows).flatMap(([agent, values]) =>
		archiveCandidates(agent, values, board, config, states),
	);
	return { fuentes, chats: [...new Map(chats.map((c) => [`${c.agente}:${c.id}`, c])).values()] };
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

/** A chat without a task worth listing: titled, opened by a person and used in the last 48 h. */
const listed = (r, now) => r.titulo !== UNTITLED && r.usuario !== false && now - r.en <= RECENT_MS;

/**
 * Open chats per source with their verdict; the dispatcher's runs fold into one line each. Chats without a task
 * that are untitled, agent-made or idle for 48 h only count in `omitidosSinTarea`.
 */
export function crossChats(key, rows, board, now = Date.now()) {
	const fuente = SOURCES[key].label;
	const open = rows.filter((r) => !r.archivado).sort((a, b) => b.en - a.en);
	const despachadores = [];
	const chats = [];
	let omitidosSinTarea = 0;
	for (const r of open) {
		if (DISPATCHER.test(r.titulo)) {
			const d = despachadores.find((x) => x.titulo === r.titulo);
			if (d) d.total += 1;
			else despachadores.push({ fuente, titulo: r.titulo, total: 1, ultimo: r.en });
			continue;
		}
		// Filter each row before folding: a listed chat must not absorb an idle or agent-made namesake.
		const tarea = taskOf(r.titulo, board);
		if (!tarea && !listed(r, now)) {
			omitidosSinTarea += 1;
			continue;
		}
		const same = chats.find((c) => c.titulo === r.titulo);
		if (same) {
			same.total += 1;
			continue;
		}
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
		omitidosSinTarea,
	};
}

export async function externalSessions(
	board,
	{ home = homedir(), now = Date.now(), config = {} } = {},
) {
	const fuentes = {};
	const chats = [];
	const despachadores = [];
	let omitidosSinTarea = 0;
	for (const key of Object.keys(SOURCES)) {
		const r = await readSource(key, home);
		if (r.error) {
			fuentes[key] = { disponible: false, motivo: r.error };
			continue;
		}
		const x = crossChats(
			key,
			r.rows.filter((row) => !isMaster(row, config)),
			board,
			now,
		);
		fuentes[key] = {
			disponible: true,
			abiertos:
				x.chats.reduce((s, c) => s + c.total, 0) +
				x.despachadores.reduce((s, d) => s + d.total, 0) +
				x.omitidosSinTarea,
			archivados: x.archivados,
		};
		chats.push(...x.chats);
		despachadores.push(...x.despachadores);
		omitidosSinTarea += x.omitidosSinTarea;
	}
	return { fuentes, chats, despachadores, omitidosSinTarea };
}

export function externalSessionLines({ fuentes, chats, despachadores, omitidosSinTarea = 0 }) {
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
	const omitidos = omitidosSinTarea
		? ` Omitidos sin tarea: ${omitidosSinTarea} (sin título, de agente o sin uso en 48 h).`
		: '';
	lines.push(`Por archivar: ${porArchivar}.${omitidos} ${estado.join(' · ')}.`);
	return lines;
}
