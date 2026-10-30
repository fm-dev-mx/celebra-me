/**
 * T391: where the owner acts on each «Para usted» row and the short text to copy there. Every row opens with a
 * DÓNDE line (agent · project or lane · new chat with its exact title, or the existing chat), and the text to
 * copy is a pointer to `pnpm board prompt <slug>` instead of the whole prompt, so a newer board revision never
 * stops the agent. Pure functions only: next.mjs, format.mjs and the view share them (served as /owner-where.mjs).
 */
import {
	AGENT_REGISTRY,
	agentPaused,
	findTask,
	isReview,
	normalizePr,
	ownerLaunches,
	READONLY_LANE,
	reviewRound,
	suggestedLane,
	taskLane,
	taskTag,
} from './model.mjs';
import { answerPrompt } from './owner-text.mjs';

/** The six kinds of destination, in the order the task describes them. */
export const DESTINO_TIPOS = ['nueva', 'revision', 'respuesta', 'correcciones', 'guia', 'autoriza'];

/** Agents a guide may run in, in order; the first one not paused gets it. */
const GUIDE_AGENTS = ['claude', 'codex', 'gemini'];

const agentName = (a) => AGENT_REGISTRY[a]?.nombre ?? a;
const oneLine = (s) =>
	String(s ?? '')
		.replace(/\s+/g, ' ')
		.trim();
/** `fNN` stands for the free lane `pnpm board plan` picks when the task has none yet. */
const laneShort = (lane) =>
	lane === READONLY_LANE ? 'f04' : lane ? String(lane).split('-')[0] : 'fNN';
/** A session title written as `fNN · T<n> · …`, the shape every claim title takes. */
const TITLE = /^f\d{2} · T\d+ · \S/;

/** «F4 · Integración (carpeta celebra-me)» or «proyecto f06-landing»; null without a lane. */
export function placeText(lane) {
	if (!lane) return null;
	return lane === READONLY_LANE ? 'F4 · Integración (carpeta celebra-me)' : `proyecto ${lane}`;
}

/** The pause end of `agente` as «2026-11-02», or null when the agent is not paused. */
function pausedUntil(agente, board, now) {
	if (!agentPaused(agente, board, now)) return null;
	const own = (board.agentes ?? []).find((a) => a.id === agente);
	return String(own.pausa.hasta).slice(0, 10);
}

/**
 * The agents the owner may paste `t` into: ownerLaunches without a paused agent (d314). `paused` lists the
 * ones left out with their pause end, so an all-paused row can say how long to wait.
 */
export function pasteAgents(t, board, now = Date.now()) {
	const all = ownerLaunches(t, board, now);
	const paused = all.filter((a) => agentPaused(a, board, now));
	return { agentes: all.filter((a) => !paused.includes(a)), paused };
}

/** The first line of the task's prompt when it is a session title; the view gets it as `promptTitulo`. */
export function promptTitle(t) {
	const line = typeof t.prompt === 'string' ? t.prompt.split('\n')[0].trim() : t.promptTitulo;
	return line && TITLE.test(line) ? line : null;
}

/**
 * The exact title of the new chat for `t`: the prompt's own first line when it is a title, else
 * `f04 · T<n> · PR #<n> · Revisión[ vuelta n]` for a review and `fNN · T<n>[ · PR #<n>] · <corto>` for a task.
 */
export function sessionTitle(t, board, lane = taskLane(t)) {
	const own = promptTitle(t);
	if (own) return own;
	if (isReview(t)) {
		const pr = normalizePr(findTask(t.origen, board)?.pr ?? t.pr);
		const n = reviewRound(t);
		return `f04 · ${taskTag(t)}${pr ? ` · PR ${pr}` : ''} · Revisión${n < 2 ? '' : ` vuelta ${n}`}`;
	}
	const pr = normalizePr(t.pr);
	return `${laneShort(lane)} · ${taskTag(t)}${pr ? ` · PR ${pr}` : ''} · ${oneLine(t.corto ?? t.titulo ?? t.id)}`;
}

