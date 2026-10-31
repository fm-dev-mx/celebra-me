#!/usr/bin/env node
/**
 * `pnpm board:avisos` — no-AI Claude Code hook (T477). On UserPromptSubmit it prints one line when the
 * board holds new unread messages for this Claude session; on Stop it asks Claude to continue with that
 * line instead. With nothing new it prints nothing, so a turn without messages costs 0 tokens.
 *
 *   node scripts/board/session-notice.mjs                 hook mode: reads the hook JSON on stdin
 *   node scripts/board/session-notice.mjs --coordinador   register this session as the board coordinator
 *   node scripts/board/session-notice.mjs --instalar      add both hooks to the user's Claude settings
 *
 * A session reads the para=claude messages about the tasks it holds (`candado.sesion` or `sesion.id`); the
 * registered coordinator also reads every para=coordinador message and the para=claude ones no Claude session
 * holds, and each of its turns renews the heartbeat in board-coordinator.json that `coordinatorAlert` reads.
 * Lines already announced to a session are kept in board-session-notices.json next to the board store.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLAUDE_SESSION_ENV, CLAUDE_SESSION_PREFIX, taskTag } from './model.mjs';
import { unreadFor } from './next.mjs';
import { boardDir, coordinatorPath, readCollection, readCoordinator, readLog } from './store.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..');
const SCRIPT = join(here, 'session-notice.mjs');
/** Messages older than this never reach a hook line; `pnpm board inbox` still lists them. */
const LOOKBACK_MS = 14 * 24 * 3_600_000;
const KEPT_IDS = 300;
const KEPT_SESSIONS = 40;
const MAX_TASKS = 3;

export const noticesPath = (dir) => join(dirname(dir), 'board-session-notices.json');

function readJson(file, fallback) {
	try {
		return JSON.parse(readFileSync(file, 'utf8')) ?? fallback;
	} catch {
		return fallback;
	}
}

