/**
 * Subtasks (d174) and the «Calendario» (d276) of the board: pure functions shared by `pnpm board`,
 * `pnpm board:verify` and the view (as /subtasks.mjs). Rules: .agent/rules/board.md.
 */
import { calendarDate, findTask, ordenOf, taskTag } from './model.mjs';
import { dayOf } from './requisito-text.mjs';

/** Estados that count a subtask as done. */
const DONE = new Set(['hecha', 'unida', 'comprobada']);

/** d276: the «Calendario» tasks as `{t, fecha}`, soonest date first, then `orden` and number. */
export function calendar(board, now = Date.now()) {
	return (board.tareas ?? [])
		.map((t) => ({ t, fecha: calendarDate(t, board, now) }))
		.filter((x) => x.fecha !== null)
		.sort(
			(a, b) =>
				Date.parse(a.fecha) - Date.parse(b.fecha) ||
				ordenOf(a.t) - ordenOf(b.t) ||
				(a.t.num ?? 0) - (b.t.num ?? 0),
		);
}

/** d276: the Monday (YYYY-MM-DD, Mazatlán) of the week a date falls in. */
export function weekOf(s) {
	const local = new Date(s).toLocaleDateString('en-CA', { timeZone: 'America/Mazatlan' });
	const [y, m, d] = local.split('-').map(Number);
	const day = new Date(Date.UTC(y, m - 1, d));
	day.setUTCDate(d - ((day.getUTCDay() + 6) % 7));
	return day.toISOString().slice(0, 10);
}

/** d276: the «Calendario» grouped by week, `[{semana, tareas: [{t, fecha}]}]`, soonest week first. */
export function calendarWeeks(board, now = Date.now()) {
	const weeks = [];
	for (const x of calendar(board, now)) {
		const semana = weekOf(x.fecha);
		if (weeks.at(-1)?.semana !== semana) weeks.push({ semana, tareas: [] });
		weeks.at(-1).tareas.push(x);
	}
	return weeks;
}

/** d276: the last line of `pnpm board list`, «Calendario (2): próxima T12 el sáb, 31 oct»; '' when empty. */
export function calendarLine(board, now = Date.now()) {
	const all = calendar(board, now);
	if (!all.length) return '';
	const [{ t, fecha }] = all;
	return `Calendario (${all.length}): próxima ${taskTag(t)} el ${dayOf(fecha)}`;
}

/**
 * d174: the subtasks of a mother task, those whose `padre` or `grupo` is its id, including archived and
 * compacted ones; for `{grupo}` without an id, every task of that group. Ordered by `fase`, `orden`, number.
 */
export function subtasksOf(t, board) {
	const seen = new Set();
	const member = t.id
		? (x) => x.id !== t.id && (x.padre === t.id || x.grupo === t.id)
		: (x) => x.grupo === t.grupo;
	return [...(board.tareas ?? []), ...(board.archivo ?? [])]
		.filter((x) => member(x) && !seen.has(x.id) && seen.add(x.id))
		.sort(
			(a, b) =>
				(a.fase ?? 1e9) - (b.fase ?? 1e9) ||
				ordenOf(a) - ordenOf(b) ||
				(a.num ?? 0) - (b.num ?? 0),
		);
}

/** d174: a subtask's mother, its `padre` or else the task whose id is its `grupo`; null when it has none. */
export function parentOf(t, board) {
	const ref = t.padre ?? t.grupo;
	return ref ? findTask(ref, board) : null;
}

/** d174: the `grupo` of a task no mother task heads, so the queue shows it under a header; '' otherwise. */
export const headlessGroup = (t, board) =>
	!t.padre && t.grupo && !findTask(t.grupo, board) ? t.grupo : '';

const isRunning = (x) =>
	x.estado === 'en curso' || ((x.estado ?? 'pendiente') === 'pendiente' && Boolean(x.candado));

/** d174 checklist mark: ✓ hecha/unida/comprobada, ● en curso or en revisión, – cancelada, ○ the rest. */
export function subtaskMark(x) {
	if (DONE.has(x.estado)) return '✓';
	if (x.estado === 'cancelada') return '–';
	return isRunning(x) || x.estado === 'en revision' ? '●' : '○';
}

