/**
 * Board v3 model shared by `pnpm board`, `pnpm board:verify` and the local view (rules: .agent/rules/board.md).
 * Pure functions only: no Node APIs, so the view imports this same file in the browser.
 */

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

/** Capabilities each agent has unless the store's `agentes/<id>.json` says otherwise. */
export const DEFAULT_CAPACIDADES = Object.fromEntries(
	Object.entries(AGENT_REGISTRY).map(([id, agent]) => [id, agent.capacidades]),
);

const SUCCESS = new Set(['hecha', 'unida', 'comprobada']);
/** Finished tasks (the «Finalizadas» tab): only these can be archived (d167). */
export const FINALIZADOS = ['hecha', 'unida', 'comprobada', 'cancelada'];
export const isFinished = (t) => FINALIZADOS.includes(t.estado);
/** An origin can also identify follow-up implementation work, not just a cross-review. */
export const isReview = (t) => Boolean(t.revisionSha) || String(t.id).endsWith('-revision');
const time = (s) => (s ? new Date(s).getTime() : Number.NaN);

/** The task a closing «pendiente» points to: `T58` by its number, anything else by id; null when absent. */
export function findTask(ref, board) {
	const all = [...(board.tareas ?? []), ...(board.archivo ?? [])];
	const n = /^T(\d+)$/i.exec(String(ref ?? '').trim());
	if (n) return all.find((x) => x.num !== undefined && Number(x.num) === Number(n[1])) ?? null;
	return all.find((x) => x.id === ref) ?? null;
}

/** `texto→T58` (or `texto->T58`) → `{ texto, tarea: 'T58' }`; a text without an arrow has no tarea. */
export function parsePendiente(s) {
	const text = String(s ?? '');
	const i = Math.max(text.lastIndexOf('→'), text.lastIndexOf('->'));
	if (i < 0) return { texto: text.trim(), tarea: '' };
	const arrow = text.startsWith('→', i) ? 1 : 2;
	return { texto: text.slice(0, i).trim(), tarea: text.slice(i + arrow).trim() };
}

/** Values of a repeatable flag; «ninguna»/«ninguno» alone means an empty list. */
function listFlag(lists, key) {
	const values = (lists[key] ?? []).filter((v) => typeof v === 'string' && v.trim());
	return values.length === 1 && /^ningun[oa]$/i.test(values[0].trim()) ? [] : values;
}

/**
 * The `cierre` that `pnpm board close` writes from its repeatable flags (`lists`: resumen, comprobacion, saltada,
 * pendiente): a flag not given keeps the previous value, and a pendiente's task is stored by its id.
 */
export function buildCierre(prev = {}, { flags, lists }, board, en) {
	const pick = (k) => (typeof flags[k] === 'string' ? flags[k] : undefined);
	const pr = pick('pr') && normalizePr(pick('pr'));
	const commit = pick('commit');
	const quien = pick('quien') ?? (flags.coordinador ? 'coordinador' : flags.agente);
	const given = (k, fallback) => (Object.hasOwn(lists, k) ? listFlag(lists, k) : fallback);
	const pendientes = given('pendiente', null)?.map((s) => {
		const p = parsePendiente(s);
		const d = p.tarea && findTask(p.tarea, board);
		return d ? { ...p, tarea: d.id } : p;
	});
	const cierre = {
		resumen: given('resumen', null)?.join('\n') ?? prev.resumen ?? '',
		comprobaciones: given('comprobacion', prev.comprobaciones ?? []),
		saltadas: given('saltada', prev.saltadas ?? []),
		pendientes: pendientes ?? prev.pendientes ?? [],
		en,
		...(quien ? { quien } : {}),
	};
	if (pr ?? prev.pr) cierre.pr = pr ?? prev.pr;
	if (commit ?? prev.commit) cierre.commit = commit ?? prev.commit;
	return cierre;
}

export const NO_CIERRE = 'Falta el resumen de cierre';

