/**
 * What the board says is next (T126): messages between agents, lock heartbeats, the «Le toca a usted», «Le toca
 * al coordinador» and «Detenidas» sections and the lane table read from Git. Pure functions only, like
 * model.mjs, so `pnpm board` and the view share them (the view loads this file as /next.mjs).
 */
import {
	AGENT_REGISTRY,
	authorOf,
	claimable,
	color,
	findTask,
	isFinished,
	isReadOnly,
	isReview,
	laneHolder,
	needsOwner,
	normalizePr,
	ordenOf,
	ownerAsks,
	ownerWhere,
	queue,
	READONLY_LANE,
	reviewRounds,
	SELF_STARTING,
	stage,
	taskTag,
	VEREDICTOS,
} from './model.mjs';
import { expiredQuestion, fold, mergeSignal, optionsText } from './owner-text.mjs';
import { delivery, deliveryText } from './delivery.mjs';
import { authorSession, findingsSent } from './findings.mjs';
import { archiveBlock } from './cierre.mjs';
import { missingCierreItems } from './require-cierre.mjs';
import {
	answerDestination,
	destinationFields,
	findingsDestination,
	FIXED_DESTINATIONS,
	lockDestination,
	pasteAgents,
	taskDestination,
} from './owner-where.mjs';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const time = (s) => (s ? new Date(s).getTime() : Number.NaN);

/** d249: the delivery mark with the agent's name: «Entregada a Codex · 14:35 · esperando que la tome». */
export const deliveryLine = (t, now = Date.now()) =>
	deliveryText(t, now, (a) => AGENT_REGISTRY[a]?.nombre ?? 'un agente');

/**
 * Messages to `agente` not read yet, oldest first; `bandejas` hold each reader's `leidos` ids, and a d291
 * `atendido` row of the bitácora marks the messages it lists as handled.
 */
export function unreadFor(agente, board) {
	const read = new Set((board.bandejas ?? []).find((b) => b.id === agente)?.leidos ?? []);
	const merged = new Set();
	for (const r of board.bitacora ?? [])
		if (r.atendido?.para === agente)
			for (const id of r.atendido.mensajes ?? []) {
				read.add(id);
				if (r.atendido.nota === 'merged') merged.add(id);
			}
	return (board.bitacora ?? [])
		.filter(
			(r) =>
				r.mensaje?.para === agente &&
				!(mergeSignal(r) ? merged : read).has(r.mensaje.id) &&
				!expiredQuestion(r, findTask(r.tarea, board)),
		)
		.sort((a, b) => Date.parse(a.en) - Date.parse(b.en));
}

export const GEMINI_RELAY_ALERT =
	'Arranque el relevo de Gemini: en Antigravity, en el Chat maestro, escriba «Arranque de nuevo el relevo celebra-gemini-relay.mjs».';

/** Missing or invalid timestamps fail closed; two minutes exactly is still fresh. */
export function geminiRelayStale(board, now = Date.now()) {
	const at = board.geminiRelay?.at;
	const beat = typeof at === 'number' ? at : typeof at === 'string' ? Date.parse(at) : NaN;
	return !Number.isFinite(beat) || now - beat > 2 * MINUTE_MS;
}

export function geminiRelayAlert(board, now = Date.now()) {
	return geminiRelayStale(board, now) && unreadFor('gemini', board).length
		? GEMINI_RELAY_ALERT
		: null;
}

/**
 * «claude → coordinador sobre T125: texto», as `inbox` and the view print a message; T322: a question to the
 * owner adds its options, the recommended one first, and says when a technical detail goes with it.
 */
export function messageLine(r, board) {
	const t = findTask(r.tarea, board);
	const { texto, opciones, detalle } = r.mensaje;
	const extra = `${opciones?.length ? ` Opciones: ${optionsText(opciones)}` : ''}${detalle ? ' (detalle técnico: pnpm board inbox)' : ''}`;
	return `${r.quien ?? '¿?'} → ${r.mensaje.para} sobre ${t ? taskTag(t) : r.tarea}: ${texto}${extra}`;
}

