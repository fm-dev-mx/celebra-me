/**
 * Display helpers of the board view (T151): how free text, dates and a task's ending read on a card.
 * Pure functions only, like model.mjs: the view imports this file in the browser and the unit tests in Node.
 * Nothing here changes stored data; it only decides how it is shown.
 */
import { archiveBlock } from './cierre.mjs';
import {
	AGENT_REGISTRY,
	authorOf,
	color,
	findTask,
	isFinished,
	isNoteRow,
	isReview,
	matches,
	ownerAsks,
	ownerLaunches,
	prNumber,
	queue,
	stage,
	taskLane,
	taskTag,
} from './model.mjs';
import {
	agoText,
	deliveryLine,
	lockBeat,
	nextSections,
	ownerMessages,
	reviewVerdict,
} from './next.mjs';
import { blocked, calendar } from './subtasks.mjs';

export const GH = 'https://github.com/fm-dev-mx/celebra-me';

/** Internal words with a plain Spanish equivalent; the card shows the plain one and keeps the original as a tooltip. */
export const JARGON = [
	[/baseline (?:preservad|conservad)[oa]s?/gi, 'registro de seguridad conservado'],
	[/Git Safety finish|git-safety:finish/g, 'cierre de seguridad de Git'],
	[/Git Safety/g, 'seguridad de Git'],
	[/sin remediación/gi, 'sin corregir nada'],
	[/REQUEST_CHANGES/g, 'pedir cambios'],
	[/\bCOMMENT\b/g, 'comentario'],
	[/\bHEAD\b/g, 'commit actual'],
	[/\bworktree\b/g, 'carpeta del carril'],
];

const PATH_ROOTS = '(?:\\.agent|\\.github|\\.claude|src|scripts|tests|docs|public|supabase|e2e)';
const BRANCH_ROOTS = '(?:origin\\/)?(?:feat|fix|candidate|chore|refactor|hotfix|release)';
const FILE_EXT = '(?:mjs|cjs|js|ts|tsx|json|md|html|astro|scss|css|ya?ml|ps1|sql|png|jpe?g|webp)';
const EDGE = '(?<![\\w/.@-])';
/** One alternative per kind, tried left to right at each position; earlier kinds win. */
const KINDS = [
	// A glob such as docs/** never opens or closes bold: the pair hugs its words and no path touches it.
	['bold', '(?<![\\w/*])\\*\\*(?=[^\\s*])[^*\\n]*?[^\\s*/]\\*\\*(?![\\w/*])'],
	['code', '`([^`\\n]+)`'],
	['url', 'https?:\\/\\/[^\\s<>"\'`]+'],
	['path', `${EDGE}${PATH_ROOTS}\\/[\\w.@\\[\\]/-]*[\\w\\]]`],
	['branch', `${EDGE}${BRANCH_ROOTS}\\/[\\w.-]*\\w(?:\\/[\\w.-]*\\w)*`],
	['file', `${EDGE}[\\w-]+(?:\\.[\\w-]+)*\\.${FILE_EXT}(?![\\w-])`],
	['pr', '(?<![\\w&#])#(\\d{1,5})(?!\\w)'],
	['task', '(?<![\\w-])T(\\d{1,4})(?![\\w-])'],
	['dec', '(?<![\\w-])d(\\d{2,4})(?![\\w-])'],
	['sha', `(?<![\\w/-])(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\\d)[0-9a-f]{7,40}(?![\\w-])`],
	['jargon', JARGON.map(([re]) => `(?:${re.source})`).join('|')],
];
const TOKEN = new RegExp(
	KINDS.map(([k, src]) => `(?<${k}>${src.replace(/\((?!\?)/g, '(?:')})`).join('|'),
	'gi',
);
const CASE_SENSITIVE = new Set(['task', 'dec', 'sha', 'jargon']);
const STRICT = {
	task: /^T\d+$/,
	dec: /^d\d+$/,
	sha: /^[0-9a-f]+$/,
};

