/**
 * Board v3 model shared by `pnpm board`, `pnpm board:verify` and the local view (rules: .agent/rules/board.md).
 * Pure functions only: no Node APIs, so the view imports this same file in the browser.
 */
import { validChangelog } from './changelog.mjs';
import { awaitingClaim } from './delivery.mjs';
import { isForeignPull } from './pr-ref.mjs';
import { answerPrompt, messageExtraIssues, ownerFieldChecks } from './owner-text.mjs';
import {
	isPromptV1,
	promptSection,
	promptV1Issues,
	withPushCheck,
	withRunLines,
	withBoardAccess,
} from './prompt.mjs';
import { requisitoText } from './requisito-text.mjs';

export { normalizePr, prNumber } from './pr-ref.mjs';
export { dayOf, requisitoLine, requisitoText, taskName } from './requisito-text.mjs';

export const URGENCIAS = ['urgente', 'alta', 'normal', 'baja'];
export const ACTORES = ['dueno', 'sesion', 'coordinador'];
export const AGENT_REGISTRY = {
	claude: {
		nombre: 'Claude',
		capacidades: ['codigo', 'git', 'gh', 'navegador', 'artifact', 'sesiones'],
	},
	codex: { nombre: 'Codex', capacidades: ['codigo', 'git', 'gh'] },
	gemini: { nombre: 'Gemini', capacidades: ['codigo', 'git', 'gh', 'imagenes'] },
};
export const AGENTES = [...Object.keys(AGENT_REGISTRY), 'cualquiera'];
/** Claude Desktop's app id (list, archive, rename, #local_ links); CLAUDE_CODE_SESSION_ID is the process id. */
export const CLAUDE_SESSION_ENV = 'CLAUDE_CODE_HOST_SESSION_ID';
export const CLAUDE_SESSION_PREFIX = 'local_';

/** The session a lock names: an explicit --sesion, else Claude's app id from `env` (codex/gemini: none yet). */
export function sessionOf(agente, given, env) {
	if (typeof given === 'string' && given) return given;
	return agente === 'claude' ? env?.[CLAUDE_SESSION_ENV] || undefined : undefined;
}

/** Why a new lock cannot record this session, or null; only Claude ids are checked (T55/T56 define the rest). */
export function lockSessionIssue(agente, sesion) {
	if (!sesion)
		return agente === 'claude'
			? `falta --sesion: la variable ${CLAUDE_SESSION_ENV} está vacía`
			: 'falta --sesion=<id>';
	if (agente === 'claude' && !sesion.startsWith(CLAUDE_SESSION_PREFIX))
		return `--sesion=${sesion} no es un id de la app de Claude: debe empezar con ${CLAUDE_SESSION_PREFIX} (use ${CLAUDE_SESSION_ENV}, no CLAUDE_CODE_SESSION_ID)`;
	return null;
}
export const TOCA = ['main', 'produccion', 'migracion', 'secretos'];
export const REQUISITOS = ['tarea', 'decision', 'fecha', 'dueno', 'revision'];
export const ESTADOS = [
	'pendiente',
	'bloqueada',
	'en curso',
	'en revision',
	'hecha',
	'unida',
	'comprobada',
	'cancelada',
];
/** Stages of the «Carriles» view, in column order. */
export const STAGES = ['bloqueada', 'lista', 'curso', 'revision', 'hecha'];

/** Who writes a bitácora row: an agent, the coordinator or the owner. */
export const QUIEN = ['claude', 'codex', 'gemini', 'coordinador', 'dueno'];
/** States a row may move between: the task's, `archivada` for archive/unarchive, '' before the task existed. */
const LOG_ESTADOS = ['', ...ESTADOS, 'archivada'];
const QUIEN_ALIAS = { dueño: 'dueno' };
/** Who a board message goes to (T126): `pnpm board msg <id> --de=<a> --para=<b> "texto"`. */
export const DESTINOS = ['coordinador', 'dueno', 'codex', 'gemini', 'claude'];
/** d291: readers whose messages `pnpm board atendido` marks as handled; agents read theirs with `inbox`. */
export const ATENDIBLES = ['dueno', 'coordinador'];
/** A row that changes no task: a message (T126) or the mark that messages were handled (d291). */
export const isNoteRow = (r) => Boolean(r?.mensaje || r?.atendido);

/** The writer of a command: `--quien` (dueño → dueno), else a declared coordinator, else `--agente`. */
export function quienOf({ quien, coordinador, agente } = {}) {
	const given = typeof quien === 'string' && quien ? quien : undefined;
	const who = given ?? (coordinador ? 'coordinador' : agente);
	return typeof who === 'string' ? (QUIEN_ALIAS[who] ?? who) : undefined;
}

/**
 * Shape problems of a bitácora row `{tarea, en, quien, corrio?, salio?}` plus exactly one change: `de`/`a`
 * (estado), `agente {de, a}`, `carril {de, a}` ('' = none), `mensaje {id, para, texto}` (T126) or
 * `atendido {para, mensajes: [id…]}` (d291). Rows converted by `migrate-log` carry `legado` and
 * may lack `quien`, since most old rows never recorded it.
 */
export function logRowIssues(r) {
	const out = [];
	if (!String(r?.tarea ?? '').trim()) out.push('fila sin tarea');
	if (!isDate(r?.en)) out.push('fila sin fecha en');
	if (!QUIEN.includes(r?.quien) && !(r?.legado && r.quien === undefined))
		out.push(`quien debe ser ${QUIEN.join('/')}${r?.quien ? `, no ${r.quien}` : ''}`);
	return [...out, ...changeIssues(r)];
}

/** The single change a row records: estado `de`/`a`, `agente {de, a}`, `carril {de, a}`, a `mensaje` or `atendido`. */
function changeIssues(r) {
	const kinds = ['estado', 'agente', 'carril', 'mensaje', 'atendido'].filter((k) =>
		k === 'estado' ? r?.de !== undefined || r?.a !== undefined : r?.[k] !== undefined,
	);
	if (kinds.length !== 1)
		return ['la fila cambia una sola cosa: estado (de/a), agente, carril, mensaje o atendido'];
	if (kinds[0] === 'mensaje') return messageIssues(r.mensaje);
	if (kinds[0] === 'atendido') return handledIssues(r.atendido);
	if (kinds[0] === 'estado')
		return ['de', 'a']
			.filter((k) => !LOG_ESTADOS.includes(r[k] ?? ''))
			.map((k) => `estado desconocido en ${k}: ${r[k]}`);
	const c = r[kinds[0]];
	const ok = kinds[0] === 'agente' ? (v) => AGENTES.includes(v) : (v) => typeof v === 'string';
	return c && typeof c === 'object' && ok(c.de) && ok(c.a)
		? []
		: [`${kinds[0]} debe ser {de, a}`];
}

