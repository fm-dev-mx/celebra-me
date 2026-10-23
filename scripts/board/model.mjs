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
const time = (s) => (s ? new Date(s).getTime() : Number.NaN);

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

/**
 * Color: own (green, the owner's turn), auto (violet, an agent finishes it alone), block (gray), run, rev, done.
 * A ready task no agent can finish is gray too. With `agente`, autonomy is judged for that agent only.
 */
export function color(t, board, { agente, now } = {}) {
	const s = stage(t, board, now);
	if (s !== 'lista')
		return { bloqueada: 'block', curso: 'run', revision: 'rev', hecha: 'done' }[s];
	if (needsOwner(t)) return 'own';
	if (t.actor === 'coordinador') return 'auto';
	const who = agente && agente !== 'cualquiera' ? [agente] : agentsFor(t);
	return who.some((a) => canFinish(t, a, board)) ? 'auto' : 'block';
}

export const isOpen = (t, board, now) =>
	['lista', 'bloqueada', 'curso'].includes(stage(t, board, now));
const depIds = (t) => (t.requisitos ?? []).filter((r) => r.tipo === 'tarea').map((r) => r.ref);
const urgRank = (u) => (URGENCIAS.includes(u) ? URGENCIAS.indexOf(u) : 2);

/**
 * The numbered queue: urgency → ready before blocked → due date (`hasta`) → `orden` → title, then a pass so a
 * task never comes before one it waits for.
 */
export function queue(board, now = Date.now()) {
	const open = (board.tareas ?? []).filter((t) => isOpen(t, board, now));
	const ids = new Set(open.map((t) => t.id));
	const key = (t) => [
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

const isDate = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));
const subsetOf = (list, allowed) => Array.isArray(list) && list.every((x) => allowed.includes(x));

const optional = (v, ok) => v === undefined || ok(v);
const validLock = (c) =>
	AGENTES.includes(c?.agente) && c.agente !== 'cualquiera' && isDate(c.desde);

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
	[(t) => !optional(t.hasta, isDate), () => 'hasta no es fecha'],
	// d046: every prompt asks all owner decisions in one round at the start.
	[
		(t) => t.prompt && !t.prompt.includes('\nDECISIONES\n'),
		() => 'prompt sin sección DECISIONES (d046)',
	],
	[(t) => !Number.isInteger(t.rev) || t.rev < 1, () => 'rev debe ser un entero desde 1'],
	[(t) => !isDate(t.actualizado), () => 'actualizado no es fecha'],
];

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
	return out;
}