/** The CIERRE block of `pnpm board show`: the summary, and why «Archivar» is refused; empty for open tasks. */
export function cierreBlock(t, board) {
	if (!t.cierre && !isFinished(t)) return [];
	const why = !t.archivada && archiveBlock(t, board);
	return ['', 'CIERRE', ...cierreLines(t, board), ...(why ? [why] : [])].map((l, i) =>
		i > 1 ? `  ${l}` : l,
	);
}

/**
 * Problems of a task's closing summary (d178), checked against the board: missing, empty, or a «pendiente» that
 * does not point to another task on the board. Empty when «Archivar» may run.
 */
export function cierreIssues(t, board) {
	if (!t.cierre) return [NO_CIERRE];
	const out = cierreShapeIssues(t.cierre);
	for (const p of Array.isArray(t.cierre.pendientes) ? t.cierre.pendientes : []) {
		if (!String(p?.tarea ?? '').trim()) continue;
		const d = findTask(p.tarea, board);
		if (!d)
			out.push(`el pendiente «${p.texto}» apunta a ${p.tarea}, que no está en el tablero`);
		else if (d.id === t.id) out.push(`el pendiente «${p.texto}» apunta a la misma tarea`);
	}
	return out;
}

/** Why «Archivar» stays disabled (d178), or null. Unarchiving never needs it. */
export function archiveBlock(t, board) {
	const issues = cierreIssues(t, board);
	if (!issues.length) return null;
	return issues[0] === NO_CIERRE ? NO_CIERRE : `${NO_CIERRE}: ${issues.join('; ')}`;
}

/** The summary lines the card, the sheet and `show` print, without the task's title. */
export function cierreLines(t, board) {
	const c = t.cierre;
	if (!c) return [];
	const list = (xs, none) => (Array.isArray(xs) && xs.length ? xs.join(', ') : none);
	const ref = (p) => {
		const d = findTask(p.tarea, board);
		return d?.num ? `T${d.num}` : p.tarea || '¿?';
	};
	const pend = Array.isArray(c.pendientes) ? c.pendientes : [];
	const pr = c.pr ?? t.pr;
	const merged = [pr ? `PR ${pr}` : '', c.commit].filter(Boolean).join(', ');
	return [
		`${t.estado ?? 'pendiente'}${merged ? ` (${merged})` : ''}`,
		`Hecho: ${c.resumen}`,
		`Comprobaciones: ${list(c.comprobaciones, 'ninguna')}. Saltadas: ${list(c.saltadas, 'ninguna')}.`,
		pend.length
			? `Pendiente: ${pend.map((p) => `${p.texto} → ${ref(p)}`).join('; ')}`
			: 'Pendiente: ninguno.',
	];
}

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
			const d = tareas.find((x) => x.id === r.ref);
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

export function stage(t, board, now) {
	const e = t.estado ?? 'pendiente';
	if (e === 'comprobada' || e === 'cancelada') return 'hecha';
	if (e === 'hecha' || e === 'unida' || e === 'en revision') return 'revision';
	if (e === 'en curso') return 'curso';
	if (e === 'bloqueada') return 'bloqueada';
	return requisitos(t, board, now).every((r) => r.ok) ? 'lista' : 'bloqueada';
}

/** The owner must act: they are the actor, or the task touches main, Production, migrations or secrets. */
export const needsOwner = (t) => t.actor === 'dueno' || (t.toca ?? []).length > 0;

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
const depIds = (t) => (t.requisitos ?? []).filter((r) => r.tipo === 'tarea').map((r) => r.ref);
const urgRank = (u) => (URGENCIAS.includes(u) ? URGENCIAS.indexOf(u) : 2);

/**
 * The numbered queue: the owner's ready tasks (d163) → urgency → ready before blocked → due date (`hasta`) →
 * `orden` → title, then a pass so a task never comes before one it waits for.
 */