function messageIssues(m) {
	if (!m || typeof m !== 'object') return ['mensaje debe ser {id, para, texto}'];
	const out = [];
	if (!String(m.id ?? '').trim()) out.push('mensaje sin id');
	if (!DESTINOS.includes(m.para)) out.push(`para debe ser ${DESTINOS.join('|')}`);
	if (!String(m.texto ?? '').trim()) out.push('mensaje sin texto');
	out.push(...messageExtraIssues(m));
	return out;
}

function handledIssues(a) {
	if (!a || typeof a !== 'object') return ['atendido debe ser {para, mensajes}'];
	const out = [];
	if (!ATENDIBLES.includes(a.para)) out.push(`atendido.para debe ser ${ATENDIBLES.join('|')}`);
	if (
		!Array.isArray(a.mensajes) ||
		!a.mensajes.length ||
		!a.mensajes.every((id) => typeof id === 'string' && id.trim())
	)
		out.push('atendido.mensajes debe listar los id de los mensajes');
	return out;
}

/** A bitácora row carrying a message about task `tarea` from `de` to `para` (T126). */
export function buildMessageRow(tarea, { de, para, texto, id }, en) {
	return { tarea, en, quien: quienOf({ quien: de }), mensaje: { id, para, texto } };
}

/**
 * A new bitácora row: `change` is `{de, a}` for an estado, or `{agente}` / `{carril}` holding `{de, a}`; `who`
 * holds --quien, --coordinador and --agente (see quienOf).
 */
export function buildLogRow(tarea, change, who, { corrio, salio } = {}, en) {
	return {
		tarea,
		en,
		quien: quienOf(who),
		...(change.agente || change.carril ? change : { de: change.de ?? '', a: change.a ?? '' }),
		...(corrio ? { corrio } : {}),
		...(salio ? { salio } : {}),
	};
}

/** Why `pnpm board` refuses to write this row, or null. */
export function logRowError(row) {
	const issues = logRowIssues(row);
	if (!issues.length) return null;
	if (row.quien === undefined)
		return `falta quién escribe la fila: use --quien=${QUIEN.join('|')}, --agente o --coordinador`;
	return `no se escribió la bitácora de ${row.tarea}: ${issues.join('; ')}`;
}

/** What a row changed, for `history` and the view: `hecha → unida`, `agente codex → claude`, `carril — → f10`. */
export function logChange(r) {
	const pair = (c) => `${c.de || '—'} → ${c.a || '—'}`;
	if (r.agente) return `agente ${pair(r.agente)}`;
	if (r.carril) return `carril ${pair(r.carril)}`;
	if (r.mensaje) return `mensaje ${r.quien ?? '—'} → ${r.mensaje.para}`;
	if (r.atendido)
		return `atendido por ${r.quien ?? '—'}: ${r.atendido.mensajes?.length ?? 0} para ${r.atendido.para}`;
	return r.de || r.a ? pair(r) : '';
}

/** Decisions and bitácora rows of `pnpm board history`, newest first; replaced decisions only with `todas` (d187). */
export function historyRows(board, { todas = false } = {}) {
	return [
		...(board.decisiones ?? [])
			.filter((d) => todas || d.vigente !== false)
			.map((d) => ({
				en: d.en,
				txt: `${d.id}${d.vigente === false ? ' (reemplazada)' : ''} ${d.decision ?? ''}`,
			})),
		...(board.bitacora ?? []).map((b) => ({
			en: b.en,
			txt: `${b.tarea} ${logChange(b)} ${b.mensaje?.texto ?? b.corrio ?? ''}`,
		})),
	].sort((a, b) => Date.parse(b.en) - Date.parse(a.en));
}

const LANE_LIKE = /^(?:sin carril|integration|f\d{2}-[a-z0-9-]+)$/;
const LEGACY_QUIEN = { dueño: 'dueno', coordinador: 'coordinador', claude: 'claude' };
const LEGACY_ESTADO = { en_curso: 'en curso', '—': '' };

/**
 * One old file-per-row bitácora document in the current shape, nothing dropped: estados normalized, agent and
 * lane hand-overs moved out of `de`/`a`, a free-text `quien` kept as `quienTexto`, the file name in `archivo`.
 */
export function legacyLogRow(old, archivo) {
	const { id, de, a, quien, ...rest } = old;
	const norm = (v) => LEGACY_ESTADO[v ?? ''] ?? v ?? '';
	const row = { ...rest, legado: true, archivo: archivo ?? id };
	const who = LEGACY_QUIEN[quien];
	if (who) row.quien = who;
	else if (String(quien ?? '').trim()) row.quienTexto = quien;
	const [d, x] = [norm(de), norm(a)];
	const both = (test) => test(d) && test(x);
	if (both((v) => AGENTES.includes(v)) && !ESTADOS.includes(d)) row.agente = { de: d, a: x };
	else if (both((v) => LANE_LIKE.test(v)))
		row.carril = { de: d === 'sin carril' ? '' : d, a: x === 'sin carril' ? '' : x };
	else Object.assign(row, { de: d, a: x });
	return row;
}

/** Capabilities each agent has unless the store's `agentes/<id>.json` says otherwise. */
export const DEFAULT_CAPACIDADES = Object.fromEntries(
	Object.entries(AGENT_REGISTRY).map(([id, agent]) => [id, agent.capacidades]),
);

const SUCCESS = new Set(['hecha', 'unida', 'comprobada']);
/** Finished tasks (the «Finalizadas» tab): only these can be archived (d167). */
export const FINALIZADOS = ['hecha', 'unida', 'comprobada', 'cancelada'];
export const isFinished = (t) => FINALIZADOS.includes(t?.estado);
/**
 * A cross-review child: it carries the reviewed SHA or its id ends in `-revision` (`-revision-2`, … for later
 * rounds). An origin alone also marks follow-up implementation work, so it never makes a task a review.
 */
export const isReview = (t) => Boolean(t.revisionSha) || /-revision(?:-\d+)?$/.test(String(t.id));
/** Round of a review child: 1 for `<id>-revision`, n for `<id>-revision-<n>`. */
export const reviewRound = (t) => Number(/-revision-(\d+)$/.exec(String(t.id))?.[1] ?? 1);

/** Review rounds of a task, first to last, archived ones included, so the view lists them one below another. */
export function reviewRounds(origen, board) {
	const prefix = `${origen}-revision`;
	const own = (t) =>
		t.origen === origen &&
		(t.id === prefix ||
			(t.id.startsWith(`${prefix}-`) && /^\d+$/.test(t.id.slice(prefix.length + 1))));
	const byId = new Map(
		[...(board.archivo ?? []), ...(board.tareas ?? [])].filter(own).map((t) => [t.id, t]),
	);
	return [...byId.values()].sort((a, b) => reviewRound(a) - reviewRound(b));
}

