/**
 * T322: text written for the owner, a junior programmer who reads Spanish first: the PARA USTED lines of a
 * prompt-v1, a typed task's `hara`, `usted` and `riesgo`, and messages `--para=dueno` with their options and
 * technical detail. No Node APIs: the view imports this module through model.mjs and prompt.mjs.
 */

/**
 * Internal shorthand the owner cannot read: decision ids, board revisions and numbered review rounds. A plain
 * «vuelta» («botón de vuelta atrás») is Spanish, so only «vuelta 2» counts.
 */
const INTERNAL_WORDS = [/\bd\d{2,4}\b/gi, /\brev\b\.?(?:\s*\d+)?/gi, /\bvueltas?\s+\d+\b/gi];

/**
 * `text` on one line without internal shorthand: «(d291)», «(T12, d3)», «d291», «rev 4» and «vuelta 2» are
 * dropped, so a task title can go into PARA USTED as it is.
 */
export function ownerPlain(text) {
	let s = String(text ?? '')
		.replace(/\s*(?:\r?\n|\\n)\s*/g, ' ')
		.replace(/\s*\(\s*[dT]\d+(?:\s*(?:,|y)\s*[dT]\d+)*\s*\)/g, '');
	const capital = /^\s*\p{Lu}/u.test(s);
	for (const re of INTERNAL_WORDS) s = s.replace(re, '');
	s = s
		.replace(/\(\s*(?:(?:T\d+|,|y)\s*)*\)/g, '')
		.replace(/\s+([,.;:)])/g, '$1')
		.replace(/\(\s+/g, '(')
		.replace(/\s{2,}/g, ' ')
		.replace(/^(?:[\s,;:·-]|\.(?=\s))+|[\s,;:·.-]+$/g, '');
	// «Vuelta 2 del flujo» reads «Del flujo», not «del flujo».
	return capital ? s.replace(/^\p{Ll}/u, (c) => c.toUpperCase()) : s;
}

/** Why `text` is not plain for the owner: one line, without internal shorthand; [] when it is. */
export function ownerTextIssues(text) {
	const s = String(text ?? '');
	const out = [];
	if (/\r|\n|\\n/.test(s)) out.push('debe ser una sola línea');
	const found = INTERNAL_WORDS.flatMap((re) => [...s.matchAll(re)].map((m) => m[0]));
	for (const w of new Set(found))
		out.push(`usa «${w}», una abreviatura interna: dígalo con palabras`);
	return out;
}

/** A typed task's own PARA USTED texts, each replacing its kind's line (Qué hará, Usted, Riesgo). */
export const OWNER_FIELDS = ['hara', 'usted', 'riesgo'];

/** FIELD_CHECKS entries for OWNER_FIELDS: optional, and plain owner text when present. */
export const ownerFieldChecks = OWNER_FIELDS.map((k) => [
	(t) =>
		t[k] !== undefined &&
		!(typeof t[k] === 'string' && t[k].trim() && !ownerTextIssues(t[k]).length),
	(t) => [`${k} debe ser texto para el dueño`, ...ownerTextIssues(t[k])].join('; '),
]);

/** «(recomendada)» on an option; the first option is the recommended one, so it is written once. */
const RECOMMENDED = /\s*\(recomendada\)\s*$/i;

/**
 * Why a message to the owner is refused: the text is one plain line with a question, and a decision lists at
 * least two options, the recommended one first; the technical detail goes in `detalle`. [] when it is fine.
 */
export function ownerMessageIssues({ texto, opciones = [] }) {
	const out = ownerTextIssues(texto).map((w) => `la pregunta ${w}`);
	if (String(texto ?? '').length > 200)
		out.push('la pregunta pasa de 200 caracteres: lleve el detalle a --detalle');
	if (!String(texto ?? '').includes('?'))
		out.push(
			'el texto para el dueño debe ser una pregunta («¿…?»); un aviso sin pregunta va con --para=coordinador',
		);
	if (opciones.length === 1) out.push('una decisión necesita al menos dos --opcion');
	for (const [i, o] of opciones.entries()) {
		out.push(...ownerTextIssues(o).map((w) => `la opción ${i + 1} ${w}`));
		if (i > 0 && RECOMMENDED.test(o))
			out.push(
				'la opción recomendada va primero: --opcion="<la recomendada>" --opcion="<otra>"',
			);
	}
	return out;
}

/** The options of a message to the owner, the recommended one first and marked. */
export const optionsText = (opciones) =>
	(opciones ?? [])
		.map((o, i) => `${i + 1}) ${o.replace(RECOMMENDED, '')}${i ? '' : ' (recomendada)'}`)
		.join(' · ');

/** The `opciones` and `detalle` a message row carries, only when there are any. */
export const messageExtras = ({ opciones, detalle }) => ({
	...(opciones?.length ? { opciones } : {}),
	...(detalle ? { detalle } : {}),
});

/** Shape problems of a message row's `opciones` and `detalle`. */
export function messageExtraIssues(m) {
	const out = [];
	const list = (x) => Array.isArray(x) && x.every((o) => typeof o === 'string' && o.trim());
	if (m.opciones !== undefined && !list(m.opciones))
		out.push('opciones debe ser una lista de texto');
	if (m.detalle !== undefined && typeof m.detalle !== 'string')
		out.push('detalle debe ser texto');
	return out;
}