/** Short lane name of a session title: `f05` for f05-plataforma, `f04` for Integration. */
const laneShort = (id) =>
	id === 'integration' ? 'f04' : String(id ?? READONLY_LANE).split('-')[0];

/**
 * Why `titulo` cannot name the session that claims `t` in `carril`, or null: it must read `<carril> · T<n> · …`,
 * for example `f05 · T126 · Qué sigue y mensajes`. Required only for tasks created under the contract.
 */
export function claimTitleIssue(t, titulo, carril) {
	const lane = laneShort(isReadOnly(t) ? READONLY_LANE : carril);
	const want = `${lane} · ${taskTag(t)} · …`;
	if (typeof titulo !== 'string' || !titulo.trim())
		return t.contrato >= 1 ? `falta --titulo="${want}" (nombre de la sesión)` : null;
	const parts = titulo.split(' · ');
	if (parts.length < 3 || parts[0] !== lane || parts[1] !== taskTag(t) || !parts[2].trim())
		return `--titulo debe ser «${want}», no «${titulo}»`;
	return null;
}

/** A lock with no heartbeat for this long is «detenida»; every board command renews `latido`. */
const SILENT_LOCK_HOURS = 2;
/** A ready task nobody takes for this long is flagged. */
const READY_IDLE_MINUTES = 30;
/** The lock's last sign of life: its `latido`, else when it was taken. */
export const lockBeat = (c) => c?.latido ?? c?.desde;