/** Review rounds of a task or of a round's origin, as `show` prints them: `vuelta 2 · 1a2b3c4 · pendiente · x-revision-2`. */
export function roundLines(t, board) {
	const rounds = reviewRounds(isReview(t) && t.origen ? t.origen : t.id, board);
	if (!rounds.length) return [];
	return [
		'VUELTAS DE REVISIÓN',
		...rounds.map(
			(r) =>
				`  vuelta ${reviewRound(r)} · ${String(r.revisionSha ?? '').slice(0, 7)} · ${r.estado ?? 'pendiente'} · ${r.id}`,
		),
	];
}

/** The agent whose work a task is: its own `agente`, else the lock's or the last session's. */
export function authorOf(t) {
	const known = (a) => (Object.hasOwn(AGENT_REGISTRY, a) ? a : undefined);
	return known(t.agente) ?? known(t.candado?.agente) ?? known(t.sesion?.agente);
}

/** d183: Claude reviews Codex and Gemini; Gemini reviews Claude unless Codex is asked for. */
export const defaultReviewer = (author) =>
	author === 'claude'
		? 'gemini'
		: author === 'codex' || author === 'gemini'
			? 'claude'
			: undefined;

/**
 * Why `reviewer` may not review work by `author` (d183), or null. d288: Claude may review Claude's work only
 * when the PR is low or medium risk outside release work (`subagent`), through a clean-context subagent.
 */
export function reviewerIssue(author, reviewer, { subagent = false } = {}) {
	if (!Object.hasOwn(AGENT_REGISTRY, reviewer ?? '')) return `revisor desconocido: ${reviewer}`;
	if (reviewer === author && !(author === 'claude' && subagent))
		return author === 'claude'
			? 'd288: un subagente de claude revisa el trabajo de claude solo en riesgo bajo o medio, fuera de release'
			: 'la revisión cruzada requiere otro agente';
	if (author && author !== 'claude' && reviewer !== 'claude')
		return `d183: el trabajo de ${author} lo revisa claude`;
	return null;
}

