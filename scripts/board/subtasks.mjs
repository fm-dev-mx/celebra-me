/**
 * Subtasks (d174), the «Calendario» (d276) and «Bloqueadas» (T258) of the board: pure functions shared by `pnpm board`,
 * `pnpm board:verify` and the view (as /subtasks.mjs). Rules: .agent/rules/board.md.
 */
import {
	calendarDate,
	findTask,
	isBlocked,
	ordenOf,
	requisitos,
	taskTag,
	URGENCIAS,
} from './model.mjs';
import { dayOf, requisitoText } from './requisito-text.mjs';

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
	if (!Number.isFinite(new Date(s).getTime())) return null;
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

/** Shown for a task marked «bloqueada» by hand while every requisito is met. */
export const MANUAL_BLOCK = 'Marcada como bloqueada';

const urgOf = (t) => (URGENCIAS.includes(t.urgencia) ? URGENCIAS.indexOf(t.urgencia) : 2);

/**
 * T258: the «Bloqueadas» tasks as `{t, motivos}`, `motivos` being what each still waits for (every unmet
 * requisito, or MANUAL_BLOCK); most urgent first, then `orden` and number.
 */
export function blocked(board, now = Date.now()) {
	return (board.tareas ?? [])
		.filter((t) => isBlocked(t, board, now))
		.map((t) => {
			const unmet = requisitos(t, board, now).filter((r) => !r.ok);
			const motivos = unmet.map((r) => requisitoText(r, board, { espera: true }));
			return { t, motivos: motivos.length ? motivos : [MANUAL_BLOCK] };
		})
		.sort(
			(a, b) =>
				urgOf(a.t) - urgOf(b.t) ||
				ordenOf(a.t) - ordenOf(b.t) ||
				(a.t.num ?? 0) - (b.t.num ?? 0),
		);
}

/** T258: the line of `pnpm board list` after the Calendario's, «Bloqueadas (2): T12, T15»; '' when empty. */
export function blockedLine(board, now = Date.now(), max = 8) {
	const all = blocked(board, now);
	if (!all.length) return '';
	const tags = all.slice(0, max).map(({ t }) => taskTag(t));
	return `Bloqueadas (${all.length}): ${tags.join(', ')}${all.length > max ? ', …' : ''}`;
}

/** The close of `pnpm board list`: a blank line, then the Calendario and Bloqueadas lines; '' when both are empty. */
export function listTail(board, now = Date.now()) {
	const lines = [calendarLine(board, now), blockedLine(board, now)].filter(Boolean);
	return lines.length ? `\n${lines.join('\n')}` : '';
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

/**
 * T481: «Viene de T469 · Título (unida)», the finished task a follow-up came from; '' without `deriva`. A follow-up
 * is its own task: unlike a subtask it never counts toward the source's progress nor waits on it.
 */
export function sourceText(t, board) {
	if (!t.deriva) return '';
	const src = findTask(t.deriva, board);
	if (!src) return `Viene de ${t.deriva} (no está en el tablero)`;
	return `Viene de ${taskTag(src)} · ${src.titulo ?? src.id} (${src.estado ?? 'pendiente'})`;
}

/** T481: why a task's `deriva` cannot stay: it names no task on the board. Null when it is fine. */
export function sourceIssue(t, board) {
	if (t.deriva === undefined) return null;
	return findTask(t.deriva, board) ? null : `deriva ${t.deriva} no está en el tablero`;
}

/** The «Parte de» and «Viene de» lines `show` prints under a task's title. */
export const originLines = (t, board) =>
	[parentText(t, board), sourceText(t, board)].filter(Boolean);

/** The first issue among the references a write changed (`refs` lists `padre` and/or `deriva`). */
export const refIssue = (t, board, refs) =>
	(refs.includes('padre') && parentIssue(t, board)) ||
	(refs.includes('deriva') && sourceIssue(t, board)) ||
	null;

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
	const byId = new Map([...(board.archivo ?? []), ...(board.tareas ?? [])].map((x) => [x.id, x]));
	byId.set(t.id, t);
	if (t.padre !== undefined && !byId.has(t.padre))
		return `padre ${t.padre} no está en el tablero`;
	const visited = new Set();
	function visit(x, path) {
		for (const cur of new Set([x?.padre, x?.grupo].filter((ref) => byId.has(ref)))) {
			if (cur === t.id) return `padre forma un ciclo: ${[...path, cur].join(' → ')}`;
			if (visited.has(cur)) continue;
			visited.add(cur);
			const issue = visit(byId.get(cur), [...path, cur]);
			if (issue) return issue;
		}
		return null;
	}
	return visit(t, [t.id]);
}