/** «hace 45 min», «hace 3 h», «hace 2 días». */
export function agoText(ms) {
	const min = Math.max(0, Math.floor(ms / MINUTE_MS));
	if (min < 60) return `hace ${min} min`;
	const h = Math.floor(min / 60);
	return h < 48 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} días`;
}

/**
 * Since when a ready task is ready: its last write, or later, when a task, decision or date it waited for
 * was met; NaN for a task with no date.
 */
function readySince(t, board) {
	const all = [...(board.tareas ?? []), ...(board.archivo ?? [])];
	const times = [time(t.actualizado)];
	for (const r of Array.isArray(t.requisitos) ? t.requisitos : []) {
		if (r.tipo === 'tarea' || r.tipo === 'revision')
			times.push(time(all.find((x) => x.id === r.ref)?.actualizado));
		if (r.tipo === 'fecha') times.push(time(r.ref));
		if (r.tipo === 'decision')
			times.push(time((board.decisiones ?? []).find((d) => d.id === r.ref)?.en));
	}
	const known = times.filter((x) => !Number.isNaN(x));
	return known.length ? Math.max(...known) : Number.NaN;
}

/** Ready, unlocked tasks an agent (not the owner) should have started; `idle` is how long they waited. */
function readyUnclaimed(board, now) {
	return queue(board, now)
		.filter((t) => stage(t, board, now) === 'lista' && !t.candado && !needsOwner(t))
		.map((t) => ({ t, idle: now - readySince(t, board) }));
}

const isIdle = (idle) => idle >= READY_IDLE_MINUTES * MINUTE_MS;
const idleText = (idle) => (Number.isNaN(idle) ? '' : ` · lista ${agoText(idle)}`);

/**
 * What stalls the board right now:
 * - `dueno`: ready Codex or Gemini tasks unlocked for READY_IDLE_MINUTES → «Correr el despachador de Codex (T125)»;
 * - `detenidas`: open tasks whose lock had no heartbeat for SILENT_LOCK_HOURS.
 * Ready tasks for Claude or the coordinator go to «Le toca al coordinador» instead (coordinatorItems).
 */
export function stalls(board, now = Date.now()) {
	const dueno = readyUnclaimed(board, now)
		// d249: a delivered task comes back as its own «nadie la tomó» row instead.
		.filter(({ t, idle }) => isIdle(idle) && pasteAgents(t, board, now).agentes.length)
		.filter(({ t }) => !delivery(t, now))
		.map(({ t, idle }) => {
			// d314 (T391): a paused agent is never named as the place to paste.
			const names = pasteAgents(t, board, now).agentes.map((a) => AGENT_REGISTRY[a].nombre);
			return {
				t,
				texto: `Correr el despachador de ${names.join(' o ')} (${taskTag(t)})${idleText(idle)}`,
			};
		});
	const detenidas = (board.tareas ?? [])
		.filter((t) => t.candado && !isFinished(t))
		.map((t) => ({ t, silent: now - time(lockBeat(t.candado)) }))
		.filter(({ silent }) => silent >= SILENT_LOCK_HOURS * HOUR_MS)
		.map(({ t, silent }) => ({
			t,
			texto: `${taskTag(t)} · candado de ${t.candado.agente} sin latido ${agoText(silent)}${t.candado.titulo ? ` · sesión «${t.candado.titulo}»` : ''}`,
		}));
	return { dueno, detenidas };
}

/**
 * The verdict of a closed review round: its typed `cierre.resultado.veredicto` (T129: aprobado, cambios or
 * bloqueado), else a legacy `veredicto`, else its closing summary, where a pendiente is a finding for the author
 * (hallazgos); null while the round is open or once it is cancelled.
 */
export function reviewVerdict(r) {
	if (r.veredicto === 'aprobado' || r.veredicto === 'hallazgos') return r.veredicto;
	if (!r.cierre || r.estado === 'cancelada') return null;
	const typed = r.cierre.resultado?.veredicto;
	if (VEREDICTOS.includes(typed)) return typed;
	return (r.cierre.pendientes ?? []).length ? 'hallazgos' : 'aprobado';
}

/**
 * The review round that makes an open task «lista para unir» (T129): its last round approved the SHA it was
 * asked to review, and that SHA is still the PR head when `prs` (open PRs from GitHub) say so; else null.
 */
export function readyToMerge(t, board, prs) {
	if (isReview(t) || !t.pr || isFinished(t)) return null;
	const last = reviewRounds(t.id, board).at(-1);
	if (!last?.revisionSha || reviewVerdict(last) !== 'aprobado') return null;
	const sha = last.cierre?.resultado?.sha ?? last.revisionSha;
	if (!last.revisionSha.startsWith(sha)) return null;
	const head = prs?.find((p) => `#${p.number}` === normalizePr(t.pr))?.headRefOid;
	return head && head !== last.revisionSha ? null : last;
}

/**
 * The review item of a task under review: merge it, review its new head again, or pass the findings on; null when
 * `close` already sent the round's findings to the author (d251).
 */
function reviewItem(t, board, prs) {
	const last = reviewRounds(t.id, board).at(-1);
	const verdict = last && reviewVerdict(last);
	if (!verdict) return null;
	const sha = prs?.find((p) => `#${p.number}` === normalizePr(t.pr))?.headRefOid;
	const short = String(last.revisionSha ?? '').slice(0, 7);
	const ref = `${taskTag(t)} (PR ${normalizePr(t.pr)})`;
	if (sha && sha !== last.revisionSha)
		return {
			tipo: 'vuelta',
			t,
			texto: `Nueva vuelta de revisión: ${ref} cambió de ${short} a ${sha.slice(0, 7)}`,
		};
	if (verdict === 'aprobado')
		return {
			tipo: 'unir',
			t,
			texto: `Unir ${ref}: ${taskTag(last)} aprobó ${short}${sha ? '' : ' (SHA del PR sin comprobar)'}`,
		};
	if (verdict === 'bloqueado')
		return {
			tipo: 'hallazgos',
			t,
			texto: `Resolver el bloqueo que ${taskTag(last)} encontró en ${ref}`,
		};
	if (findingsSent(last.id, board).length) {
		// d269: the findings reached the author's inbox, but nobody wakes the author's session.
		if (verdict !== 'cambios') return null;
		const sesion = authorSession(t, authorOf(t))?.nombre;
		return {
			tipo: 'avisar',
			t,
			texto: `Avisar al autor de ${ref}: ${taskTag(last)} pidió cambios en ${short} y el PR sigue en ese SHA${sha ? '' : ' (SHA del PR sin comprobar)'}${sesion ? ` · sesión «${sesion}»` : ''}`,
		};
	}
	return {
		tipo: 'hallazgos',
		t,
		texto: `Pasar los hallazgos de ${taskTag(last)} al autor de ${ref}`,
	};
}