/** `T34 serenata-fotos`, or the id alone when the task has no number (d159). */
export const taskLabel = (t) => (Number.isInteger(t.num) ? `T${t.num} ${t.id}` : t.id);
/** `T34`, or the id when the task has no number. */
export const taskTag = (t) => (t.num ? `T${t.num}` : t.id);
/** Sort rank of a task or lane `orden`; an unset one goes last. */
export const ordenOf = (x) => x?.orden ?? 999;
/** Task id rule: the branch name without its type prefix (`fix/olivia-gallery` → `olivia-gallery`). */
export const taskIdFromBranch = (branch) => String(branch ?? '').replace(/^[^/]+\//, '');
/** A lock is old after this many hours; `pnpm board:sync --horas` or CELEBRA_BOARD_LOCK_HOURS overrides it. */
export const STALE_LOCK_HOURS = 6;
const HOUR_MS = 3_600_000;
/** Whether a lock was taken more than `hours` ago. */
export const isStaleLock = (candado, now = Date.now(), hours = STALE_LOCK_HOURS) =>
	now - Date.parse(candado?.desde ?? '') >= hours * HOUR_MS;
/** d274: a lock with no heartbeat for this long may be freed by the coordinator once its task has a valid cierre. */
export const SILENT_LOCK_HOURS = 2;
/** Whether a lock's last sign of life (its `latido`, else when it was taken) is `hours` old or more. */
export const isSilentLock = (candado, now = Date.now(), hours = SILENT_LOCK_HOURS) =>
	now - Date.parse(candado?.latido ?? candado?.desde ?? '') >= hours * HOUR_MS;
const time = (s) => (s ? new Date(s).getTime() : Number.NaN);

/** The task a closing «pendiente» points to: `T58` by its number, anything else by id; null when absent. */
export function findTask(ref, board) {
	const all = [...(board.tareas ?? []), ...(board.archivo ?? [])];
	const n = /^T(\d+)$/i.exec(String(ref ?? '').trim());
	if (n) return all.find((x) => x.num !== undefined && Number(x.num) === Number(n[1])) ?? null;
	return all.find((x) => x.id === ref) ?? null;
}

/** Handoff Contract lists of the `cierre` (T129) and the repeatable `close` flag of each. */
export const HANDOFF_LISTS = [
	['fallidas', 'fallida'],
	['riesgos', 'riesgo'],
	['dudas', 'duda'],
	['excepcion', 'excepcion'],
];
export const VEREDICTOS = ['aprobado', 'cambios', 'bloqueado'];
const PRIORIDADES = ['P0', 'P1', 'P2', 'P3'];
export const NIVELES = ['validate:changed', 'type-check', 'ci'];

/**
 * T130: what a task does (`tipo`), each with its `.agent/kinds/<tipo>.yaml`; `categoria` only picks its lane.
 * RESULT_FIELDS are the `resultado` fields a kind's close returns (T129); the other kinds return the common
 * Handoff lists only.
 */
export const TIPOS = [
	'codigo',
	'revision',
	'release',
	'invitacion',
	'creativo',
	'auditoria',
	'operacion',
];
export const RESULT_FIELDS = {
	codigo: ['pr', 'sha', 'nivel'],
	revision: ['veredicto', 'sha', 'hallazgos'],
};

/** Which typed `resultado` a task's close returns (T129): a review round, code with a PR, or none. */
export function resultKind(t) {
	if (isReview(t) || t.tipo === 'revision') return 'revision';
	if (t.tipo === 'codigo') return 'codigo';
	return t.pr || t.cierre?.pr ? 'codigo' : null;
}

/** Whether the T129 return contract applies: only tasks created under contrato 2 or later. */
export const fullContract = (t) => Number.isInteger(t?.contrato) && t.contrato >= 2;

/**
 * A task's requisitos, each re-checked against the board right now. A pending task without a prompt gets an
 * automatic «prompt» requisito, except when the coordinator itself is the actor.
 */
export function requisitos(t, board, now = Date.now()) {
	const tareas = board.tareas ?? [];
	const decisiones = board.decisiones ?? [];
	const list = (Array.isArray(t.requisitos) ? t.requisitos : []).map((r) => {
		if (r.tipo === 'tarea') {
			const d = tareas.find((x) => x.id === r.ref);
			const archived = (board.archivo ?? []).find((x) => x.id === r.ref);
			return { ...r, ok: SUCCESS.has((d ?? archived)?.estado) };
		}
		if (r.tipo === 'revision') {
			const d = [...tareas, ...(board.archivo ?? [])].find((x) => x.id === r.ref);
			return { ...r, ok: !!d?.pr && ['en revision', 'hecha', 'unida'].includes(d.estado) };
		}
		if (r.tipo === 'fecha') return { ...r, ok: now >= time(r.ref) };
		if (r.tipo === 'decision') {
			const d = decisiones.find((x) => x.id === r.ref);
			return { ...r, ok: !!d && d.vigente === true };
		}
		return { ...r, ok: r.ok === true };
	});
	if ((t.estado ?? 'pendiente') === 'pendiente' && t.actor !== 'coordinador' && !t.prompt)
		list.push({ tipo: 'prompt', ref: '', ok: false, auto: true });
	return list;
}

/** Why a blocked task waits, from its first unmet requisito; '' when it is not blocked by one. */
export function blockedText(t, board) {
	const first = stage(t, board) === 'bloqueada' && requisitos(t, board).find((r) => !r.ok);
	return first ? requisitoText(first, board, { espera: true }) : '';
}

export function stage(t, board, now) {
	const e = t.estado ?? 'pendiente';
	if (e === 'comprobada' || e === 'cancelada') return 'hecha';
	if (e === 'hecha' || e === 'unida' || e === 'en revision') return 'revision';
	// T172: a locked pendiente task (claimed before claim moved it to en curso) is running too.
	if (e === 'en curso' || (e === 'pendiente' && Boolean(t.candado))) return 'curso';
	if (e === 'bloqueada') return 'bloqueada';
	return requisitos(t, board, now).every((r) => r.ok) ? 'lista' : 'bloqueada';
}

/**
 * The owner must act: they are the actor, or the task touches main, Production, migrations or secrets. d282:
 * on a session task `toca` only marks an owner step later, so the session still claims, closes and reviews it.
 */
export const needsOwner = (t) =>
	t.actor === 'dueno' || (t.actor !== 'sesion' && (t.toca ?? []).length > 0);

export function capacidades(agente, board) {
	const own = (board.agentes ?? []).find((a) => a.id === agente);
	return own?.capacidades ?? DEFAULT_CAPACIDADES[agente] ?? [];
}

/** Whether `agente` can finish the task alone: it has every capability in `requiere`. */
export function canFinish(t, agente, board) {
	if (!Object.hasOwn(AGENT_REGISTRY, agente)) return false;
	const has = new Set(capacidades(agente, board));
	return (t.requiere ?? []).every((c) => has.has(c));
}

/** Same eligibility predicate for discovery and the locked claim transaction. */
export function claimable(t, agente, board, now) {
	return (
		stage(t, board, now) === 'lista' &&
		!needsOwner(t) &&
		(t.agente === agente || !t.agente || t.agente === 'cualquiera') &&
		canFinish(t, agente, board)
	);
}

/** Agents the task is for: its own `agente`, or every known agent when it is «cualquiera» or unset. */
export function agentsFor(t) {
	return t.agente && t.agente !== 'cualquiera'
		? [t.agente]
		: AGENTES.filter((a) => a !== 'cualquiera');
}

/** Agents that start a ready task without the owner (`pnpm board next`); Codex and Gemini wait for a paste. */
export const SELF_STARTING = ['claude'];

/**
 * The agents whose chat the owner pastes the prompt into (d169): a ready, unlocked task no self-starting agent
 * can finish, but Codex or Gemini can. Empty otherwise, so a «cualquiera» task Claude can finish stays violet.
 */
export function ownerLaunches(t, board, now) {
	if (stage(t, board, now) !== 'lista' || needsOwner(t) || t.actor === 'coordinador' || t.candado)
		return [];
	// d249: a prompt the owner already pasted waits for its claim, until it is DELIVERY_STALE_MINUTES old.
	if (awaitingClaim(t, now)) return [];
	const able = agentsFor(t).filter((a) => canFinish(t, a, board));
	return able.some((a) => SELF_STARTING.includes(a)) ? [] : able;
}

/**
 * Color: own (green, the owner's turn, including a paste into Codex or Gemini), auto (violet, an agent
 * starts and finishes it alone), block (gray), run, rev, done. A ready task no agent can finish is gray too.
 * With `agente`, autonomy is judged for that agent only.
 */
export function color(t, board, { agente, now } = {}) {
	const s = stage(t, board, now);
	if (s !== 'lista')
		return { bloqueada: 'block', curso: 'run', revision: 'rev', hecha: 'done' }[s];
	if (needsOwner(t)) return 'own';
	if (t.actor === 'coordinador') return 'auto';
	const who = agente && agente !== 'cualquiera' ? [agente] : agentsFor(t);
	const paste = ownerLaunches(t, board, now);
	if (who.some((a) => paste.includes(a))) return 'own';
	return who.some((a) => canFinish(t, a, board)) ? 'auto' : 'block';
}

export const isOpen = (t, board, now) =>
	['lista', 'bloqueada', 'curso'].includes(stage(t, board, now));

/**
 * d276: the date a pending task waits for when dates are its only unmet requisitos (the latest one), or null.
 * Such a task leaves the queue for the «Calendario» and comes back on its own that day; a task that also
 * waits for another task, a decision or its prompt stays in the queue as blocked.
 */
export function calendarDate(t, board, now = Date.now()) {
	if ((t.estado ?? 'pendiente') !== 'pendiente' || t.candado) return null;
	const unmet = requisitos(t, board, now).filter((r) => !r.ok);
	if (unmet.some((r) => r.tipo === 'fecha' && Number.isNaN(time(r.ref)))) return null;
	if (!unmet.length || unmet.some((r) => r.tipo !== 'fecha')) return null;
	return unmet
		.map((r) => r.ref)
		.sort((a, b) => time(a) - time(b))
		.at(-1);
}
export const onCalendar = (t, board, now) => calendarDate(t, board, now) !== null;

/**
 * T258: an open task blocked by something other than a date (a task, a decision, its prompt, an answer, or a
 * manual «bloqueada»). It leaves the queue for the «Bloqueadas» tab and comes back on its own once unblocked.
 */
export const isBlocked = (t, board, now) =>
	stage(t, board, now) === 'bloqueada' && !onCalendar(t, board, now);

const depIds = (t) => (t.requisitos ?? []).filter((r) => r.tipo === 'tarea').map((r) => r.ref);
const urgRank = (u) => (URGENCIAS.includes(u) ? URGENCIAS.indexOf(u) : 2);

/**
 * The numbered queue of ready and running tasks: the owner's ready tasks (d163) → urgency → free lane before
 * busy or none (`laneRank`) → ready before blocked → due date (`hasta`) → `orden` → title, then a pass so a task never comes before one
 * it waits for. Blocked tasks (`isBlocked`) order that pass but are left out.
 */
export function queue(board, now = Date.now()) {
	// d276: a task that only waits for a date sits in the «Calendario» until that day.
	const open = (board.tareas ?? []).filter(
		(t) => isOpen(t, board, now) && !onCalendar(t, board, now),
	);
	const ids = new Set(open.map((t) => t.id));
	const key = (t) => [
		color(t, board, { now }) === 'own' ? 0 : 1,
		urgRank(t.urgencia),
		laneRank(t, board),
		stage(t, board, now) === 'bloqueada' ? 1 : 0,
		Number.isNaN(time(t.hasta)) ? 9e15 : time(t.hasta),
		t.orden ?? 999,
	];
	const rest = open.slice().sort((a, b) => {
		const x = key(a);
		const y = key(b);
		for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
		return String(a.titulo).localeCompare(String(b.titulo));
	});
	const byId = Object.fromEntries(open.map((t) => [t.id, t]));
	const out = [];
	const seen = new Set();
	// An open task it waits for goes right before it, so urgency carries over to its prerequisites.
	const place = (t) => {
		if (seen.has(t.id)) return;
		seen.add(t.id);
		for (const d of depIds(t)) if (ids.has(d)) place(byId[d]);
		out.push(t);
	};
	for (const t of rest) place(t);
	// T258: blocked tasks still lift their prerequisites above, then leave for the «Bloqueadas» tab.
	return out.filter((t) => !isBlocked(t, board, now));
}

/**
 * Answers the owner owes now (d163): unmet «dueno» requisites of open tasks whose date and task
 * requisites are already met, so an answer that is not due yet stays out of sight.
 */
export function ownerAsks(board, now = Date.now()) {
	// T258: a task waiting for the owner's answer is blocked, so it sits outside the queue.
	const waiting = (board.tareas ?? []).filter((t) => isBlocked(t, board, now));
	return [...queue(board, now), ...waiting].flatMap((t) => {
		const reqs = requisitos(t, board, now);
		if (reqs.some((r) => (r.tipo === 'fecha' || r.tipo === 'tarea') && !r.ok)) return [];
		return reqs.filter((r) => r.tipo === 'dueno' && !r.ok).map((r) => ({ t, r }));
	});
}

const fold = (s) =>
	String(s ?? '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();

/**
 * Search box match (d167): «T34» names task 34 exactly (never T340); any other query must find every word
 * in the id, title or «ahora», ignoring case and accents.
 */
export function matches(t, q) {
	const query = fold(q).trim();
	if (!query) return true;
	const n = /^t(\d+)$/.exec(query);
	if (n) return t.num !== undefined && Number(t.num) === Number(n[1]);
	const text = fold([t.id, t.titulo, t.ahora].join(' '));
	return query.split(/\s+/).every((w) => text.includes(w));
}

/** Whether the task shows under an agent tab: «libres» are unlocked tasks for any agent. */
export function inTab(t, tab) {
	if (!tab || tab === 'todas') return true;
	if (tab === 'libres') return !t.candado && (!t.agente || t.agente === 'cualquiera');
	return t.agente === tab || ((!t.agente || t.agente === 'cualquiera') && !t.candado);
}

/** The next task an agent should take: the first ready, unlocked, autonomous one it can finish. */
export function nextFor(agente, board, now = Date.now()) {
	return (
		queue(board, now).find(
			(t) => claimable(t, agente, board, now) && !t.candado && t.actor !== 'coordinador',
		) ?? null
	);
}

/** Board lane where read-only tasks run by default: the Integration checkout. */
export const READONLY_LANE = 'integration';

/** Whether `t` is a read-only task: a cross-review, or one marked `soloLectura`. */
export const isReadOnly = (t) => Boolean(isReview(t) || t?.soloLectura);

/**
 * The lane a task sits in: READONLY_LANE for a read-only task (it never takes another), else its lock's,
 * else the planned one (d177), else its recorded `carril`.
 */
export const taskLane = (t) =>
	isReadOnly(t) ? READONLY_LANE : (t?.candado?.carril ?? t?.carrilPlaneado ?? t?.carril);

const HEADING = /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.:]{3,}$/;

/**
 * H13: canonical lanes (`lanes`: WORKTREE_LANES) the prompt names other than the task's own lane. Only its
 * «DÓNDE CORRE» section counts when it has one, so a prompt may still mention another lane elsewhere.
 */
export function promptLanes(t, lanes) {
	const own = taskLane(t);
	if (!own || typeof t.prompt !== 'string') return [];
	let lines = t.prompt.split('\n').map((l) => l.trim());
	// A prompt-v1 (T160) says where it runs in ANTES DE EMPEZAR and in METADATOS «carril:».
	if (isPromptV1(t.prompt))
		lines = [
			...(promptSection(t.prompt, 'ANTES DE EMPEZAR') ?? []),
			...(promptSection(t.prompt, 'METADATOS') ?? []).filter((l) => l.startsWith('carril:')),
		];
	const at = lines.findIndex((l) => /^D[OÓ]NDE CORRE\b/.test(l));
	if (at >= 0) {
		lines = lines.slice(at + 1);
		const next = lines.findIndex((l) => HEADING.test(l));
		if (next >= 0) lines = lines.slice(0, next);
	}
	const text = lines.join('\n');
	return lanes
		.filter((l) => l.segment && l.id !== own)
		.filter((l) => new RegExp(`(?<![a-z0-9-])${l.id}(?![a-z0-9-])`).test(text))
		.map((l) => l.id);
}

/**
 * Whether `carril` is a canonical lane this task may use (`lanes`: WORKTREE_LANES, passed in so the view needs
 * no Node module); Integration only for coordinator tasks.
 */
export const laneAllowed = (carril, task, lanes) =>
	lanes.some((lane) => lane.id === carril && (lane.segment || task.actor === 'coordinador'));

/** Folder of a lane relative to the repository's parent directory (d177): never an absolute path. */
export const laneFolder = (id) =>
	id === READONLY_LANE ? 'celebra-me' : `celebra-me-worktrees/${id}`;

/**
 * d191: a task's `categoria` names the lane it prefers, never one it must use. Each category is the use of one
 * lane from f05 to f12; the board and other tooling go in f10-libre.
 */
export const CATEGORIA_CARRIL = {
	plataforma: 'f05-plataforma',
	landing: 'f06-landing',
	invitaciones: 'f07-invitaciones',
	demos: 'f08-demos',
	docs: 'f09-docs',
	herramientas: 'f10-libre',
	preview: 'f11-preview',
	release: 'f12-release',
};
export const CATEGORIAS = Object.keys(CATEGORIA_CARRIL);
/** The task lanes f05–f12, in order: the ones a suggestion picks from. */
const TASK_LANES = Object.values(CATEGORIA_CARRIL);

/** Another task whose lock holds `lane`, or null. Same predicate as claim: any lock counts, also one left on a finished task before its release. */
export function laneHolder(lane, board, exceptId) {
	return (
		(board.tareas ?? []).find((x) => x.id !== exceptId && x.candado?.carril === lane) ?? null
	);
}

/** Another task whose lock holds the lane `t` is planned in, or null (d177). */
export function laneBusy(t, board) {
	return t.carrilPlaneado ? laneHolder(t.carrilPlaneado, board, t.id) : null;
}

/** The warning a planned lane outside the task's category gets, without refusing it (d191). */
export function categoryMismatch(t, carril) {
	const preferred = CATEGORIA_CARRIL[t.categoria];
	if (!carril || !preferred || carril === preferred) return null;
	return `aviso: ${carril} no es el carril de su categoría ${t.categoria} (${preferred})`;
}

/**
 * The lane `next` suggests for a task with no planned lane and no lock (d191): its category's lane when free,
 * else the first free one from f05 to f12; null when none is free or nothing applies.
 */
export function suggestedLane(t, board) {
	if (isReadOnly(t) || t.carrilPlaneado || t.candado) return null;
	const preferred = CATEGORIA_CARRIL[t.categoria];
	if (preferred && !laneHolder(preferred, board, t.id))
		return { carril: preferred, propio: true };
	const free = TASK_LANES.find((lane) => !laneHolder(lane, board, t.id));
	return free ? { carril: free, propio: false } : null;
}

/** Where a review runs: it has no planned lane (d177) and reads the Integration checkout only. */
export const REVIEW_RUNS = `Corre en: Integración (carpeta ${laneFolder('integration')}), solo lectura`;

/**
 * Queue rank of a task's lane, preferring its category's (d191): 0 runs in its category's lane, free (so do
 * a review, the lane its own lock holds, and a free planned lane of a task without category); 1 another free
 * planned lane; 2 a lane another task's lock holds; 3 no lane to run in.
 */
export function laneRank(t, board) {
	if (isReadOnly(t) || t.candado?.carril) return 0;
	const preferred = CATEGORIA_CARRIL[t.categoria];
	if (t.carrilPlaneado) {
		if (laneBusy(t, board)) return 2;
		return !preferred || t.carrilPlaneado === preferred ? 0 : 1;
	}
	if (!preferred) return 3;
	return laneHolder(preferred, board, t.id) ? 2 : 0;
}

const pasteLine = (t, lane) => {
	const paste = agentsFor(t).filter((a) => a !== 'claude' && Object.hasOwn(AGENT_REGISTRY, a));
	return paste.length
		? [`${paste.map((a) => AGENT_REGISTRY[a].nombre).join(' o ')}: abra el proyecto ${lane}`]
		: [];
};

/** «Carril sugerido» lines of a task without a planned lane (d191), or none. */
function suggestionLines(t, board) {
	const preferred = CATEGORIA_CARRIL[t.categoria];
	const s = suggestedLane(t, board);
	const holder = preferred && !s?.propio ? laneHolder(preferred, board, t.id) : null;
	const why = holder
		? `; ${preferred} de su categoría ${t.categoria} está ocupado por ${taskTag(holder)}`
		: '';
	if (!s)
		return holder
			? [`${preferred.split('-')[0]} ocupado por ${taskTag(holder)}; ningún carril libre`]
			: [];
	const head = s.propio
		? `Carril sugerido: ${s.carril} (categoría ${t.categoria}), libre`
		: `Carril sugerido: ${s.carril}, libre${why || (preferred ? '' : ' (tarea sin categoría)')}`;
	return [`${head} · carpeta ${laneFolder(s.carril)}`, ...pasteLine(t, s.carril)];
}

/**
 * The «Corre en» lines of a review or a task planned in a lane, for the card, `show`, `plan`, `next` and a
 * pasted prompt; an unlocked planned task also says whether its lane is free, any planned task warns when it
 * is not its category's lane, and an unplanned one gets a suggestion.
 */
export function laneLines(t, board) {
	if (t.actor === 'dueno') return ownerWhereLines(t);
	if (isReadOnly(t)) return [REVIEW_RUNS];
	const lane = t.carrilPlaneado;
	if (!lane) return suggestionLines(t, board);
	const lines = [`Corre en: ${lane} · carpeta ${laneFolder(lane)}`, ...pasteLine(t, lane)];
	const busy = laneBusy(t, board);
	if (busy)
		lines.push(`${lane.split('-')[0]} ocupado por ${taskTag(busy)}; espere o pida otro carril`);
	else if (!t.candado) lines.push('carril libre');
	const mismatch = categoryMismatch(t, lane);
	return mismatch ? [...lines, mismatch] : lines;
}

/**
 * Where the owner does an owner task (T126): its `donde`, else the first line of its prompt's «DÓNDE CORRE»,
 * for example «En la app de Claude, sesión f07 · T112»; never a lane suggestion or a paste line.
 */
export function ownerWhere(t) {
	if (typeof t.donde === 'string' && t.donde.trim()) return t.donde.trim();
	const lines = String(t.prompt ?? '').split('\n');
	const at = lines.findIndex((l) => /^D[OÓ]NDE CORRE\b/.test(l.trim()));
	const first = at < 0 ? '' : (lines.slice(at + 1).find((l) => l.trim()) ?? '');
	return first.trim() && !HEADING.test(first.trim()) ? first.trim() : null;
}
const ownerWhereLines = (t) => {
	const where = ownerWhere(t);
	return where ? [`Dónde: ${where}`] : [];
};

/**
 * The prompt an agent receives, with the planned lane so nobody has to repeat it by hand: a prompt-v1 (T160)
 * keeps its session name on line 1, gets the pre-push check under AL TERMINAR when it pushes a branch (d246)
 * and the lane as `corre:` lines in METADATOS; a legacy prompt gets a leading `CARRIL` block.
 */
export function promptWithLane(t, board) {
	if (!t.prompt || t.actor === 'dueno') return t.prompt;
	const lines = laneLines(t, board);
	const prompt = isPromptV1(t.prompt)
		? withRunLines(withBoardAccess(withPushCheck(t.prompt)), lines)
		: lines.length
			? `CARRIL\n${lines.join('\n')}\n\n${t.prompt}`
			: t.prompt;
	return answerPrompt(t, board, prompt);
}

const isDate = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));
const subsetOf = (list, allowed) => Array.isArray(list) && list.every((x) => allowed.includes(x));

