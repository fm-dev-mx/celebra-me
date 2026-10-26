/**
 * T297 (U-05): the release note a task leaves in its cierre (`pnpm board close --changelog="Added: …"` or
 * `--changelog=ninguno`), so lanes F5–F12 never edit `CHANGELOG.md` in parallel. Release preparation reads the
 * notes of the merged tasks with `pnpm board changelog` and pastes or checks them under `[Unreleased]`.
 * Pure functions only: model.mjs checks the field's shape with them.
 */
import { prNumber } from './pr-ref.mjs';

/** Keep a Changelog groups, in the order a version section lists them. */
export const CHANGELOG_GRUPOS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
export const SIN_NOTA = 'ninguno';

/** Merged tasks: only their notes reach a release. */
const MERGED = new Set(['unida', 'comprobada']);

/**
 * `--changelog` → the stored note: `{ grupo, texto }`, or `'ninguno'` when the task ships nothing notable.
 * Throws an Error with the reason when the value is neither.
 */
export function parseChangelog(value) {
	const raw = String(value ?? '').trim();
	if (/^ningun[oa]$/i.test(raw)) return SIN_NOTA;
	const m = /^([A-Za-z]+):\s*(.+)$/s.exec(raw);
	const grupo = m && CHANGELOG_GRUPOS.find((g) => g.toLowerCase() === m[1].toLowerCase());
	if (!grupo || /\n/.test(m[2]))
		throw new Error(
			`--changelog debe ser «<${CHANGELOG_GRUPOS.join('|')}>: <una línea>» o «${SIN_NOTA}»`,
		);
	return { grupo, texto: m[2].trim() };
}

/** True when `c` is a stored note (see parseChangelog). */
export function validChangelog(c) {
	if (c === SIN_NOTA) return true;
	return (
		c !== null &&
		typeof c === 'object' &&
		CHANGELOG_GRUPOS.includes(c.grupo) &&
		typeof c.texto === 'string' &&
		Boolean(c.texto.trim()) &&
		!c.texto.includes('\n')
	);
}

/** The line `show` and the card print for a cierre's note. */
export const changelogLine = (c) =>
	c === SIN_NOTA ? 'Nota de versión: ninguna.' : `Nota de versión: ${c.grupo}: ${c.texto}`;

/** `#N` of the task's PR; a value naming no PR of this repository counts as none. */
const prOf = (t) => {
	const n = prNumber(t.cierre?.resultado?.pr ?? t.cierre?.pr ?? t.pr);
	return n ? `#${n}` : undefined;
};

/**
 * The notes of the merged tasks, oldest close first: `{ tarea, num, pr, grupo, texto, en }`. `desde` (a date)
 * keeps only closes on or after it, e.g. the date of the last version tag.
 */
export function changelogNotes(board, { desde } = {}) {
	const desdeMs = desde ? Date.parse(desde) : NaN;
	const matchDesde = (en) => {
		if (!desde) return true;
		if (!Number.isNaN(desdeMs)) {
			const enMs = Date.parse(en ?? '');
			return !Number.isNaN(enMs) ? enMs >= desdeMs : String(en ?? '') >= desde;
		}
		return String(en ?? '') >= desde;
	};
	return (board.tareas ?? [])
		.filter((t) => MERGED.has(t.estado) && validChangelog(t.cierre?.changelog))
		.filter((t) => t.cierre.changelog !== SIN_NOTA)
		.filter((t) => matchDesde(t.cierre.en))
		.map((t) => ({
			tarea: t.id,
			...(t.num ? { num: t.num } : {}),
			...(prOf(t) ? { pr: prOf(t) } : {}),
			grupo: t.cierre.changelog.grupo,
			texto: t.cierre.changelog.texto,
			en: t.cierre.en,
		}))
		.sort((a, b) => String(a.en).localeCompare(String(b.en)));
}

/** The notes as `[Unreleased]` Markdown: one `### <grupo>` per group, each bullet ending in its PR. */
export function changelogMarkdown(notes) {
	const out = [];
	for (const grupo of CHANGELOG_GRUPOS) {
		const mine = notes.filter((n) => n.grupo === grupo);
		if (!mine.length) continue;
		if (out.length) out.push('');
		out.push(`### ${grupo}`, '');
		for (const n of mine) out.push(`- ${n.texto}${n.pr ? ` (${n.pr})` : ''}`);
	}
	return out;
}

/** The body of `## [Unreleased]` in a CHANGELOG.md text, up to the next `## ` heading. */
export function unreleasedSection(text) {
	const lines = String(text ?? '').split(/\r?\n/);
	const start = lines.findIndex((l) => /^## \[Unreleased\]/i.test(l));
	if (start < 0) return '';
	const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
	return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

/** Notes whose PR (or, without one, whose text) `[Unreleased]` does not mention yet. */
export function missingNotes(notes, changelogText) {
	const section = unreleasedSection(changelogText);
	return notes.filter((n) =>
		n.pr ? !new RegExp(`${n.pr}(?!\\d)`).test(section) : !section.includes(n.texto),
	);
}