/** The chat that already works on `t`: the lock's session, else the last recorded one; null when unknown. */
export function taskChat(t) {
	const c = t?.candado;
	if (c?.titulo) return { agente: c.agente, nombre: c.titulo, carril: c.carril };
	const s = t?.sesion;
	return s?.nombre ? { agente: s.agente, nombre: s.nombre, carril: s.carril } : null;
}

const doneLine = (parts) => `DÓNDE: ${parts.filter(Boolean).join(' · ')}`;
const pointer = (t) => [
	`Corra pnpm board prompt ${t.id} y siga esa versión (siempre la actual).`,
	`Si ya existe un chat de ${taskTag(t)}, siga en ese.`,
];

/** The RESPUESTA blocks owed to `t` (T380), or '' when it has none. */
const answerBlocks = (t, board) => String(answerPrompt(t, board, '') ?? '').trim();

/** A paste into an agent that is paused: no destination, only how long to wait. */
const pausedRow = (tipo, paused, board, now) => ({
	tipo,
	donde: `DÓNDE: ${paused
		.map((a) => `${agentName(a)} en pausa hasta ${pausedUntil(a, board, now)}`)
		.join(' y ')}: espere`,
	copia: null,
});

/** (6) The owner authorizes: no prompt, the coordinator brings the card. */
function authorizeRow(t) {
	return {
		tipo: 'autoriza',
		donde: `DÓNDE: tarjeta del coordinador · sin prompt (autoriza ${(t.toca ?? []).join(', ')})`,
		copia: null,
	};
}

/** (5) The owner does it: a new chat in Integration writes the guide and records the result. */
function guideRow(t, board, now) {
	const agente = GUIDE_AGENTS.find((a) => !agentPaused(a, board, now));
	if (!agente) return pausedRow('guia', GUIDE_AGENTS, board, now);
	// d314: an existing chat of a paused agent is skipped like the agent itself.
	const own = taskChat(t);
	const chat = own && !agentPaused(own.agente, board, now) ? own : null;
	const donde = doneLine([
		agentName(chat?.agente ?? agente),
		placeText(READONLY_LANE),
		chat ? `chat existente «${chat.nombre}»` : `chat nuevo «f04 · ${taskTag(t)} · Guía»`,
	]);
	const copia = [
		donde,
		`Prepare una guía para que yo haga ${taskTag(t)} «${oneLine(t.titulo)}»: corra pnpm board prompt ${t.id} y siga esa versión (siempre la actual).`,
		'Devuelva enlaces directos, pasos numerados, los datos que debo tener a mano y cómo comprobar que quedó bien.',
		'No actúe en mis cuentas ni escriba credenciales.',
		`Al terminar, anote el resultado: pnpm board msg ${t.id} --de=${chat?.agente ?? agente} --para=coordinador "<resultado>".`,
		`Si ya existe un chat de ${taskTag(t)}, siga en ese.`,
	].join('\n');
	return { tipo: 'guia', donde, copia };
}

/**
 * Where the owner sends a task row (a ready task or a relaunch) and the text to copy, `{tipo, donde, copia}`:
 * autoriza (owner steps in `toca`), guia (actor dueno), respuesta (answers owed, to the existing chat),
 * revision (a new chat in Integration) or nueva (a new chat in the planned lane). `copia` is null when there is
 * nothing to paste.
 */