const optional = (v, ok) => v === undefined || ok(v);

/** Merged always needs a PR; under review only when the task has a branch (audits ship none). */
const needsPr = (t) => t.estado === 'unida' || (t.estado === 'en revision' && !!t.rama);

const validLock = (c) =>
	AGENTES.includes(c?.agente) &&
	c.agente !== 'cualquiera' &&
	isDate(c.desde) &&
	optional(c.latido, isDate);

/** The PR invariant, also enforced on legacy records whenever a write touches pr, estado or rama. */
const PR_CHECKS = [
	[
		(t) => !optional(t.pr, (p) => /^#[1-9]\d*$/.test(p)),
		(t) =>
			isForeignPull(t.pr)
				? 'pr de otro repositorio: use un PR de fm-dev-mx/celebra-me'
				: 'pr debe ser #<número>',
	],
	[(t) => needsPr(t) && !t.pr, (t) => `${t.estado} requiere pr=#<número>`],
];

/** PR problems of a task, without the other shape checks. */
export const prIssues = (t) => PR_CHECKS.filter(([bad]) => bad(t)).map(([, msg]) => msg(t));

/** Field checks: [problem, message] where `problem(t)` is true when the field is wrong. */
/** T130: hand-written lists a typed task adds to its kind's prompt sections. */
export const KIND_LISTS = ['lee', 'pasos', 'autorizo', 'noHagas', 'decisiones'];

/** Whether `t` must carry a `tipo`: a session task created under contrato 3 or later, except a review round. */
const needsKind = (t) =>
	Number.isInteger(t.contrato) && t.contrato >= 3 && t.actor === 'sesion' && !isReview(t);

const FIELD_CHECKS = [
	[(t) => !String(t.titulo ?? '').trim(), () => 'falta titulo'],
	[(t) => !ESTADOS.includes(t.estado ?? 'pendiente'), (t) => `estado desconocido: ${t.estado}`],
	[(t) => !URGENCIAS.includes(t.urgencia), () => `urgencia debe ser ${URGENCIAS.join('/')}`],
	[(t) => !ACTORES.includes(t.actor), () => `actor debe ser ${ACTORES.join('/')}`],
	[
		(t) => !optional(t.agente, (a) => AGENTES.includes(a)),
		() => `agente debe ser ${AGENTES.join('/')}`,
	],
	[
		(t) => !optional(t.toca, (x) => subsetOf(x, TOCA)),
		() => `toca debe ser lista de ${TOCA.join('/')}`,
	],
	[
		(t) =>
			!optional(t.requiere, (x) => Array.isArray(x) && x.every((c) => typeof c === 'string')),
		() => 'requiere debe ser lista de capacidades',
	],
	[
		(t) => t.espera !== undefined || t.deps !== undefined,
		() => 'espera y deps ya no existen: use requisitos',
	],
	[
		(t) => !Array.isArray(t.requisitos),
		() => 'requisitos debe ser una lista (vacía si no espera nada)',
	],
	[(t) => !optional(t.candado, validLock), () => 'candado debe ser {agente, desde}'],
	[
		(t) => !optional(t.carrilPlaneado, (c) => typeof c === 'string' && /^[a-z0-9-]+$/.test(c)),
		() => 'carrilPlaneado debe ser el id de un carril',
	],
	[
		(t) => !optional(t.vuelta, (n) => Number.isInteger(n) && n >= 1),
		() => 'vuelta debe ser un entero desde 1',
	],
	[
		(t) => !optional(t.contrato, (n) => Number.isInteger(n) && n >= 1),
		() => 'contrato debe ser un entero desde 1',
	],
	[
		(t) => !optional(t.categoria, (c) => CATEGORIAS.includes(c)),
		() => `categoria debe ser ${CATEGORIAS.join('/')}`,
	],
	[(t) => !optional(t.tipo, (k) => TIPOS.includes(k)), () => `tipo debe ser ${TIPOS.join('/')}`],
	// T130: a session task created under contrato 3 says what it does, and a typed task writes only busca.
	[
		(t) => needsKind(t) && t.tipo === undefined,
		() => `falta tipo=${TIPOS.join('|')} (contrato 3)`,
	],
	[
		(t) =>
			t.tipo !== undefined &&
			!isReview(t) &&
			!String(t.busca ?? '').includes('Terminado cuando:'),
		() => 'una tarea con tipo necesita busca=… con «Terminado cuando:» (su QUÉ SE BUSCA)',
	],
	[(t) => !optional(t.busca, (s) => typeof s === 'string'), () => 'busca debe ser texto'],
	[
		(t) => !optional(t.corto, (s) => typeof s === 'string' && s.trim()),
		() => 'corto debe ser texto',
	],
	...ownerFieldChecks,
	...KIND_LISTS.map((k) => [
		(t) =>
			!optional(
				t[k],
				(x) => Array.isArray(x) && x.every((s) => typeof s === 'string' && s.trim()),
			),
		() => `${k} debe ser una lista de texto`,
	]),
	...PR_CHECKS,
	[(t) => !optional(t.hasta, isDate), () => 'hasta no es fecha'],
	// d174: a subtask names its mother task (padre) and/or initiative (grupo), with an optional phase.
	[
		(t) => !optional(t.padre, (p) => typeof p === 'string' && p.trim()),
		() => 'padre debe ser el id de la tarea madre',
	],
	[(t) => t.padre !== undefined && t.padre === t.id, () => 'padre no puede ser la misma tarea'],
	[
		(t) => !optional(t.grupo, (g) => typeof g === 'string' && g.trim()),
		() => 'grupo debe ser texto',
	],
	[
		(t) => !optional(t.fase, (n) => Number.isInteger(n) && n >= 1),
		() => 'fase debe ser un entero desde 1',
	],
	// d268: a periodic task's `cada`, the rule of recurring.mjs's CADA_RE.
	[(t) => !optional(t.cada, (c) => /^[1-9]\d*d$/.test(c)), () => 'cada debe ser <n>d (7d)'],
	[(t) => !optional(t.archivada, isDate), () => 'archivada no es fecha'],
	[
		(t) => t.archivada !== undefined && !isFinished(t),
		() => 'archivada solo en tareas finalizadas',
	],
	// d046: every prompt asks all owner decisions in one round at the start.
	[
		(t) => t.prompt && !t.prompt.includes('\nDECISIONES\n'),
		() => 'prompt sin sección DECISIONES (d046)',
	],
	[(t) => !Number.isInteger(t.rev) || t.rev < 1, () => 'rev debe ser un entero desde 1'],
	[(t) => !isDate(t.actualizado), () => 'actualizado no es fecha'],
];

const strList = (x) => Array.isArray(x) && x.every((s) => typeof s === 'string' && s.trim());

/**
 * Shape of `cierre {resumen, pr?, commit?, comprobaciones, saltadas, pendientes, en, quien?}` (d178), plus the
 * Handoff Contract lists and `resultado` (T129).
 */
export function cierreShapeIssues(c, t) {
	if (!c || typeof c !== 'object' || Array.isArray(c)) return ['cierre debe ser un objeto'];
	const out = [];
	const resumen = String(c.resumen ?? '').trim();
	if (!resumen) out.push('cierre sin resumen');
	else if (resumen.split('\n').length > 4) out.push('el resumen de cierre tiene más de 4 líneas');
	if (!optional(c.pr, (p) => /^#[1-9]\d*$/.test(p))) out.push('cierre.pr debe ser #<número>');
	if (!optional(c.commit, (s) => /^[a-f0-9]{7,40}$/.test(s)))
		out.push('cierre.commit debe ser un SHA');
	if (!strList(c.comprobaciones)) out.push('cierre.comprobaciones debe ser una lista de texto');
	if (!strList(c.saltadas)) out.push('cierre.saltadas debe ser una lista de texto');
	if (!Array.isArray(c.pendientes)) out.push('cierre.pendientes debe ser una lista');
	else
		for (const p of c.pendientes) {
			if (!String(p?.texto ?? '').trim()) out.push('pendiente de cierre sin texto');
			else if (!String(p.tarea ?? '').trim())
				out.push(`pendiente sin tarea: «${p.texto}» (escriba texto→T<n>)`);
		}
	if (!isDate(c.en)) out.push('cierre.en no es fecha');
	if (!optional(c.changelog, validChangelog))
		out.push('cierre.changelog debe ser {grupo, texto} de Keep a Changelog o «ninguno»');
	out.push(...handoffIssues(c, t));
	return out;
}

const shaLike = (s) => typeof s === 'string' && /^[a-f0-9]{7,40}$/.test(s);

/** Problems of a review's `resultado {veredicto, sha, hallazgos[{p, archivo, texto}]}` (T129). */
function reviewResultIssues(r, t) {
	const out = [];
	if (!VEREDICTOS.includes(r.veredicto))
		out.push(`resultado.veredicto debe ser ${VEREDICTOS.join('/')}`);
	if (!shaLike(r.sha)) out.push('resultado.sha debe ser el SHA revisado');
	else if (t.revisionSha && !t.revisionSha.startsWith(r.sha))
		out.push(`resultado.sha ${r.sha} no es el SHA revisado (${t.revisionSha.slice(0, 7)})`);
	if (!Array.isArray(r.hallazgos)) return [...out, 'resultado.hallazgos debe ser una lista'];
	for (const h of r.hallazgos) {
		const ok =
			PRIORIDADES.includes(h?.p) &&
			String(h.archivo ?? '').trim() &&
			String(h.texto ?? '').trim();
		if (!ok) out.push('hallazgo inválido: escriba --hallazgo="P0-P3|archivo|texto"');
		else if (r.veredicto === 'aprobado' && (h.p === 'P0' || h.p === 'P1'))
			out.push(`una revisión aprobada no tiene hallazgos ${h.p}`);
	}
	return out;
}

/** Problems of a code task's `resultado {pr, sha, nivel}` (T129). */
function codeResultIssues(r) {
	const out = [];
	if (!optional(r.pr, (p) => /^#[1-9]\d*$/.test(p))) out.push('resultado.pr debe ser #<número>');
	if (!shaLike(r.sha)) out.push('resultado.sha debe ser el SHA del PR (--sha)');
	if (!NIVELES.includes(r.nivel)) out.push(`resultado.nivel debe ser ${NIVELES.join('/')}`);
	return out;
}

/** The kind of `resultado` a task returns, none once cancelled. */
export const returnKind = (t) => (t.estado === 'cancelada' ? null : resultKind(t));

/** T129 shape of the Handoff Contract lists and of `resultado`, whenever present. */
function handoffIssues(c, t = {}) {
	const out = [];
	for (const [field] of HANDOFF_LISTS)
		if (c[field] !== undefined && !strList(c[field]))
			out.push(`cierre.${field} debe ser una lista de texto`);
	const r = c.resultado;
	if (r === undefined) return out;
	if (!r || typeof r !== 'object' || Array.isArray(r))
		return [...out, 'cierre.resultado debe ser un objeto'];
	const kind = returnKind(t);
	if (kind === 'revision' || (kind === null && r.veredicto !== undefined))
		out.push(...reviewResultIssues(r, t));
	else if (kind === 'codigo' || r.nivel !== undefined) out.push(...codeResultIssues(r));
	return out;
}

function requisitoIssue(r) {
	if (!REQUISITOS.includes(r?.tipo)) return `requisito de tipo desconocido: ${r?.tipo}`;
	if (!String(r.ref ?? '').trim()) return `requisito ${r.tipo} sin ref`;
	if (r.tipo === 'fecha' && !isDate(r.ref)) return `requisito fecha no es fecha: ${r.ref}`;
	return null;
}

/** Shape problems of an open task; `pnpm board` refuses a write that adds any, the verifier lists them. */
export function taskIssues(t) {
	const out = FIELD_CHECKS.filter(([bad]) => bad(t)).map(([, msg]) => msg(t));
	for (const r of Array.isArray(t.requisitos) ? t.requisitos : []) {
		const issue = requisitoIssue(r);
		if (issue) out.push(issue);
	}
	if (t.cierre !== undefined) out.push(...cierreShapeIssues(t.cierre, t));
	// T160: only a prompt marked «formato: prompt-v1» must follow it; legacy prompts keep working.
	if (typeof t.prompt === 'string') out.push(...promptV1Issues(t.prompt));
	return out;
}

/** States that close a task for good: its prompt, lane and lock leave it (d186); the closing summary stays. */
export const CLEANED_ON = new Set(['comprobada', 'unida']);

export function cleaned(task, opts) {
	if (!CLEANED_ON.has(task.estado)) return task;
	const t = task.candado ? unlocked(task, opts) : { ...task };
	delete t.prompt;
	delete t.carril;
	return t;
}

/** The task without its lock; the lock's session stays in `sesion` so it can still be found, renamed or archived. */
export function unlocked(task, flags) {
	const rest = { ...task };
	delete rest.candado;
	const { sesion: id, agente } = task.candado ?? {};
	if (!id) return rest;
	// The claim's --titulo (T126) is the session name when release or merged gives no --nombre.
	const nombre =
		typeof flags.nombre === 'string'
			? flags.nombre
			: (task.candado.titulo ?? (task.sesion?.id === id ? task.sesion.nombre : undefined));
	return { ...rest, sesion: { id, agente, ...(nombre ? { nombre } : {}) } };
}

/**
 * Version of the task contract a new task is created under (T126): `add` and `review` stamp it, so only tasks
 * created after it exist must follow it; open tasks without it keep the old rules. 1: `claim --titulo`.
 * 2: the T129 return contract of `close` (`missingReturn`). 3: a session task has a `tipo` and its prompt is
 * generated from it (T130).
 */
export const CONTRATO = 3;