export const esc = (s) =>
	String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

/**
 * Splits free text into plain runs and recognised tokens: **bold**, `code`, a URL, a PR (#512), a task (T132), a decision
 * (d210), a SHA, a path (src/…), a branch (feat/…), a file name and internal jargon. Joining every `text` gives the
 * input back unchanged.
 */
export function tokenize(input) {
	const s = String(input ?? '');
	const out = [];
	let at = 0;
	for (const m of s.matchAll(TOKEN)) {
		const kind = Object.keys(m.groups).find((k) => m.groups[k] !== undefined);
		let text = m[0];
		// Case-insensitive matching is for paths and URLs only; a «t12» or an upper-case hex word stays plain.
		if (CASE_SENSITIVE.has(kind) && STRICT[kind] && !STRICT[kind].test(text)) continue;
		if (
			kind === 'jargon' &&
			!JARGON.some(([re]) =>
				new RegExp(`^(?:${re.source})$`, re.flags.replace('g', '')).test(text),
			)
		)
			continue;
		// A URL never ends in the sentence's punctuation.
		if (kind === 'url') text = text.replace(/[.,;:)]+$/, '');
		if (m.index > at) out.push({ kind: 'text', text: s.slice(at, m.index) });
		out.push({ kind, text });
		at = m.index + text.length;
	}
	if (at < s.length) out.push({ kind: 'text', text: s.slice(at) });
	return mergeText(out);
}

const mergeText = (xs) =>
	xs.reduce((acc, x) => {
		const last = acc.at(-1);
		if (x.kind === 'text' && last?.kind === 'text') last.text += x.text;
		else acc.push({ ...x });
		return acc;
	}, []);

export const shortSha = (sha) => String(sha ?? '').slice(0, 7);

/** The plain word that replaces a jargon term, or the term itself. */
export function plainOf(term) {
	for (const [re, plain] of JARGON)
		if (new RegExp(`^(?:${re.source})$`, re.flags.replace('g', '')).test(term)) return plain;
	return term;
}

/**
 * Free text as HTML: each token gets its own style and link. `ctx.task(num)` returns the board task with that
 * number (a link opens its card) and `ctx.decision(id)` the decision (its text becomes the tooltip).
 */
export function richText(input, ctx = {}) {
	return tokenize(input)
		.map(({ kind, text }) => {
			const e = esc(text);
			switch (kind) {
				case 'bold':
					return `<strong>${richText(text.slice(2, -2), ctx)}</strong>`;
				case 'code':
					return `<code>${esc(text.slice(1, -1))}</code>`;
				case 'url':
					return `<a href="${e}" target="_blank" rel="noopener">${e}</a>`;
				case 'pr':
					return `<a class="prl" href="${GH}/pull/${text.slice(1)}" target="_blank" rel="noopener" title="Abrir el PR ${e} en GitHub">${e}</a>`;
				case 'task': {
					const t = ctx.task?.(Number(text.slice(1)));
					return t
						? `<a class="tl" href="#cola" data-sel="${esc(t.id)}" data-jump="1" data-all="1" title="${esc(t.titulo)}">${e}</a>`
						: `<span class="tl-x">${e}</span>`;
				}
				case 'dec': {
					const d = ctx.decision?.(text);
					return `<a class="dl" href="#historial" data-dec="${e}"${d ? ` title="${esc(d.decision)}"` : ''}>${e}</a>`;
				}
				case 'sha':
					return shaHtml(text);
				case 'path':
				case 'branch':
				case 'file':
					return `<span class="nm">${e}</span>`;
				case 'jargon':
					return `<span class="jg" title="Término original: ${e}">${esc(plainOf(text))}</span>`;
				default:
					return e;
			}
		})
		.join('');
}

/**
 * d284: a title as HTML: only **bold**, `code` and task numbers. Inside a row, whose title is itself a button, a
 * known «T274» becomes a `data-sel` span that a click opens; with `ctx.links` (the sheet's heading) it is a real
 * link a keyboard reaches.
 */