function writeJson(file, value) {
	mkdirSync(dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(value, null, '\t')}\n`);
	renameSync(tmp, file);
}

/** The board slice the hook needs: tasks, recent bitácora and read sets; archived tasks are skipped for speed. */
export function hookBoard(dir, now = Date.now()) {
	return {
		tareas: readCollection(dir, 'tareas'),
		bitacora: readLog(dir, { since: now - LOOKBACK_MS }),
		bandejas: readCollection(dir, 'bandejas'),
	};
}

const holds = (t, session) => t.candado?.sesion === session || t.sesion?.id === session;

/** Unread messages for `session`, oldest first; `coordinator` widens them as the header describes. */
export function sessionMessages(board, session, { coordinator = false } = {}) {
	const tasks = board.tareas ?? [];
	const mine = new Set(tasks.filter((t) => holds(t, session)).map((t) => t.id));
	const heldByClaude = new Set(
		tasks.filter((t) => t.candado?.agente === 'claude' && t.candado?.sesion).map((t) => t.id),
	);
	const claude = unreadFor('claude', board).filter(
		(r) => mine.has(r.tarea) || (coordinator && !heldByClaude.has(r.tarea)),
	);
	const rows = coordinator ? [...claude, ...unreadFor('coordinador', board)] : claude;
	return rows.sort((a, b) => Date.parse(a.en) - Date.parse(b.en));
}

/** «Tablero: 2 mensajes nuevos (T477 ×2 de gemini). Léalos con «pnpm board inbox --agente=claude».» */
export function noticeLine(rows, board, { coordinator = false } = {}) {
	if (!rows.length) return '';
	const groups = new Map();
	for (const r of rows) {
		const t = (board.tareas ?? []).find((x) => x.id === r.tarea);
		const tag = t ? taskTag(t) : r.tarea;
		const g = groups.get(tag) ?? { n: 0, de: new Set() };
		g.n += 1;
		if (r.quien) g.de.add(r.quien);
		groups.set(tag, g);
	}
	const parts = [...groups]
		.slice(0, MAX_TASKS)
		.map(([tag, g]) => `${tag}${g.n > 1 ? ` ×${g.n}` : ''} de ${[...g.de].join('/') || '?'}`);
	const more = groups.size > MAX_TASKS ? ` y ${groups.size - MAX_TASKS} tareas más` : '';
	const n = rows.length;
	const inbox = coordinator
		? '«pnpm board inbox --agente=coordinador» y «--agente=claude»'
		: '«pnpm board inbox --agente=claude»';
	return `Tablero: ${n} ${n === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} (${parts.join(', ')}${more}). Léalos con ${inbox}.`;
}

/**
 * The hook's whole effect as data: the line to show (or '') and the files to write. `input` is the hook
 * JSON; a session that is not Claude's app session, or a missing board, shows nothing.
 */
export function evaluate({ dir, session, input = {}, now = Date.now() }) {
	if (!session?.startsWith(CLAUDE_SESSION_PREFIX) || !existsSync(dir)) return { line: '' };
	const coordinator = readCoordinator(dir)?.sesion === session;
	const board = hookBoard(dir, now);
	const rows = sessionMessages(board, session, { coordinator });
	const store = readJson(noticesPath(dir), {});
	const seen = new Set(store[session]?.ids ?? []);
	const fresh = rows.filter((r) => !seen.has(r.mensaje.id));
	const writes = [];
	if (coordinator)
		writes.push([coordinatorPath(dir), { sesion: session, at: new Date(now).toISOString() }]);
	if (fresh.length) {
		const ids = [...seen, ...fresh.map((r) => r.mensaje.id)].slice(-KEPT_IDS);
		const others = Object.entries(store)
			.filter(([k]) => k !== session)
			.sort((a, b) => String(b[1]?.at).localeCompare(String(a[1]?.at)))
			.slice(0, KEPT_SESSIONS - 1);
		writes.push([
			noticesPath(dir),
			Object.fromEntries([...others, [session, { at: new Date(now).toISOString(), ids }]]),
		]);
	}
	const line = noticeLine(fresh, board, { coordinator });
	// Stop: a block makes Claude take one more step; never block a stop the hook itself caused.
	if (input.hook_event_name === 'Stop')
		return {
			line:
				line && !input.stop_hook_active
					? JSON.stringify({ decision: 'block', reason: line })
					: '',
			writes:
				line && !input.stop_hook_active
					? writes
					: writes.filter(([f]) => f !== noticesPath(dir)),
		};
	return { line, writes };
}

/** Register the calling Claude session as the coordinator, renewing its heartbeat. */
export function registerCoordinator(dir, session, now = Date.now()) {
	if (!session?.startsWith(CLAUDE_SESSION_PREFIX))
		throw new Error(`${CLAUDE_SESSION_ENV} vacía o no es un id de la app de Claude`);
	const value = { sesion: session, at: new Date(now).toISOString() };
	writeJson(coordinatorPath(dir), value);
	return value;
}

const EVENTS = ['UserPromptSubmit', 'Stop'];

/** Settings with this script as the only session-notice hook of each event; other hooks are kept. */
export function withHooks(settings, command) {
	const hooks = { ...(settings.hooks ?? {}) };
	for (const event of EVENTS) {
		const kept = (hooks[event] ?? [])
			.map((g) => ({
				...g,
				hooks: (g.hooks ?? []).filter(
					(h) => !String(h.command ?? '').includes('session-notice.mjs'),
				),
			}))
			.filter((g) => g.hooks.length);
		hooks[event] = [...kept, { hooks: [{ type: 'command', command, timeout: 10 }] }];
	}
	return { ...settings, hooks };
}

export const settingsPath = (env = process.env) =>
	join(env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'settings.json');

/** Installs the hooks into the user's Claude settings with absolute paths of this checkout and Node. */
export function install({ file = settingsPath(), node = process.execPath, script = SCRIPT } = {}) {
	const slash = (p) => p.replaceAll('\\', '/');
	const command = `"${slash(node)}" "${slash(script)}"`;
	writeJson(file, withHooks(readJson(file, {}), command));
	return { file, command };
}

function readStdin() {
	try {
		return JSON.parse(readFileSync(0, 'utf8') || '{}');
	} catch {
		return {};
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const session = process.env[CLAUDE_SESSION_ENV];
	if (args.includes('--instalar')) {
		const { file, command } = install();
		console.log(`Avisos del tablero instalados en ${file}: ${command}`);
	} else if (args.includes('--coordinador')) {
		try {
			const { sesion } = registerCoordinator(boardDir(REPO), session);
			console.log(`Sesión ${sesion} registrada como coordinador del tablero.`);
		} catch (error) {
			console.error(error.message);
			process.exitCode = 1;
		}
	} else {
		// A hook never fails the turn: any error means no line.
		try {
			const { line, writes = [] } = evaluate({
				dir: boardDir(REPO),
				session,
				input: readStdin(),
			});
			for (const [file, value] of writes) writeJson(file, value);
			if (line) process.stdout.write(`${line}\n`);
		} catch {
			// silent by design
		}
	}
}
