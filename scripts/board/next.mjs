/**
 * What the board says is next (T126): messages between agents, lock heartbeats, the «Le toca a usted», «Le toca
 * al coordinador» and «Detenidas» sections and the lane table read from Git. Pure functions only, like
 * model.mjs, so `pnpm board` and the view share them (the view loads this file as /next.mjs).
 */
import {
	AGENT_REGISTRY,
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
	ownerLaunches,
	ownerWhere,
	queue,
	READONLY_LANE,
	reviewRounds,
	stage,
	taskTag,
	VEREDICTOS,
} from './model.mjs';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const time = (s) => (s ? new Date(s).getTime() : Number.NaN);

/** Messages to `agente` not read yet, oldest first; `bandejas` hold each reader's `leidos` ids. */
export function unreadFor(agente, board) {
	const read = new Set((board.bandejas ?? []).find((b) => b.id === agente)?.leidos ?? []);
	return (board.bitacora ?? [])
		.filter((r) => r.mensaje?.para === agente && !read.has(r.mensaje.id))
		.sort((a, b) => Date.parse(a.en) - Date.parse(b.en));
}

/** «claude → coordinador sobre T125: texto», as `inbox` and the view print a message. */
export function messageLine(r, board) {
	const t = findTask(r.tarea, board);
	return `${r.quien ?? '¿?'} → ${r.mensaje.para} sobre ${t ? taskTag(t) : r.tarea}: ${r.mensaje.texto}`;
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
const lockBeat = (c) => c?.latido ?? c?.desde;

/** «hace 45 min», «hace 3 h», «hace 2 días». */
function agoText(ms) {
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
		.filter(({ t, idle }) => isIdle(idle) && ownerLaunches(t, board, now).length)
		.map(({ t, idle }) => {
			const names = ownerLaunches(t, board, now).map((a) => AGENT_REGISTRY[a].nombre);
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

/** The review item of a task under review: merge it, review its new head again, or pass the findings on. */
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
 * - `hallazgos`: the last round found something at the current head: pass it to the author;
 * - `sin-tarea`: an open PR no task names;
 * - `sesion`: a ready task for Claude or the coordinator that no session holds;
 * - `mensaje`: unread messages to the coordinator.
 */
export function coordinatorItems(board, { prs, now = Date.now() } = {}) {
	const reviews = (board.tareas ?? [])
		.filter((t) => t.estado === 'en revision' && t.pr && !isReview(t))
		.map((t) => reviewItem(t, board, prs))
		.filter(Boolean);
	const messages = unreadFor('coordinador', board).map((r) => ({
		tipo: 'mensaje',
		t: findTask(r.tarea, board),
		texto: `Mensaje: ${messageLine(r, board)}`,
	}));
	return [...reviews, ...prsWithoutTask(board, prs), ...sessionItems(board, now), ...messages];
}

/**
 * «Le toca a usted» (the owner's ready tasks with where to do them, answers owed, stalled Codex or Gemini tasks,
 * messages to the owner), «Le toca al coordinador» and «Detenidas», each row `{id, tarea, texto}`.
 */
export function nextSections(board, { prs, now = Date.now() } = {}) {
	const { dueno, detenidas } = stalls(board, now);
	const row = (t, texto, extra) => ({
		id: t?.id ?? null,
		tarea: t ? taskTag(t) : '',
		texto,
		...extra,
	});
	const own = queue(board, now).filter(
		(t) => color(t, board, { now }) === 'own' && !dueno.some((d) => d.t.id === t.id),
	);
	const usted = [
		...own.map((t) => {
			const where = t.actor === 'dueno' && ownerWhere(t);
			const paste = ownerLaunches(t, board, now).map((a) => AGENT_REGISTRY[a].nombre);
			const how = where || (paste.length ? `Pegar en ${paste.join(' o ')}` : '');
			return row(t, `${taskTag(t)} · ${t.titulo}${how ? ` · ${how}` : ''}`);
		}),
		...ownerAsks(board, now).map(({ t, r }) =>
			row(t, `${taskTag(t)} espera su respuesta: ${r.ref}`),
		),
		...dueno.map(({ t, texto }) => row(t, texto)),
		...unreadFor('dueno', board).map((r) =>
			row(findTask(r.tarea, board), `Mensaje: ${messageLine(r, board)}`),
		),
	];
	return {
		usted,
		coordinador: coordinatorItems(board, { prs, now }).map(({ t, tipo, texto }) =>
			row(t, texto, { tipo }),
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
		...(rows.length ? rows.map((x) => `  - ${x.texto}`) : ['  nada']),
	];
	return [
		...block('Le toca a usted', r.usted),
		...block('Le toca al coordinador', r.coordinador),
		...block('Detenidas', r.detenidas),
		...(r.prsLeidos ? [] : ['', 'Sin leer GitHub: «pnpm board sigue» añade los PR abiertos.']),
	];
}

/** Lane record fields written by hand that go stale (T172): Git and the locks say them live instead. */
const STALE_LANE_FIELDS = ['estado', 'tarea', 'sesion', 'nota', 'comprobadoEn'];

/**
 * T172: `pnpm board carril` without an id — each lane record's own fields (uso, tecla, puerto, rev) with its
 * live row from `laneRows`; the hand-written runtime fields are left out so they never contradict `carriles`.
 */
export function liveLanes(board, git = []) {
	return laneRows(board, git).map((row) => {
		const rec = { ...(board.carriles ?? []).find((l) => l.id === row.id) };
		for (const k of STALE_LANE_FIELDS) delete rec[k];
		return { ...rec, ...row };
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