export function titleHtml(input, ctx = {}) {
	return tokenize(input)
		.map(({ kind, text }) => {
			if (kind === 'bold') return `<strong>${titleHtml(text.slice(2, -2), ctx)}</strong>`;
			if (kind === 'code') return `<code>${esc(text.slice(1, -1))}</code>`;
			const t = kind === 'task' && ctx.task?.(Number(text.slice(1)));
			const tag = ctx.links ? 'a href="#cola"' : 'span';
			return t
				? `<${tag} class="tl" data-sel="${esc(t.id)}" data-jump="1" data-all="1" title="${esc(t.titulo)}">${esc(text)}</${ctx.links ? 'a' : 'span'}>`
				: esc(text);
		})
		.join('');
}

/** A SHA cut to 7 characters; the full one is the tooltip and a click copies it. */
export const shaHtml = (sha) =>
	`<button type="button" class="sha" data-sha="${esc(sha)}" title="${esc(sha)} · clic para copiar" aria-label="Copiar el SHA ${esc(sha)}">${esc(shortSha(sha))}</button>`;

/** «hace 2 h»-style age of an ISO date, or '' when it is not a date. */
export function relTime(iso, now = Date.now()) {
	const t = iso ? new Date(iso).getTime() : NaN;
	const d = now - t;
	if (Number.isNaN(d)) return '';
	if (d < 60_000) return 'hace un momento';
	const h = Math.floor(d / 3_600_000);
	if (h < 1) return `hace ${Math.max(1, Math.floor(d / 60_000))} min`;
	if (h < 48) return `hace ${h} h`;
	return `hace ${Math.floor(h / 24)} días`;
}

const LEAD_MAX = 160;
/**
 * The closing summary split into one short sentence (`lead`) and the rest. A leading «T142 id (PR #512):» that
 * only repeats the card's own title is dropped; nothing else is rewritten.
 */