export function queue(board, now = Date.now()) {
	const open = (board.tareas ?? []).filter((t) => isOpen(t, board, now));
	const ids = new Set(open.map((t) => t.id));
	const key = (t) => [
		color(t, board, { now }) === 'own' ? 0 : 1,
		urgRank(t.urgencia),
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
	return out;
}

/**
 * Answers the owner owes now (d163): unmet «dueno» requisites of open tasks whose date and task
 * requisites are already met, so an answer that is not due yet stays out of sight.
 */
export function ownerAsks(board, now = Date.now()) {
	return queue(board, now).flatMap((t) => {
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

/** Folder of a lane relative to the repository's parent directory (d177): never an absolute path. */
export const laneFolder = (id) =>
	id === 'integration' ? 'celebra-me' : `celebra-me-worktrees/${id}`;

/**
 * Another task whose lock holds the lane `t` is planned in, or null (d177). Same predicate as claim: any lock
 * counts, also one left on a finished task before its release.
 */
export function laneBusy(t, board) {
	const lane = t.carrilPlaneado;
	if (!lane) return null;
	return (board.tareas ?? []).find((x) => x.id !== t.id && x.candado?.carril === lane) ?? null;
}

/** The «Corre en» lines of a task planned in a lane, for the card, `show`, `next` and a pasted prompt. */
export function laneLines(t, board) {
	const lane = t.carrilPlaneado;
	if (!lane) return [];
	const lines = [`Corre en: ${lane} · carpeta ${laneFolder(lane)}`];
	const paste = agentsFor(t).filter((a) => a !== 'claude' && Object.hasOwn(AGENT_REGISTRY, a));
	if (paste.length)
		lines.push(
			`${paste.map((a) => AGENT_REGISTRY[a].nombre).join(' o ')}: abra el proyecto ${lane}`,
		);
	const busy = laneBusy(t, board);
	if (busy)
		lines.push(
			`${lane.split('-')[0]} ocupado por ${busy.num ? `T${busy.num}` : busy.id}; espere o pida otro carril`,
		);
	return lines;
}

/** The prompt an agent receives: the planned lane first, so nobody has to repeat it by hand. */
export function promptWithLane(t, board) {
	const lines = laneLines(t, board);
	if (!t.prompt || !lines.length) return t.prompt;
	return `CARRIL\n${lines.join('\n')}\n\n${t.prompt}`;
}

const isDate = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));
const subsetOf = (list, allowed) => Array.isArray(list) && list.every((x) => allowed.includes(x));

const optional = (v, ok) => v === undefined || ok(v);

/** Merged always needs a PR; under review only when the task has a branch (audits ship none). */
const needsPr = (t) => t.estado === 'unida' || (t.estado === 'en revision' && !!t.rama);

const OWN_PULL = /^(?:https?:\/\/)?github\.com\/fm-dev-mx\/celebra-me\/pull\/([1-9]\d*)\/?$/;
const isForeignPull = (p) => /\/pull\/\d+/.test(String(p)) && !OWN_PULL.test(String(p).trim());

/** Canonical `#N` from 398, "398", "#398" or this repository's pull URL; anything else stays. */
export function normalizePr(pr) {
	if (pr === undefined || pr === null || String(pr).trim() === '') return undefined;
	const s = String(pr).trim();
	const m = s.match(/^#?([1-9]\d*)$/) ?? s.match(OWN_PULL);
	return m ? `#${m[1]}` : pr;
}
const validLock = (c) =>
	AGENTES.includes(c?.agente) && c.agente !== 'cualquiera' && isDate(c.desde);

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
	...PR_CHECKS,
	[(t) => !optional(t.hasta, isDate), () => 'hasta no es fecha'],
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

/** Shape of `cierre {resumen, pr?, commit?, comprobaciones, saltadas, pendientes, en, quien?}` (d178). */
function cierreShapeIssues(c) {
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
	if (t.cierre !== undefined) out.push(...cierreShapeIssues(t.cierre));
	return out;
}
