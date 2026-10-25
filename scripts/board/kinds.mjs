/**
 * T130 task kinds: one short `.agent/kinds/<tipo>.yaml` per `tipo`, read here for `pnpm board prompt`, `add`,
 * `set`, `plan` and `board:verify`. The files use a small YAML subset (`clave: 'valor'`, `clave:` with
 * `- 'item'` lines, `clave: []`, full-line comments), so no YAML dependency is needed; anything else is refused.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NIVELES, RESULT_FIELDS, TIPOS } from './model.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const KINDS_DIR = join(ROOT, '.agent', 'kinds');
const ROUTING_MATRIX = join(ROOT, '.agent', 'routing-matrix.yaml');

const SCALARS = ['tipo', 'descripcion', 'listo_si'];
const LISTS = [
	'lee',
	'pasos_inicio',
	'pasos',
	'autorizado_por_defecto',
	'no_hagas',
	'pare_si',
	'devuelve',
	'al_terminar',
];
/** Lists that may be empty: a kind may return no typed resultado and add no closing step. */
const MAY_BE_EMPTY = new Set(['devuelve', 'al_terminar']);
export const PLACEHOLDERS = ['id', 'agente', 'rama', 'nombre'];
export const LISTO_SI = [...NIVELES, 'ninguno'];

/** `'it''s'` → `it's`, `"x"` → `x`, a plain value as written. */
function unquote(v) {
	const s = v.trim();
	if (s.length >= 2 && s.startsWith("'") && s.endsWith("'"))
		return s.slice(1, -1).replaceAll("''", "'");
	if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
	return s;
}

/** The kind document of `text`, or throws with the line that breaks the subset. */
export function parseKind(text) {
	const doc = {};
	let list = null;
	for (const [i, raw] of String(text).split(/\r?\n/).entries()) {
		const line = raw.trimEnd();
		if (!line.trim() || line.trim().startsWith('#')) continue;
		const item = /^\s+- (.+)$/.exec(line);
		if (item) {
			if (!list) throw new Error(`línea ${i + 1}: elemento de lista sin clave`);
			list.push(unquote(item[1]));
			continue;
		}
		const pair = /^([a-z_]+):(?: (.*))?$/.exec(line);
		if (!pair) throw new Error(`línea ${i + 1}: no es «clave: valor» ni «  - elemento»`);
		const [, key, value = ''] = pair;
		if (Object.hasOwn(doc, key)) throw new Error(`línea ${i + 1}: clave repetida ${key}`);
		list = null;
		if (!value.trim()) doc[key] = list = [];
		else if (value.trim() === '[]') doc[key] = [];
		else doc[key] = unquote(value);
	}
	return doc;
}

/** The task_type names of the routing matrix; a kind's `lee` points at them instead of copying their lists. */
export function routingTaskTypes(file = ROUTING_MATRIX) {
	return [...readFileSync(file, 'utf8').matchAll(/^\s*- task_type: '([a-z_]+)'/gm)].map(
		(m) => m[1],
	);
}

/** Keys, scalars and lists of a kind document. */
function shapeIssues(doc) {
	const out = Object.keys(doc)
		.filter((k) => !SCALARS.includes(k) && !LISTS.includes(k))
		.map((k) => `clave desconocida: ${k}`);
	for (const k of SCALARS)
		if (typeof doc[k] !== 'string' || !doc[k].trim()) out.push(`falta ${k}`);
	for (const k of LISTS)
		if (!Array.isArray(doc[k])) out.push(`${k} debe ser una lista`);
		else if (!doc[k].length && !MAY_BE_EMPTY.has(k)) out.push(`${k} está vacía`);
	return out;
}

/** What the kind returns and how it is validated: the T129 resultado fields and its level. */
function contractIssues(doc, file) {
	const out = [];
	const want = RESULT_FIELDS[file] ?? [];
	if (Array.isArray(doc.devuelve) && doc.devuelve.join(',') !== want.join(','))
		out.push(`devuelve debe ser [${want.join(', ')}], el contrato de T129`);
	if (doc.listo_si && !LISTO_SI.includes(doc.listo_si))
		out.push(`listo_si debe ser ${LISTO_SI.join('/')}`);
	else if (want.includes('nivel') && !NIVELES.includes(doc.listo_si))
		out.push(`listo_si debe ser ${NIVELES.join('/')}: el cierre devuelve ese nivel`);
	return out;
}

/** Shape problems of kind `doc` read from `<file>.yaml`, checked against the routing task types. */
export function kindIssues(doc, file, taskTypes) {
	const out = [];
	if (doc.tipo !== file) out.push(`tipo debe ser ${file}, como el archivo`);
	if (!TIPOS.includes(file)) out.push(`tipo desconocido: ${file}`);
	out.push(...shapeIssues(doc), ...contractIssues(doc, file));
	for (const t of doc.lee ?? [])
		if (!taskTypes.includes(t)) out.push(`lee: ${t} no es un task_type de routing-matrix.yaml`);
	const text = LISTS.flatMap((k) => (Array.isArray(doc[k]) ? doc[k] : [])).join('\n');
	for (const [, name] of text.matchAll(/\{([a-zA-Z]+)\}/g))
		if (!PLACEHOLDERS.includes(name)) out.push(`marcador desconocido: {${name}}`);
	return [...new Set(out)];
}

/**
 * Every kind file: `{ kinds: {tipo: doc}, issues: [{id, msg}] }`. A kind with problems stays out of `kinds`, so
 * no prompt is generated from it; a missing file is an issue too.
 */
export function loadKinds(dir = KINDS_DIR, taskTypes = routingTaskTypes()) {
	const kinds = {};
	const issues = [];
	for (const tipo of TIPOS) {
		let doc;
		try {
			doc = parseKind(readFileSync(join(dir, `${tipo}.yaml`), 'utf8'));
		} catch (e) {
			issues.push({
				id: `kinds/${tipo}`,
				msg: e.code === 'ENOENT' ? 'falta el archivo' : e.message,
			});
			continue;
		}
		const msgs = kindIssues(doc, tipo, taskTypes);
		for (const msg of msgs) issues.push({ id: `kinds/${tipo}`, msg });
		if (!msgs.length) kinds[tipo] = doc;
	}
	return { kinds, issues };
}
