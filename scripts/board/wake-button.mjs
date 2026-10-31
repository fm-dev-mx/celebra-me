/**
 * The view's «Despertar» button: the owner nudges the agent of one open task without opening its session.
 * Codex and Gemini get the master watcher's own transport (`deliverWake`: codex queue or the Gemini relay) with a
 * fixed text, never free text. A Claude desktop session cannot be woken from outside, so a Claude task leaves a
 * message to the coordinator instead. Every wake is a bitácora message row, and one task is woken at most once
 * every WAKE_EVERY_MS.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { masterConfigPath, readLocal } from './master-config.mjs';
import { deliverWake, WAKE_ID } from './master-watch.mjs';
import { buildMessageRow, isFinished, taskTag } from './model.mjs';
import { appendLog, loadBoard, withLock } from './store.mjs';

export const WAKE_EVERY_MS = 10 * 60_000;
export const WAKE_AGENTS = ['codex', 'gemini', 'claude'];
const NAME = { codex: 'Codex', gemini: 'Gemini', claude: 'Claude' };

/** Who works the task now: its lock, then the agent it was delivered to, then its assigned agent. */
export const wakeAgent = (t) => t.candado?.agente ?? t.entregada?.agente ?? t.agente ?? null;

/** The fixed text for each destination; nothing typed by anyone reaches an agent. */
export const wakeText = (t, agent) =>
	agent === 'claude'
		? `Despertar: ${taskTag(t)} espera a su sesión Claude; ábrala desde el escritorio.`
		: `Revise su bandeja: ${taskTag(t)}`;

/**
 * Wake the agent of task `id`; answers `[status, body]` for the view server. The transport runs before the lock
 * (the Gemini relay is a `board msg` that takes the lock itself) and a failed one logs nothing.
 */
export async function wakeTask(
	dir,
	id,
	{
		now = Date.now(),
		exec = promisify(execFile),
		deliver = deliverWake,
		config = () => readLocal(masterConfigPath(dir)),
	} = {},
) {
	const board = loadBoard(dir, { since: now - WAKE_EVERY_MS });
	const t = (board.tareas ?? []).find((x) => x.id === id);
	if (!t || t.archivada) return [404, { error: `No existe la tarea abierta ${id}.` }];
	if (isFinished(t))
		return [409, { error: `${taskTag(t)} ya terminó; no hay a quién despertar.` }];
	const agent = wakeAgent(t);
	if (!WAKE_AGENTS.includes(agent))
		return [409, { error: `${taskTag(t)} no tiene un agente que se pueda despertar.` }];
	const last = (board.bitacora ?? []).find(
		(r) =>
			r.tarea === id &&
			String(r.mensaje?.id ?? '').startsWith(WAKE_ID) &&
			now - Date.parse(r.en) < WAKE_EVERY_MS,
	);
	if (last) {
		const min = Math.max(1, Math.ceil((Date.parse(last.en) + WAKE_EVERY_MS - now) / 60_000));
		return [429, { error: `${taskTag(t)} ya se despertó hace poco; espere ${min} min.` }];
	}
	const texto = wakeText(t, agent);
	const para = agent === 'claude' ? 'coordinador' : agent;
	if (agent !== 'claude') {
		const cfg = config() ?? {};
		const thread = cfg.masters?.[agent];
		if (!thread)
			return [
				409,
				{ error: `El maestro ${NAME[agent]} no está configurado (pnpm board master).` },
			];
		try {
			await deliver(agent, thread, texto, cfg, board, dir, exec);
		} catch (e) {
			return [502, { error: `No se pudo avisar a ${NAME[agent]}: ${e.message ?? e}` }];
		}
	}
	const en = new Date(now).toISOString();
	const row = buildMessageRow(id, { de: 'dueno', para, texto, id: `${WAKE_ID}${id}-${now}` }, en);
	withLock(dir, () => appendLog(dir, row));
	return [200, { id, agente: agent, para, texto }];
}

/** The view server's `wake` option. */
export const viewWaker = (dir) => (id) => wakeTask(dir, id);