export function taskDestination(t, board, now = Date.now()) {
	if ((t.toca ?? []).length && t.actor !== 'sesion') return authorizeRow(t);
	if (t.actor === 'dueno') return guideRow(t, board, now);
	const { agentes, paused } = pasteAgents(t, board, now);
	const blocks = answerBlocks(t, board);
	const tipo = blocks ? 'respuesta' : isReview(t) ? 'revision' : 'nueva';
	if (!agentes.length)
		return paused.length ? pausedRow(tipo, paused, board, now) : noPaste(t, tipo);
	const lane = isReview(t)
		? READONLY_LANE
		: (taskLane(t) ?? suggestedLane(t, board)?.carril ?? null);
	const chat = taskChat(t);
	const known = chat && agentes.includes(chat.agente);
	const donde = doneLine([
		agentes.map(agentName).join(' o '),
		placeText(known ? (chat.carril ?? lane) : lane) ?? 'un carril libre (pnpm board plan)',
		known ? `chat existente «${chat.nombre}»` : `chat nuevo «${sessionTitle(t, board, lane)}»`,
	]);
	const copia = [donde, ...(blocks ? [blocks] : pointer(t))].join('\n');
	return { tipo, donde, copia };
}

/** A task row nobody pastes (an agent starts it alone): its existing chat, nothing to copy. */
function noPaste(t, tipo) {
	const chat = taskChat(t);
	return {
		tipo,
		donde: chat
			? doneLine([
					agentName(chat.agente),
					placeText(chat.carril),
					`chat existente «${chat.nombre}»`,
				])
			: `DÓNDE: el agente la arranca solo · ${taskTag(t)}`,
		copia: null,
	};
}

/**
 * (3) An answer the owner gave or owes on `t` (a decision or a message row): the task's existing chat, and only
 * the RESPUESTA blocks to copy; before the answer exists there is nothing to copy. A message without a task is
 * answered on this board.
 */
export function answerDestination(t, board) {
	if (!t) return { tipo: 'respuesta', donde: 'DÓNDE: este tablero', copia: null };
	const chat = taskChat(t);
	const donde = chat
		? doneLine([
				agentName(chat.agente),
				placeText(chat.carril ?? taskLane(t)),
				`chat existente «${chat.nombre}»`,
			])
		: `DÓNDE: el chat de ${taskTag(t)} (si no existe, el que indique el tablero al reanudarla)`;
	const blocks = answerBlocks(t, board);
	return { tipo: 'respuesta', donde, copia: blocks ? `${donde}\n${blocks}` : null };
}

/**
 * (4) Findings a review sent to a Codex or Gemini author (bitácora row `r` with `mensaje.revision`): the
 * author's existing chat and only the findings to copy.
 */
export function findingsDestination(r, board, now = Date.now()) {
	const t = findTask(r.tarea, board);
	const agente = r.mensaje.para;
	if (agentPaused(agente, board, now)) return pausedRow('correcciones', [agente], board, now);
	const chat = taskChat(t);
	const own = chat?.agente === agente ? chat : null;
	const donde = doneLine([
		agentName(agente),
		placeText(own?.carril ?? (t && taskLane(t))),
		own ? `chat existente «${own.nombre}»` : `el chat de ${t ? taskTag(t) : r.tarea}`,
	]);
	return { tipo: 'correcciones', donde, copia: `${donde}\n${r.mensaje.texto}` };
}

/** The row fields a destination adds: `donde`, `copia` and `destino` (its kind). */
export const destinationFields = (dest) => ({
	donde: dest.donde,
	copia: dest.copia,
	destino: dest.tipo,
});

/** Fixed destinations of the rows that are not about pasting a task. */
export const FIXED_DESTINATIONS = {
	'gemini-relay': 'DÓNDE: Gemini · Antigravity · chat maestro',
	archivar: 'DÓNDE: este tablero, pestaña Finalizadas',
};

/** (Inspeccionar) a silent lock: the chat that holds it, nothing to copy. */
export function lockDestination(t) {
	const c = t.candado ?? {};
	return {
		tipo: 'detenida',
		donde: doneLine([
			agentName(c.agente),
			placeText(c.carril),
			c.titulo ? `chat existente «${c.titulo}»` : `la sesión de ${taskTag(t)}`,
		]),
		copia: null,
	};
}
