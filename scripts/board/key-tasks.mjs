/**
 * The «Clave» view of the Mapa (T482): the few open tasks that matter most right now, ranked by a pure score over
 * the board and its dependency graph (dependency-graph.mjs). Shared by the view payload; no I/O.
 *
 * A task takes the first reason that applies, in this order:
 * 1. owner: it waits on an unmet dueño/decisión step; the step's `desbloquea` ranks it.
 * 2. unlocks: other open tasks wait on it, directly or down a chain.
 * 3. urgent: urgencia urgente/alta, or a due date (`hasta`) within KEY_DUE_DAYS or already past.
 * 4. stuck: bloqueada with nothing to wait for, en revision for over KEY_REVIEW_HOURS, or a pasted prompt nobody
 *    claimed (delivery vencida).
 * Within a reason: more desbloquea first, then urgency, then the nearer due date, then the task number.
 */
import { delivery } from './delivery.mjs';
import { isFinished, requisitos, URGENCIAS } from './model.mjs';

export const KEY_LIMIT = 7;
export const KEY_DUE_DAYS = 3;
export const KEY_REVIEW_HOURS = 24;
const HOUR_MS = 3_600_000;

const time = (s) => Date.parse(s ?? '');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** When the task last moved: its lock, its closing, or its last edit. */
const since = (t) => t.candado?.desde ?? t.cierre?.en ?? t.actualizado;

function dueText(t, now) {
	const due = time(t.hasta);
	if (Number.isNaN(due) || due - now > KEY_DUE_DAYS * 24 * HOUR_MS) return null;
	if (due < now) return 'su fecha límite ya pasó';
	const days = Math.ceil((due - now) / (24 * HOUR_MS));
	return `vence en ${plural(days, 'día', 'días')}`;
}

function stuckText(t, reqs, now) {
	if (t.estado === 'bloqueada' && reqs.every((r) => r.ok))
		return 'bloqueada sin motivo: no espera nada';
	if (t.estado === 'en revision' && now - time(since(t)) > KEY_REVIEW_HOURS * HOUR_MS)
		return `en revisión hace más de ${KEY_REVIEW_HOURS} h`;
	const d = delivery(t, now);
	if (d?.vencida) return `entregada a ${d.agente} y nadie la tomó`;
	return null;
}

/** The reason one open task is key, or null: `{nivel, motivo, desbloquea}`. */
function reasonOf(t, ctx) {
	const { nodes, roots, now } = ctx;
	const own = roots.get(t.id) ?? [];
	if (own.length) {
		const top = own.reduce((a, b) => (b.desbloquea > a.desbloquea ? b : a));
		const more =
			top.desbloquea > 1 ? ` · destraba ${plural(top.desbloquea, 'tarea', 'tareas')}` : '';
		return { nivel: 1, motivo: `${top.texto}${more}`, desbloquea: top.desbloquea };
	}
	const unlocks = nodes.get(t.id)?.desbloquea ?? 0;
	if (unlocks)
		return {
			nivel: 2,
			motivo: `${plural(unlocks, 'tarea espera', 'tareas esperan')} a esta`,
			desbloquea: unlocks,
		};
	const due = dueText(t, now);
	if (['urgente', 'alta'].includes(t.urgencia) || due)
		return { nivel: 3, motivo: due ?? `urgencia ${t.urgencia}`, desbloquea: 0 };
	const stuck = stuckText(t, ctx.reqs(t), now);
	return stuck ? { nivel: 4, motivo: stuck, desbloquea: 0 } : null;
}

const urgRank = (u) => {
	const i = URGENCIAS.indexOf(u);
	return i < 0 ? URGENCIAS.length : i;
};
const dueRank = (t) => (Number.isNaN(time(t.hasta)) ? 9e15 : time(t.hasta));

/**
 * Up to `limit` cards: `{id, num, titulo, estado, agente, carril, desde, nivel, motivo, desbloquea}`. `mapa` is
 * the board's dependencyGraph(); pass it when the caller already built it.
 */
export function keyTasks(board, mapa, now = Date.now(), limit = KEY_LIMIT) {
	const nodes = new Map((mapa?.nodos ?? []).map((n) => [n.id, n]));
	const roots = new Map();
	for (const e of mapa?.aristas ?? []) {
		const root = nodes.get(e.a);
		if (e.tipo !== 'espera' || root?.tipo !== 'raiz') continue;
		roots.set(e.de, [...(roots.get(e.de) ?? []), root]);
	}
	const ctx = { nodes, roots, now, reqs: (t) => requisitos(t, board, now) };
	const open = (board.tareas ?? []).filter((t) => !t.archivada && !isFinished(t));
	return open
		.map((t) => ({ t, why: reasonOf(t, ctx) }))
		.filter(({ why }) => why)
		.sort(
			(a, b) =>
				a.why.nivel - b.why.nivel ||
				b.why.desbloquea - a.why.desbloquea ||
				urgRank(a.t.urgencia) - urgRank(b.t.urgencia) ||
				dueRank(a.t) - dueRank(b.t) ||
				(a.t.num ?? 1e9) - (b.t.num ?? 1e9) ||
				a.t.id.localeCompare(b.t.id),
		)
		.slice(0, limit)
		.map(({ t, why }) => ({
			id: t.id,
			num: t.num,
			titulo: t.titulo ?? t.id,
			estado: t.estado ?? 'pendiente',
			agente: t.candado?.agente ?? t.agente ?? null,
			carril: t.candado?.carril ?? t.carrilPlaneado ?? null,
			desde: since(t) ?? null,
			...why,
		}));
}
