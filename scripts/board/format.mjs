/**
 * Display helpers of the board view (T151): how free text, dates and a task's ending read on a card.
 * Pure functions only, like model.mjs: the view imports this file in the browser and the unit tests in Node.
 * Nothing here changes stored data; it only decides how it is shown.
 */
import { AGENT_REGISTRY, authorOf, isReview } from './model.mjs';
import { reviewVerdict } from './next.mjs';

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
 * Splits free text into plain runs and recognised tokens: `code`, a URL, a PR (#512), a task (T132), a decision
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
	// Until T129 types the verdict, a round is read as «hallazgos» only because its summary has a pendiente,
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