export function leadOf(resumen, t = {}) {
	let s = String(resumen ?? '').trim();
	const prefix = /^(?:T\d+\s+)?(?:[a-z0-9][a-z0-9-]*\s*)?(?:\((?:PR\s*)?#\d+\))?\s*:\s+/i.exec(s);
	if (
		prefix &&
		((t.id && prefix[0].includes(t.id)) || (t.num && prefix[0].includes(`T${t.num}`)))
	)
		s = s.slice(prefix[0].length);
	const nl = s.indexOf('\n');
	const first = nl < 0 ? s : s.slice(0, nl);
	let cut = /[.!?](?=\s|$)/.exec(first);
	let end = cut ? cut.index + 1 : first.length;
	if (end > LEAD_MAX) {
		cut = /;\s/.exec(first.slice(0, LEAD_MAX + 1));
		if (cut) end = cut.index;
	}
	const lead = first.slice(0, end).replace(/[;,]$/, '').trim();
	const rest = s
		.slice(end)
		.replace(/^[;.\s]+/, '')
		.trim();
	const cap = (x) => x && x[0].toUpperCase() + x.slice(1);
	return { lead: cap(lead), rest: cap(rest) };
}

/** How a finished task ended, for its colored chip: `key` picks the color and `label` is what it says. */
export function outcomeOf(t) {
	const v = isReview(t) ? reviewVerdict(t) : null;
	if (t.estado === 'cancelada') return { key: 'cancel', label: 'Cancelada' };
	if (v === 'aprobado') return { key: 'ok', label: 'Aprobada' };
	if (v === 'cambios') return { key: 'warn', label: 'Pide cambios' };
	if (v === 'bloqueado') return { key: 'cancel', label: 'Bloqueada' };
	// A legacy round without a typed verdict is read as «hallazgos» only because its summary has a pendiente,
	// which may be a follow-up rather than a finding: the chip then says only what is known.
	if (v === 'hallazgos')
		return {
			key: 'warn',
			label: t.veredicto === 'hallazgos' ? 'Con hallazgos' : 'Con pendientes',
		};
	if (t.estado === 'comprobada') return { key: 'ok', label: 'Comprobada' };
	if (t.estado === 'unida') return { key: 'done', label: 'Unida' };
	if (t.estado === 'hecha') return { key: 'done', label: 'Hecha' };
	if (t.estado === 'en revision') return { key: 'rev', label: 'En revisión' };
	return { key: 'none', label: t.estado ?? 'Pendiente' };
}

const PEOPLE = { dueno: 'Usted', coordinador: 'Coordinador' };
/** Who did a task: its agent (Claude, Codex, Gemini), else the owner or the coordinator who closed it; null if unknown. */
export function whoOf(t) {
	const a = authorOf(t) ?? t.cierre?.quien;
	if (Object.hasOwn(AGENT_REGISTRY, a ?? '')) return { key: a, label: AGENT_REGISTRY[a].nombre };
	if (Object.hasOwn(PEOPLE, a ?? '')) return { key: a, label: PEOPLE[a] };
	return null;
}

/** Each task's bitácora rows with a writer, oldest first, built once per bitácora (the view renders every card). */
const TRACE_ROWS = new WeakMap();
function traceRows(bitacora) {
	let byTask = TRACE_ROWS.get(bitacora);
	if (byTask) return byTask;
	byTask = new Map();
	const rows = bitacora
		.filter((r) => r.tarea && !isNoteRow(r) && r.quien)
		.sort((a, b) => String(a.en).localeCompare(String(b.en)));
	for (const r of rows) (byTask.get(r.tarea) ?? byTask.set(r.tarea, []).get(r.tarea)).push(r);
	TRACE_ROWS.set(bitacora, byTask);
	return byTask;
}

/**
 * T172: who added a task and who last followed it up, `{agregada, seguimiento?}`. The stored `agregadaPor` and
 * `seguimientoPor` win; an older task falls back to its bitácora: the creation row (`de: ''`) and the last row
 * after it. `seguimiento` is left out when nobody but the one who added it followed up.
 */
export function traceOf(t, board = {}) {
	const rows = traceRows(board.bitacora ?? []).get(t.id) ?? [];
	const created = rows.find((r) => r.de === '' && r.a);
	const agregada = t.agregadaPor ?? created?.quien;
	const later = rows.filter((r) => r !== created).at(-1)?.quien;
	const seguimiento = t.seguimientoPor ?? (created ? later : undefined);
	if (!agregada && !seguimiento) return null;
	return {
		...(agregada ? { agregada } : {}),
		...(seguimiento && seguimiento !== agregada ? { seguimiento } : {}),
	};
}

const TRACE_NAME = { dueno: 'usted' };
/** «agregó gemini · seg. coordinador» and its tooltip, or null when the task has no trace. */
export function traceText(t, board) {
	const tr = traceOf(t, board);
	if (!tr) return null;
	const name = (w) => TRACE_NAME[w] ?? w;
	const parts = [
		tr.agregada ? `agregó ${name(tr.agregada)}` : '',
		tr.seguimiento ? `seg. ${name(tr.seguimiento)}` : '',
	].filter(Boolean);
	const title = [
		tr.agregada ? `Agregada por ${name(tr.agregada)}` : '',
		tr.seguimiento ? `último seguimiento de ${name(tr.seguimiento)}` : '',
	]
		.filter(Boolean)
		.join('; ');
	return { text: parts.join(' · '), title };
}

const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2, P3: 3 };
/** A review's typed findings (T129), most severe first; empty for any other task. */
export function findingsOf(t) {
	const xs = t.cierre?.resultado?.hallazgos;
	if (!Array.isArray(xs)) return [];
	return xs
		.filter((h) => h && typeof h === 'object')
		.slice()
		.sort((a, b) => (PRIORITY_RANK[a.p] ?? 9) - (PRIORITY_RANK[b.p] ?? 9));
}

/** The Handoff Contract lists of a cierre (T129) with their Spanish headings, only the ones present. */
export const HANDOFF_HEADINGS = [
	['fallidas', 'Fallidas'],
	['riesgos', 'Riesgos'],
	['dudas', 'Dudas'],
	['excepcion', 'Excepción autorizada'],
];

/**
 * d284: a task's PR for its row, `{n, key, label}`: `rojo` when its open PR has a failed check, `abierto` when it is
 * open, `unido` once the task says so; without a status (`key: ''`) when the live read does not know. Null without a PR.
 */
export function prStatus(t, prs) {
	const n = prNumber(t.cierre?.pr || t.pr);
	if (!n) return null;
	const open = Array.isArray(prs) ? prs.find((p) => p.number === n) : undefined;
	if (open?.ci === 'rojo') return { n, key: 'rojo', label: 'CI rojo' };
	if (open) return { n, key: 'abierto', label: 'abierto' };
	if (['unida', 'comprobada'].includes(t.estado)) return { n, key: 'unido', label: 'unido' };
	return { n, key: '', label: '' };
}

/** «f05» from «f05-plataforma»; any other lane id stays whole. */
export const laneKey = (id) => /^f\d+/.exec(String(id ?? ''))?.[0] ?? String(id ?? '');

/**
 * d284: who runs an open task and where, «Claude · f05» or «Gemini»: the lock's agent and lane while it runs,
 * else its assigned agent and planned lane. Null for a finished task or one no agent is assigned to.
 */
export function runnerOf(t) {
	if (isFinished(t)) return null;
	const agente = t.candado?.agente ?? (t.agente && t.agente !== 'cualquiera' ? t.agente : null);
	if (!agente) return null;
	const lane = t.candado?.carril ?? taskLane(t);
	const nombre = AGENT_REGISTRY[agente]?.nombre ?? agente;
	return { key: agente, text: lane ? `${nombre} · ${laneKey(lane)}` : nombre };
}

/** d284: when the board's data last changed: the newest task update, bitácora row or decision, or null. */
export function lastChange(board = {}) {
	let best = NaN;
	const see = (iso) => {
		const ms = iso ? new Date(iso).getTime() : NaN;
		if (!Number.isNaN(ms) && !(ms <= best)) best = ms;
	};
	for (const t of board.tareas ?? []) see(t.actualizado);
	for (const b of board.bitacora ?? []) see(b.en);
	for (const d of board.decisiones ?? []) see(d.en);
	return Number.isNaN(best) ? null : new Date(best).toISOString();
}

/** d284: «Celebra-me v0.50.0 · Tablero 1a2b3c4 · Actualizado hace 3 min», the parts that are known. */
export function versionsLine(board = {}, now = Date.now()) {
	const app = board.vivo?.app ?? {};
	const at = lastChange(board);
	return [
		app.version ? `Celebra-me v${app.version}` : '',
		app.tablero?.sha ? `Tablero ${app.tablero.sha}` : '',
		at ? `Actualizado ${relTime(at, now)}` : '',
	]
		.filter(Boolean)
		.join(' · ');
}

/** T321: how a message names its sender and reader: the owner is «usted», agents by their name. */
const READERS = { dueno: 'usted', coordinador: 'Coordinador' };
export const personName = (id) => READERS[id] ?? AGENT_REGISTRY[id]?.nombre ?? String(id ?? '¿?');

const TECHNICAL = new Set(['sha', 'branch', 'code', 'path', 'file', 'url']);
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A stored `--detalle`, one line per sentence; the CLI may keep a typed «\n» as two characters. */
const detailLines = (detalle) =>
	String(detalle ?? '')
		.split(/\r?\n|\\n/)
		.map((s) => s.trim())
		.filter(Boolean);

/**
 * T321: a message `{quien, en, tarea, mensaje: {para, texto}}` as a card reads it: who asks whom, the question in one
 * line, the plain sentences around it (`contexto`) and the technical ones (`detalle`: SHAs, branches, commands, paths)
 * to fold. A leading «T295», «T295 ·» or the task id that only repeats the message's own task is dropped.
 * T322: the options and stored detail of a question (`--opcion`, `--detalle`) come along, so its card shows them.
 */
export function messageParts(r, board) {
	const t = findTask(r.tarea, board);
	const tags = [...new Set([t && taskTag(t), t?.id, r.tarea].filter(Boolean))].map(escRe);
	const lead = tags.length
		? new RegExp(
				`^(?:${tags.join('|')})(?![\\w-])(?:\\s*\\((?:PR\\s*)?#\\d+\\))?\\s*[:·—-]?\\s*`,
				'i',
			)
		: null;
	let text = String(r.mensaje?.texto ?? '').trim();
	while (lead && lead.test(text)) text = text.replace(lead, '');
	const sentences = text
		.split(/\n+|(?<=[.!?])\s+(?=[¿¡A-ZÁÉÍÓÚÑ0-9`*])/)
		.map((s) => s.trim())
		.filter(Boolean);
	const technical = (s) => tokenize(s).some((x) => TECHNICAL.has(x.kind));
	// A URL query string (`https://x/a?b=1`) is no question: a plain sentence with «?» goes first.
	const pregunta =
		sentences.find((s) => s.includes('?') && !technical(s)) ??
		sentences.find((s) => s.includes('?')) ??
		sentences.find((s) => !technical(s)) ??
		sentences[0] ??
		'';
	const rest = sentences.filter((s) => s !== pregunta);
	return {
		de: personName(r.quien),
		para: personName(r.mensaje?.para),
		quien: r.quien ?? null,
		t,
		tarea: t ? taskTag(t) : (r.tarea ?? ''),
		pregunta,
		contexto: rest.filter((s) => !technical(s)),
		detalle: [...rest.filter(technical), ...detailLines(r.mensaje?.detalle)],
		opciones: r.mensaje?.opciones ?? [],
		en: r.en ?? null,
	};
}

/**
 * T321: a «Mensaje: gemini → coordinador sobre T307: T307 id (PR #587): texto» row as «Gemini → Coordinador: texto».
 * The row already shows its task, so the repeated tag, id and PR go; any other row text comes back unchanged.
 */
export function rowText(texto) {
	const m = /^Mensaje: (\S+) → (\S+) sobre (\S+): ([\s\S]*)$/.exec(String(texto ?? ''));
	if (!m) return String(texto ?? '');
	const lead = new RegExp(
		`^${escRe(m[3])}(?![\\w-])(?:\\s+[a-z0-9]+(?:-[a-z0-9]+)+(?=\\s*[(:]))?(?:\\s*\\((?:PR\\s*)?#\\d+\\))?\\s*[:·—-]?\\s*`,
		'i',
	);
	let text = m[4];
	while (lead.test(text)) text = text.replace(lead, '');
	return `${personName(m[1])} → ${personName(m[2])}: ${text}`;
}

/**
 * T321: what the owner does now, once each, every row with its action as a verb: `{tipo, id, t, verbo, texto, sub}`.
 * `tarea` rows are the owner's ready tasks («Pegar en Gemini», «Aprobar» when it touches main, Production,
 * migrations or secrets, else «Hacer»), `decision` the answers a task waits for («Decidir»), `detenida` a ready Codex
 * or Gemini task nobody took («Relanzar»), `mensaje` an unread message to the owner («Responder a Codex», with its
 * `msg` parts) and one `archivar` row for the finished tasks ready to archive. Messages to the coordinator never count.
 */
export function ownerActions(board, { prs, now = Date.now() } = {}) {
	const next = nextSections(board, { prs, now });
	const stalled = next.usted.filter((x) => x.texto.startsWith('Correr el despachador'));
	const late = new Set(stalled.map((x) => x.id));
	const tasks = queue(board, now).filter(
		(t) => color(t, board, { now }) === 'own' && !late.has(t.id),
	);
	const archivable = (board.tareas ?? []).filter(
		(t) =>
			isFinished(t) &&
			!t.archivada &&
			!t.candado &&
			!(Object.hasOwn(t, 'bloqueoArchivo') ? t.bloqueoArchivo : archiveBlock(t, board)),
	);
	// T442: a lock silent for 60 min surfaces in the owner action list
	const silentLocks60m = (board.tareas ?? [])
		.filter((t) => t.candado && !isFinished(t))
		.map((t) => ({ t, silent: now - Date.parse(lockBeat(t.candado) ?? '') }))
		.filter(({ silent }) => !Number.isNaN(silent) && silent >= 60 * 60_000);
	const rows = [
		...tasks.map((t) => {
			const paste = ownerLaunches(t, board, now).map((a) => AGENT_REGISTRY[a]?.nombre ?? a);
			const verbo = paste.length
				? `Pegar en ${paste.join(' o ')}`
				: (t.toca ?? []).length
					? 'Aprobar'
					: 'Hacer';
			return {
				tipo: 'tarea',
				id: t.id,
				t,
				verbo,
				texto: t.titulo ?? t.id,
				sub: deliveryLine(t, now),
			};
		}),
		...ownerAsks(board, now).map(({ t, r }) => ({
			tipo: 'decision',
			id: t.id,
			t,
			verbo: 'Decidir',
			texto: r.ref,
			sub: `la espera ${taskTag(t)} · ${t.titulo ?? t.id}`,
		})),
		...stalled.map((x) => ({
			tipo: 'detenida',
			id: x.id,
			t: findTask(x.id, board),
			verbo: 'Relanzar',
			texto: x.texto,
			sub: '',
		})),
		...silentLocks60m.map(({ t, silent }) => ({
			tipo: 'detenida',
			id: t.id,
			t,
			verbo: 'Inspeccionar',
			texto: `Candado de ${t.candado.agente} sin latido hace ${agoText(silent)}: ${taskTag(t)} · ${t.titulo}`,
			sub: t.candado.carril ? `carril ${t.candado.carril}` : '',
		})),
		...ownerMessages(board).map((r) => {
			const msg = messageParts(r, board);
			return {
				tipo: 'mensaje',
				id: msg.t?.id ?? null,
				t: msg.t,
				verbo: `Responder a ${msg.de}`,
				texto: msg.pregunta,
				sub: '',
				msg,
			};
		}),
	];
	if (archivable.length)
		rows.push({
			tipo: 'archivar',
			id: null,
			t: null,
			verbo: 'Archivar',
			texto: `${archivable.length} ${archivable.length === 1 ? 'tarea finalizada' : 'tareas finalizadas'} con su resumen de cierre`,
			sub: '',
			n: archivable.length,
		});
	return rows;
}

/** The «En revisión» group of the Cola: done tasks waiting for their check, newest first. */
export function inReview(board, now = Date.now()) {
	return (board.tareas ?? [])
		.filter((t) => stage(t, board, now) === 'revision' && !t.archivada)
		.sort((a, b) => Date.parse(b.actualizado ?? 0) - Date.parse(a.actualizado ?? 0));
}

/**
 * T321: the number each sidebar tab shows, equal to the rows its list shows with no filter or search: «Para usted»
 * its actions, «Cola» the open tasks plus its «En revisión» group (never the coordinator's group), «Calendario» and
 * «Bloqueadas» their tasks, «Finalizadas» the ones not archived and «Carriles» the lanes a running task holds, out of
 * all. «General» and «Historial» show none: the first repeats the others, the second is a log.
 */
export function tabCounts(board, { prs, now = Date.now() } = {}) {
	const lanes = board.carriles ?? [];
	const held = new Set(
		(board.tareas ?? [])
			.filter((t) => t.candado && !isFinished(t))
			.map(taskLane)
			.filter(Boolean),
	);
	return {
		usted: ownerActions(board, { prs, now }).length,
		cola: queue(board, now).length + inReview(board, now).length,
		calendario: calendar(board, now).length,
		bloqueadas: blocked(board, now).length,
		finalizadas: (board.tareas ?? []).filter((t) => isFinished(t) && !t.archivada).length,
		carriles: `${lanes.filter((l) => held.has(l.id)).length}/${lanes.length}`,
	};
}

const foldText = (s) =>
	String(s ?? '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();

/** T321: whether a task matches the search: its number (T295 or 295), id, title, current line or PR (#594, PR 594). */
export function searchHit(t, q) {
	const s = String(q ?? '').trim();
	if (!s) return true;
	const pr = /^(?:pr\s*#?|#)(\d+)$/i.exec(s);
	if (pr) return [t.pr, t.cierre?.pr].some((x) => prNumber(x) === Number(pr[1]));
	if (/^\d+$/.test(s) && (Number(t.num) === Number(s) || prNumber(t.pr) === Number(s)))
		return true;
	return matches(t, s);
}

/** The sections a search result can name, in the sidebar's order. */
export const SEARCH_SECTIONS = [
	'Para usted',
	'Cola',
	'Calendario',
	'Bloqueadas',
	'Finalizadas',
	'Carriles',
	'Historial',
];

/**
 * T321: the global search: every task that matches, once, with the sections that list it (`secciones`, in sidebar
 * order), then the decisions that match («Historial»). Tasks come first by their first section, then newest number.
 */
export function globalSearch(board, q, { prs, now = Date.now(), max = 60 } = {}) {
	const s = String(q ?? '').trim();
	if (!s) return [];
	const mine = new Set(
		ownerActions(board, { prs, now })
			.map((x) => x.id)
			.filter(Boolean),
	);
	const cola = new Set([...queue(board, now), ...inReview(board, now)].map((t) => t.id));
	const cal = new Set(calendar(board, now).map((x) => x.t.id));
	const blk = new Set(blocked(board, now).map((x) => x.t.id));
	const rank = (x) => {
		const i = SEARCH_SECTIONS.indexOf(String(x.secciones[0] ?? '').split(' · ')[0]);
		return i < 0 ? SEARCH_SECTIONS.length : i;
	};
	const tasks = (board.tareas ?? [])
		.filter((t) => searchHit(t, s))
		.map((t) => {
			const secciones = [];
			if (mine.has(t.id)) secciones.push('Para usted');
			if (cola.has(t.id)) secciones.push('Cola');
			if (cal.has(t.id)) secciones.push('Calendario');
			if (blk.has(t.id)) secciones.push('Bloqueadas');
			if (isFinished(t))
				secciones.push(t.archivada ? 'Finalizadas · archivada' : 'Finalizadas');
			if (t.candado && !isFinished(t)) secciones.push('Carriles');
			// A match no section lists (for example a pending task without a prompt) still gets a label.
			if (!secciones.length) secciones.push('Otras');
			return { tipo: 'tarea', t, secciones };
		})
		.sort((a, b) => rank(a) - rank(b) || (b.t.num ?? 0) - (a.t.num ?? 0));
	const words = /^d\d+$/i.test(s) ? null : foldText(s).split(/\s+/);
	const decisions = (board.decisiones ?? [])
		.filter((d) =>
			words
				? words.every((w) => foldText([d.id, d.decision, d.motivo].join(' ')).includes(w))
				: String(d.id).toLowerCase() === s.toLowerCase(),
		)
		.sort((a, b) => Date.parse(b.en ?? 0) - Date.parse(a.en ?? 0))
		.map((d) => ({ tipo: 'decision', d, secciones: ['Historial'] }));
	return [...tasks, ...decisions].slice(0, max);
}