/** Open PRs no task names by `pr` or `rama`, archived tasks included. */
function prsWithoutTask(board, prs) {
	const all = [...(board.tareas ?? []), ...(board.archivo ?? [])];
	const named = (p) =>
		all.some(
			(t) => normalizePr(t.pr) === `#${p.number}` || (t.rama && t.rama === p.headRefName),
		);
	return (prs ?? [])
		.filter((p) => !named(p))
		.map((p) => ({
			tipo: 'sin-tarea',
			t: null,
			texto: `PR #${p.number} sin tarea: ${p.title}`,
		}));
}

/** Ready tasks for Claude or the coordinator that no session holds, flagged «detenida» after 30 min. */
function sessionItems(board, now) {
	return readyUnclaimed(board, now)
		.filter(({ t }) => t.actor === 'coordinador' || claimable(t, 'claude', board, now))
		.map(({ t, idle }) => ({
			tipo: 'sesion',
			t,
			texto: `${t.actor === 'coordinador' ? 'Hacer' : 'Abrir una sesión de Claude para'} ${taskTag(t)} · ${t.titulo}${idleText(idle)}${isIdle(idle) ? ' (detenida)' : ''}`,
		}));
}

/**
 * What the coordinator must do now, each `{tipo, t, texto}`; `prs` are the open PRs
 * `[{number, headRefOid, headRefName, title}]`, or undefined when GitHub was not read:
 * - `unir`: the last review round approved the PR's current head SHA;
 * - `vuelta`: the PR head moved past its last finished round, so it needs `pnpm board review` again;
 * - `hallazgos`: the last round found something at the current head that `close` did not send to the author;
 * - `avisar`: the last round asked for changes, `close` sent them to the author and the PR head has not moved
 *   since (d269), so the author's session must be told to read its inbox;
 * - `cierre`: a task «en revision» or «unida» without its closing summary (d255);
 * - `sin-tarea`: an open PR no task names;
 * - `sesion`: a ready task for Claude or the coordinator that no session holds;
 * - `mensaje`: unread messages to the coordinator.
 */
export function coordinatorItems(board, { prs, now = Date.now() } = {}) {
	const reviews = (board.tareas ?? [])
		.filter((t) => t.estado === 'en revision' && t.pr && !isReview(t))
		.filter((t) => prs === undefined || prs.some((p) => `#${p.number}` === normalizePr(t.pr)))
		.map((t) => reviewItem(t, board, prs))
		.filter(Boolean);
	const messages = unreadFor('coordinador', board)
		.filter((r) => !mergeSignal(r) || pendingMergeSignal(r, board, prs))
		.map((r) => ({
			tipo: 'mensaje',
			t: findTask(r.tarea, board),
			texto: `Mensaje: ${messageLine(r, board)}`,
		}));
	return [
		...reviews,
		...missingCierreItems(board),
		...prsWithoutTask(board, prs),
		...groupProdAlerts(sessionItems(board, now)),
		...messages,
	];
}