/**
 * d174: progress of a mother task (or `{grupo}`), `{total, hechas, enCurso, enRevision, pendientes, pct,
 * faseActual, totalFases}`. Cancelled subtasks do not count; the current phase is the lowest with work left.
 */
export function groupProgress(t, board) {
	const subs = subtasksOf(t, board).filter((x) => x.estado !== 'cancelada');
	const count = (ok) => subs.filter(ok).length;
	const total = subs.length;
	const hechas = count((x) => DONE.has(x.estado));
	const enCurso = count(isRunning);
	const enRevision = count((x) => x.estado === 'en revision');
	const fases = subs.map((x) => x.fase).filter(Number.isInteger);
	const totalFases = fases.length ? Math.max(...fases) : 0;
	const left = subs.filter((x) => !DONE.has(x.estado) && Number.isInteger(x.fase));
	return {
		total,
		hechas,
		enCurso,
		enRevision,
		pendientes: total - hechas - enCurso - enRevision,
		pct: total ? Math.round((hechas * 100) / total) : 0,
		faseActual: totalFases
			? left.length
				? Math.min(...left.map((x) => x.fase))
				: totalFases
			: 0,
		totalFases,
	};
}

/** d174: «Fase 2 de 3 · 4 de 7 completadas (57 %)». */
export const progressText = (p) =>
	`${p.totalFases ? `Fase ${p.faseActual} de ${p.totalFases} · ` : ''}${p.hechas} de ${p.total} completadas (${p.pct} %)`;

/** d174: who works a subtask: its lock's agent, else its named agent; '' for «cualquiera». */
export const subtaskAgent = (x) =>
	x.candado?.agente ?? (x.agente && x.agente !== 'cualquiera' ? x.agente : '');

/** d174: one subtask as the sheet and `pnpm board show` list it, «T12 · F1 · Título · en curso · claude». */
export const subtaskText = (x) =>
	[
		taskTag(x),
		Number.isInteger(x.fase) ? `F${x.fase}` : '',
		x.titulo ?? x.id,
		x.estado ?? 'pendiente',
		subtaskAgent(x),
	]
		.filter(Boolean)
		.join(' · ');

/** d174: «Parte de T174 · Subtareas en el tablero · 2/5 listas», the way up from a subtask; '' without one. */
export function parentText(t, board) {
	const mother = parentOf(t, board);
	const group = !mother && headlessGroup(t, board);
	if (!mother && !group) return '';
	const p = groupProgress(mother ?? { grupo: group }, board);
	const name = mother
		? `${taskTag(mother)} · ${mother.titulo ?? mother.id}`
		: `el grupo ${group}`;
	return `Parte de ${name} · ${p.hechas}/${p.total} listas`;
}

/** d174: the block of `pnpm board show` for a mother task, «Subtareas · X/Y (Z %)», a bar and its checklist. */
export function subtaskLines(t, board) {
	const subs = subtasksOf(t, board);
	if (!subs.length) return [];
	const out = [];
	const p = groupProgress(t, board);
	const full = Math.round(p.pct / 10);
	out.push(
		`\nSubtareas · ${p.hechas}/${p.total} (${p.pct} %)  [${'█'.repeat(full)}${'░'.repeat(10 - full)}]`,
	);
	if (p.totalFases) out.push(`  Fase ${p.faseActual} de ${p.totalFases}`);
	for (const x of subs) out.push(`  ${subtaskMark(x)} ${subtaskText(x)}`);
	return out;
}

/**
 * d174: why a task's `padre` cannot stay: it names no task on the board, or following mothers leads back to the
 * task itself. Null when it is fine; `t` is the task as it would be saved.
 */
export function parentIssue(t, board) {
	if (t.padre === undefined) return null;
	const byId = new Map([...(board.archivo ?? []), ...(board.tareas ?? [])].map((x) => [x.id, x]));
	byId.set(t.id, t);
	if (!byId.has(t.padre)) return `padre ${t.padre} no está en el tablero`;
	const path = [t.id];
	for (let cur = t.padre; cur !== undefined; cur = byId.get(cur)?.padre) {
		if (cur === t.id) return `padre forma un ciclo: ${[...path, cur].join(' → ')}`;
		// A loop that does not pass through this task is reported on its own members.
		if (path.includes(cur)) return null;
		path.push(cur);
	}
	return null;
}
