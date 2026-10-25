/**
 * The closing summary of a board task (d178) and its T129 return contract: how `pnpm board close` and a
 * cancellation build the `cierre`, what «Archivar» still asks of it and the one-line signal an agent hands back.
 * Pure functions only, like model.mjs (which keeps the field shape checks): the view imports this file too.
 */
import {
	HANDOFF_LISTS,
	cierreShapeIssues,
	findTask,
	fullContract,
	isFinished,
	normalizePr,
	resultKind,
	returnKind,
	taskTag,
} from './model.mjs';

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
export function buildCierre(prev = {}, { flags, lists }, board, en, task) {
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
	return withReturn(cierre, prev, { flags, lists }, task);
}

/**
 * T129 part of the close: the Handoff Contract lists stay absent until given, so a new task's close names each
 * one, and the typed resultado (a code one takes the task's PR when the close names none).
 */
function withReturn(cierre, prev, { flags, lists }, task) {
	const out = { ...cierre };
	for (const [field, flag] of HANDOFF_LISTS) {
		const v = Object.hasOwn(lists, flag) ? listFlag(lists, flag) : prev[field];
		if (v !== undefined) out[field] = v;
	}
	const pr = out.pr ?? normalizePr(task?.pr);
	const resultado = buildResultado(prev.resultado, { flags, lists }, pr);
	if (resultado) out.resultado = resultado;
	return out;
}

/** `P2|scripts/x.mjs:12|texto` → `{ p, archivo, texto }`; the text may hold more `|`. */
function parseHallazgo(s) {
	const [p = '', archivo = '', ...rest] = String(s ?? '').split('|');
	return { p: p.trim().toUpperCase(), archivo: archivo.trim(), texto: rest.join('|').trim() };
}

/**
 * `cierre.resultado` from the close flags, over the previous one: `--veredicto`, `--sha`, `--hallazgo` (a review)
 * and `--nivel`, `--sha` (code, with the cierre's PR). Undefined while none of them was ever given.
 */
function buildResultado(prev, { flags, lists }, pr) {
	const pick = (k) => (typeof flags[k] === 'string' && flags[k] ? flags[k] : undefined);
	const out = { ...prev };
	for (const k of ['veredicto', 'sha', 'nivel']) if (pick(k)) out[k] = pick(k);
	if (Object.hasOwn(lists, 'hallazgo'))
		out.hallazgos = listFlag(lists, 'hallazgo').map(parseHallazgo);
	if (out.veredicto !== undefined) out.hallazgos ??= [];
	if (out.nivel !== undefined && pr) out.pr = pr;
	return Object.keys(out).length ? out : undefined;
}

/** The cierre a cancellation writes in the same command: its reason as the summary, empty lists (T129). */
export function cancelCierre(prev, motivo, { en, quien } = {}) {
	return {
		comprobaciones: [],
		saltadas: [],
		pendientes: [],
		...Object.fromEntries(HANDOFF_LISTS.map(([f]) => [f, []])),
		...prev,
		resumen: String(motivo ?? '').trim() || prev?.resumen || '',
		en,
		...(quien ? { quien } : {}),
	};
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const NEXT_BY_VERDICT = { aprobado: 'unir', cambios: 'corregir', bloqueado: 'resolver el bloqueo' };

/**
 * The one-line signal `close` prints and an agent hands back (T129), built only from the task and its cierre:
 * `T125 · revision · aprobado · #518@3c35826 · 0 hallazgos · siguiente: unir`.
 */
export function signalLine(t, board) {
	const c = t.cierre ?? {};
	const r = c.resultado ?? {};
	const tag = taskTag(t);
	if (t.estado === 'cancelada')
		return `${tag} · cancelada · ${String(c.resumen ?? '').split('\n')[0]}`;
	const at = (sha) =>
		[normalizePr(c.pr ?? t.pr), sha && String(sha).slice(0, 7)].filter(Boolean).join('@');
	const pend = (c.pendientes ?? []).map((p) => {
		const d = findTask(p.tarea, board);
		return d ? taskTag(d) : p.tarea;
	});
	const then = pend.length ? pend.join(', ') : 'ninguno';
	const kind = resultKind(t);
	const parts =
		kind === 'revision'
			? [
					'revision',
					r.veredicto ?? t.estado,
					at(r.sha ?? t.revisionSha),
					plural((r.hallazgos ?? []).length, 'hallazgo', 'hallazgos'),
					`siguiente: ${NEXT_BY_VERDICT[r.veredicto] ?? then}`,
				]
			: kind === 'codigo'
				? [
						'codigo',
						t.estado ?? 'pendiente',
						at(r.sha),
						...(r.nivel ? [`nivel ${r.nivel}`] : []),
						`siguiente: ${t.estado === 'en revision' ? 'revisión cruzada' : then}`,
					]
				: [t.estado ?? 'pendiente', `siguiente: ${then}`];
	return [tag, ...parts.filter(Boolean)].join(' · ');
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
	const out = [...cierreShapeIssues(t.cierre, t), ...missingReturn(t)];
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
		...returnLines(c, list),
	];
}

const HANDOFF_LABELS = {
	fallidas: 'Fallidas',
	riesgos: 'Riesgos',
	dudas: 'Dudas',
	excepcion: 'Excepción',
};

/** The T129 part of the summary lines: the Handoff lists and the resultado, only when the cierre has them. */
function returnLines(c, list) {
	const lists = HANDOFF_LISTS.filter(([f]) => Array.isArray(c[f]))
		.map(([f]) => `${HANDOFF_LABELS[f]}: ${list(c[f], 'ninguna')}.`)
		.join(' ');
	const r = c.resultado;
	const short = (sha) => String(sha ?? '').slice(0, 7);
	const finds = Array.isArray(r?.hallazgos) ? r.hallazgos : [];
	return [
		...(lists ? [lists] : []),
		...(r?.veredicto
			? [
					`Veredicto: ${r.veredicto} en ${short(r.sha)} · ${plural(finds.length, 'hallazgo', 'hallazgos')}`,
					...finds.map((h) => `  ${h.p} ${h.archivo}: ${h.texto}`),
				]
			: []),
		...(r?.nivel
			? [`Resultado: PR ${r.pr ?? '¿?'} en ${short(r.sha)} · nivel ${r.nivel}`]
			: []),
	];
}

/**
 * What the T129 return contract still asks of a cierre: every Handoff Contract list and the typed `resultado`.
 * Only tasks under the full contract (`fullContract`) owe it, so tasks opened before it keep closing as they did;
 * it is checked by `close` and «Archivar», never by other writes.
 */
function missingReturn(t) {
	const c = t.cierre ?? {};
	if (!fullContract(t)) return [];
	const out = HANDOFF_LISTS.filter(([field]) => c[field] === undefined).map(
		([field, flag]) => `falta cierre.${field} (--${flag}=… o --${flag}=ninguna)`,
	);
	const kind = returnKind(t);
	if (kind === 'revision' && !c.resultado)
		out.push('falta cierre.resultado de la revisión (--veredicto, --sha, --hallazgo)');
	if (kind === 'codigo' && !c.resultado)
		out.push('falta cierre.resultado del código (--sha, --nivel)');
	else if (kind === 'codigo' && !c.resultado.pr) out.push('falta resultado.pr (--pr=#N)');
	return out;
}