const STOPWORDS = new Set(
	'de el la en para que los las un una y o del al por con su se lo le es no si a'.split(' '),
);
const ALERT_STOPWORDS = new Set([...STOPWORDS, 'produccion', 'prod', 'alerta']);
/** Title words of a Production alert, without its «(date)» and numbers. */
const alertWords = (t) =>
	new Set(
		fold(t.titulo.replace(/\([^)]*\)/g, ' '))
			.split(/[^a-z0-9]+/)
			.filter((w) => w.length > 1 && !/^\d+$/.test(w) && !ALERT_STOPWORDS.has(w)),
	);
const overlap = (a, b) => [...a].filter((w) => b.has(w)).length / (Math.min(a.size, b.size) || 1);
const alertDate = (t) => t.id.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
const isProdAlert = (t) => t.id.startsWith('prod-alerta-');
/** Two Production alerts are one problem when most words of the shorter title appear in the other. */
const SAME_ALERT = 0.6;

/**
 * T489: prod-alerta-* tasks of one problem (titles that mostly share their words) become one row, the newest,
 * with how many times and on which dates it happened.
 */
function groupProdAlerts(items) {
	const groups = [];
	for (const item of items) {
		const w = isProdAlert(item.t) && alertWords(item.t);
		const g =
			w &&
			groups.find((x) => isProdAlert(x[0].t) && overlap(alertWords(x[0].t), w) >= SAME_ALERT);
		if (g) g.push(item);
		else groups.push([item]);
	}
	return groups.map((g) => {
		if (g.length === 1) return g[0];
		const dates = [...new Set(g.map(({ t }) => alertDate(t)).filter(Boolean))].sort();
		const newest = g.toSorted(
			(a, b) => alertDate(b.t).localeCompare(alertDate(a.t)) || b.t.num - a.t.num,
		)[0];
		const when = dates.length ? ` (${dates.join(', ')})` : '';
		return {
			...newest,
			veces: g.length,
			fechas: dates,
			texto: `${newest.texto} · ×${g.length}${when}`,
		};
	});
}

/** Queue projection only: keep the signal in history and the inbox, even after its PR finishes. */
function pendingMergeSignal(r, board, prs) {
	const task = findTask(r.tarea, board);
	const origin = task && isReview(task) ? findTask(task.origen, board) : task;
	if (origin && (isFinished(origin) || origin.archivada)) return false;
	const pr = normalizePr(r.mensaje.texto.match(/#\d+/)?.[0] ?? task?.pr ?? origin?.pr);
	return !pr || prs === undefined || prs.some((p) => `#${p.number}` === pr);
}

/**
 * d265: unread messages to the owner whose task is still open; a message about a task that is finished
 * (hecha, unida, comprobada, cancelada) or archived no longer asks for anything. `inbox` keeps every message.
 */
export function ownerMessages(board) {
	const archived = new Set((board.archivo ?? []).map((t) => t.id));
	return unreadFor('dueno', board).filter((r) => {
		const t = findTask(r.tarea, board);
		return !t || !(isFinished(t) || archived.has(t.id));
	});
}

/**
 * T391: review findings sent to an author the owner pastes into (Codex, Gemini: not self-starting), not read
 * yet, whose task is still open; the owner pastes them in the author's existing chat. Claude reads its own
 * inbox, so the coordinator's «avisar» item still covers it.
 */
export function ownerFindings(board) {
	const archived = new Set((board.archivo ?? []).map((t) => t.id));
	return Object.keys(AGENT_REGISTRY)
		.filter((a) => !SELF_STARTING.includes(a))
		.flatMap((a) => unreadFor(a, board))
		.filter((r) => {
			if (!r.mensaje.revision) return false;
			const t = findTask(r.tarea, board);
			return t && !isFinished(t) && !archived.has(t.id);
		});
}

const LEAD = /^\s*para\s+t\d+(\s+[a-z0-9-]+)?\s*[,:·]\s*/;
/** Content words of an owner question: no «Para T404 slug,» lead, no accents, no stopwords. */
const words = (s) =>
	new Set(
		fold(s)
			.replace(LEAD, '')
			.split(/[^a-z0-9]+/)
			.filter((w) => w.length > 1 && !STOPWORDS.has(w)),
	);
const jaccard = (a, b) => {
	const both = [...a].filter((w) => b.has(w)).length;
	return both / (a.size + b.size - both || 1);
};
/** «¿Aprueba …?» asks the owner to approve (a PR, a merge), not to choose. */
export const asksApproval = (texto) =>
	/^[^a-z0-9]*(aprueba|aprobar)\b/.test(fold(texto).replace(LEAD, ''));
/** Two questions of one task and sender are one row when both ask to approve or say nearly the same. */
const MERGE_SIMILARITY = 0.6;

/**
 * d292: messages to the owner, the near-identical ones of one task and sender merged into one group, so the
 * owner answers once. Each group `{rs, aprobar}` keeps every message, oldest first.
 */
export function ownerMessageGroups(board) {
	const groups = [];
	for (const r of ownerMessages(board)) {
		const key = `${r.tarea}|${r.quien}`;
		const aprobar = asksApproval(r.mensaje.texto);
		const w = words(r.mensaje.texto);
		const g = groups.find(
			(x) =>
				x.key === key &&
				x.aprobar === aprobar &&
				(aprobar || jaccard(x.w, w) >= MERGE_SIMILARITY),
		);
		if (g) g.rs.push(r);
		else groups.push({ key, aprobar, w, rs: [r] });
	}
	return groups.map(({ rs, aprobar }) => ({ rs, aprobar }));
}

/** The owner's ready tasks («own» color) that are not stalled with their dispatcher. */
function ownTasks(board, now) {
	const { dueno } = stalls(board, now);
	return queue(board, now).filter(
		(t) => color(t, board, { now }) === 'own' && !dueno.some((d) => d.t.id === t.id),
	);
}

/**
 * T489: «Le toca a usted», the one projection next, the view and Telegram share. Each row is one owner action,
 * `{tipo, id, tarea, t, texto, clave, donde, copia, destino, ...}` with `tipo`:
 * - `decidir`: a question to the owner (`r` the newest message, `opciones` its options);
 * - `aprobar`: an approval («¿Aprueba …?» or a task whose steps the owner authorizes), with its `pr`;
 * - `hacer`: something the owner does outside the board (an answer a task waits for, an owner task).
 * Merged messages carry `veces` and `fechas`. Prompts to paste, dispatchers, findings and the archive are the
 * coordinator's (`dispatchRows`).
 */
export function ownerInbox(board, { now = Date.now() } = {}) {
	const row = (t, tipo, texto, extra) => ({
		tipo,
		id: t?.id ?? null,
		tarea: t ? taskTag(t) : '',
		t: t ?? null,
		texto,
		...extra,
	});
	const messages = ownerMessageGroups(board).map(({ rs, aprobar }) => {
		const r = rs.at(-1);
		const t = findTask(r.tarea, board);
		const n = rs.length;
		return row(
			t,
			aprobar ? 'aprobar' : 'decidir',
			`Mensaje: ${messageLine(r, board)}${n > 1 ? ` (×${n})` : ''}`,
			{
				clave: `mensaje:${rs[0].mensaje.id}`,
				r,
				opciones: r.mensaje.opciones ?? [],
				...(aprobar ? { pr: normalizePr(t?.pr) ?? null } : {}),
				...(n > 1 ? { veces: n, fechas: rs.map((x) => x.en) } : {}),
				...destinationFields(answerDestination(t, board)),
			},
		);
	});
	const tasks = ownTasks(board, now).flatMap((t) => {
		const dest = taskDestination(t, board, now);
		if (dest.tipo !== 'autoriza' && dest.tipo !== 'guia') return [];
		const aprobar = dest.tipo === 'autoriza';
		const where = t.actor === 'dueno' && ownerWhere(t);
		return [
			row(
				t,
				aprobar ? 'aprobar' : 'hacer',
				`${taskTag(t)} · ${t.titulo}${where ? ` · ${where}` : ''}`,
				{
					clave: `tarea:${t.id}`,
					...(aprobar ? { pr: normalizePr(t.pr) ?? null } : {}),
					...destinationFields(dest),
				},
			),
		];
	});
	const asks = ownerAsks(board, now).map(({ t, r }) =>
		row(t, 'hacer', `${taskTag(t)} espera su respuesta: ${r.ref}`, {
			clave: `respuesta:${t.id}:${r.ref}`,
			ask: r,
			...destinationFields(answerDestination(t, board)),
		}),
	);
	return [...messages, ...tasks, ...asks];
}

/** Finished tasks the Finalizadas tab can archive now (the view payload precomputes `bloqueoArchivo`). */
export function archivableTasks(board) {
	return (board.tareas ?? []).filter(
		(t) =>
			isFinished(t) &&
			!t.archivada &&
			!t.candado &&
			!(Object.hasOwn(t, 'bloqueoArchivo') ? t.bloqueoArchivo : archiveBlock(t, board)),
	);
}

/** T442: locks silent for an hour. */
const silentLocks = (board, now) =>
	(board.tareas ?? [])
		.filter((t) => t.candado && !isFinished(t))
		.map((t) => ({ t, silent: now - Date.parse(lockBeat(t.candado) ?? '') }))
		.filter(({ silent }) => !Number.isNaN(silent) && silent >= HOUR_MS);

/**
 * T489: the rows that left the owner's inbox for the coordinator's: the Gemini relay, prompts to paste,
 * dispatchers to run, silent locks, review findings to paste and the archive. Each keeps its DÓNDE and text to copy.
 */
function dispatchRows(board, now) {
	const { dueno } = stalls(board, now);
	const relayAlert = geminiRelayAlert(board, now);
	const archivable = archivableTasks(board).length;
	return [
		...(relayAlert
			? [
					{
						t: null,
						tipo: 'gemini-relay',
						texto: relayAlert,
						donde: FIXED_DESTINATIONS['gemini-relay'],
						copia: null,
					},
				]
			: []),
		...ownTasks(board, now).flatMap((t) => {
			const dest = taskDestination(t, board, now);
			if (dest.tipo === 'autoriza' || dest.tipo === 'guia') return [];
			const where = t.actor === 'dueno' && ownerWhere(t);
			const paste = pasteAgents(t, board, now).agentes.map((a) => AGENT_REGISTRY[a].nombre);
			const how = where || (paste.length ? `Pegar en ${paste.join(' o ')}` : '');
			const late = deliveryLine(t, now);
			return [
				{
					t,
					tipo: 'despacho',
					texto: `${taskTag(t)} · ${t.titulo}${how ? ` · ${how}` : ''}${late ? ` · ${late}` : ''}`,
					...destinationFields(dest),
				},
			];
		}),
		...dueno.map(({ t, texto }) => ({
			t,
			tipo: 'detenida',
			texto,
			...destinationFields(taskDestination(t, board, now)),
		})),
		...silentLocks(board, now).map(({ t, silent }) => ({
			t,
			tipo: 'candado',
			texto: `Inspeccionar el candado de ${t.candado.agente} sin latido ${agoText(silent)}: ${taskTag(t)} · ${t.titulo}`,
			...destinationFields(lockDestination(t)),
		})),
		...ownerFindings(board).map((r) => ({
			t: findTask(r.tarea, board),
			tipo: 'correcciones',
			texto: `Correcciones para ${AGENT_REGISTRY[r.mensaje.para]?.nombre ?? r.mensaje.para}: ${r.mensaje.texto}`,
			...destinationFields(findingsDestination(r, board, now)),
		})),
		...(archivable
			? [
					{
						t: null,
						tipo: 'archivar',
						texto: `Archivar ${archivable} ${archivable === 1 ? 'tarea finalizada' : 'tareas finalizadas'}`,
						n: archivable,
						donde: FIXED_DESTINATIONS.archivar,
						copia: null,
					},
				]
			: []),
	];
}

/** An inbox row without its task and message objects, as `pnpm board` and the watcher read it. */
const publicRow = (x) =>
	Object.fromEntries(Object.entries(x).filter(([k]) => !['t', 'r', 'ask'].includes(k)));

/**
 * «Le toca a usted» (ownerInbox without its task and message objects), «Le toca al coordinador» (dispatchRows,
 * then coordinatorItems) and «Detenidas», each row `{id, tarea, texto}`. Owner rows also carry a stable `clave`
 * so the watcher's Telegram alerts (T437) fire once per item.
 */
export function nextSections(board, { prs, now = Date.now() } = {}) {
	const { detenidas } = stalls(board, now);
	const row = (t, texto, extra) => ({
		id: t?.id ?? null,
		tarea: t ? taskTag(t) : '',
		texto,
		...extra,
	});
	return {
		usted: ownerInbox(board, { now }).map(publicRow),
		coordinador: [...dispatchRows(board, now), ...coordinatorItems(board, { prs, now })].map(
			({ t, texto, ...extra }) => row(t, texto, extra),
		),
		detenidas: detenidas.map(({ t, texto }) => row(t, texto)),
		prsLeidos: prs !== undefined,
	};
}

/** The three sections as `pnpm board list` and `sigue` print them. */
export function sectionLines(r) {
	const block = (title, rows) => [
		'',
		`${title} (${rows.length}):`,
		...(rows.length
			? rows.flatMap((x) =>
					x.donde
						? [
								`  - ${x.donde}`,
								...String(x.texto)
									.split('\n')
									.map((l) => `    ${l}`),
							]
						: [`  - ${x.texto}`],
				)
			: ['  nada']),
	];
	return [
		...block('Le toca a usted', r.usted),
		...block('Le toca al coordinador', r.coordinador),
		...block('Detenidas', r.detenidas),
		...(r.prsLeidos ? [] : ['', 'Sin leer GitHub: «pnpm board sigue» añade los PR abiertos.']),
	];
}

/**
 * `pnpm board carril` uses the canonical metadata supplied by the store and the live Git/task row.
 */
export function liveLanes(board, git = []) {
	return laneRows(board, git).map((row) => {
		const { uso, orden } = (board.carriles ?? []).find((l) => l.id === row.id) ?? {};
		return { uso, orden, ...row };
	});
}

/**
 * The «Carriles» rows computed from Git: each lane record in `orden`, with what `git` read in its folder
 * (`{id, rama, limpio}`; rama null = detached HEAD) and the task whose lock holds it; `texto` is one line.
 */
export function laneRows(board, git = []) {
	return (board.carriles ?? [])
		.slice()
		.sort((a, b) => ordenOf(a) - ordenOf(b))
		.map((l) => {
			const g = git.find((x) => x.id === l.id);
			const t = laneHolder(l.id, board, null);
			const read = Boolean(g && !g.error);
			const where = !read ? 'sin leer git' : g.rama ? g.rama : 'HEAD suelto (libre)';
			const clean = !read ? '' : g.limpio ? ' · limpio' : ' · con cambios';
			const task = t
				? ` · ${taskTag(t)} de ${t.candado.agente}${t.candado.titulo ? ` («${t.candado.titulo}»)` : ''}`
				: '';
			return {
				id: l.id,
				tecla: l.tecla,
				puerto: l.puerto,
				rama: read ? g.rama : null,
				limpio: read ? g.limpio : null,
				tarea: t?.id ?? null,
				texto: `${l.id} · ${where}${clean}${task}`,
			};
		});
}
