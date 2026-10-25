/**
 * prompt-v1 (T160): the board prompt format the owner approved on 2026-10-24. Line 1 is the session name
 * (d158), then Spanish sections in a fixed order, then a METADATOS block of `clave: valor` lines. A prompt
 * without `formato: prompt-v1` is legacy and keeps its old rules, so saved prompts keep working.
 * No Node APIs: the view imports this module through model.mjs.
 */
export const PROMPT_FORMAT = 'prompt-v1';

export const PROMPT_SECTIONS = [
	'QUÉ SE BUSCA',
	'ANTES DE EMPEZAR',
	'PASOS',
	'AUTORIZO',
	'NO HAGAS',
	'DECISIONES',
	'PARE Y PREGUNTE SI',
	'AL TERMINAR',
	'METADATOS',
];

/** METADATOS keys, in their usual order; `corre` holds the lane lines promptWithLane adds when it is copied. */
export const METADATA_KEYS = [
	'formato',
	'tarea',
	'origen',
	'agente',
	'carril',
	'carpeta',
	'rama',
	'base',
	'pr',
	'sha',
	'prerrequisito',
	'decisiones',
	'tablero',
	'generado',
	'corre',
];

/** `<lane> · T<n> · PR #<n> · <description>`, without the PR part before the PR exists (d158). */
const IDENTITY = /^(f\d{2}) · T([1-9]\d*)(?: · PR #[1-9]\d*)? · \S/;

const METADATA_VALUES = {
	sha: [/^[a-f0-9]{40}$/, 'sha debe tener 40 caracteres hexadecimales'],
	pr: [/^#[1-9]\d*$/, 'pr debe ser #<número>'],
	tablero: [/^rev [1-9]\d*$/, 'tablero debe ser «rev N»'],
	formato: [/^prompt-v1$/, 'formato debe ser prompt-v1'],
};

const linesOf = (prompt) => String(prompt ?? '').split('\n');
const metadataStart = (lines) => lines.findLastIndex((l) => l.trim() === 'METADATOS');

/** The METADATOS lines of a prompt as [key, value] pairs (a line without «: » gives a null key), or null. */
function metadataPairs(prompt) {
	const lines = linesOf(prompt);
	const at = metadataStart(lines);
	if (at < 0) return null;
	return lines
		.slice(at + 1)
		.map((l) => l.trim())
		.filter(Boolean)
		.map((l) => {
			const m = /^([a-z][a-z-]*): (.+)$/.exec(l);
			return m ? [m[1], m[2].trim()] : [null, l];
		});
}

/** The METADATOS block as an object (a repeated key keeps its first value), or null without one. */
export function promptMetadata(prompt) {
	const pairs = metadataPairs(prompt);
	if (!pairs) return null;
	const out = {};
	for (const [k, v] of pairs) if (k && !Object.hasOwn(out, k)) out[k] = v;
	return out;
}

export const isPromptV1 = (prompt) => promptMetadata(prompt)?.formato === PROMPT_FORMAT;

/** The lane segment and T<n> of a prompt-v1 identity line, or null. */
export function promptIdentity(prompt) {
	const m = IDENTITY.exec(linesOf(prompt)[0] ?? '');
	return m ? { segmento: m[1], num: Number(m[2]) } : null;
}

/** The trimmed lines of one section, up to the next section heading; null when the prompt lacks it. */
export function promptSection(prompt, name) {
	const lines = linesOf(prompt).map((l) => l.trim());
	const at = lines.indexOf(name);
	if (at < 0) return null;
	const rest = lines.slice(at + 1);
	const next = rest.findIndex((l) => PROMPT_SECTIONS.includes(l));
	return next < 0 ? rest : rest.slice(0, next);
}

/** Shape problems of a prompt-v1; a legacy prompt has none here. */
export function promptV1Issues(prompt) {
	if (!isPromptV1(prompt)) return [];
	const out = [];
	if (!promptIdentity(prompt))
		out.push(
			'prompt-v1: la línea 1 debe ser el nombre de la sesión «<carril> · T<n> · PR #<n> · <descripción>»',
		);
	const lines = linesOf(prompt).map((l) => l.trim());
	let last = -1;
	for (const name of PROMPT_SECTIONS) {
		const at = lines.indexOf(name);
		if (at < 0) out.push(`prompt-v1: falta la sección ${name}`);
		else if (at < last) out.push(`prompt-v1: la sección ${name} está fuera de orden`);
		else last = at;
	}
	if (
		!(promptSection(prompt, 'QUÉ SE BUSCA') ?? []).some((l) =>
			l.startsWith('Terminado cuando:'),
		)
	)
		out.push('prompt-v1: QUÉ SE BUSCA sin «Terminado cuando:»');
	for (const [k, v] of metadataPairs(prompt)) {
		if (!k) out.push(`prompt-v1: línea de METADATOS sin «clave: valor»: ${v}`);
		else if (!METADATA_KEYS.includes(k))
			out.push(`prompt-v1: clave de METADATOS desconocida: ${k}`);
		else if (METADATA_VALUES[k] && !METADATA_VALUES[k][0].test(v))
			out.push(`prompt-v1: ${METADATA_VALUES[k][1]}`);
	}
	return out;
}

/**
 * A prompt-v1 from its identity line, [heading, lines] sections and [key, value] metadata; metadata without a
 * value is left out.
 */
export function buildPrompt({ identidad, secciones, metadatos }) {
	const body = secciones.map(([name, lines]) => [name, ...lines].join('\n'));
	const meta = [['formato', PROMPT_FORMAT], ...metadatos]
		.filter(([, v]) => v !== undefined && v !== null && String(v).trim())
		.map(([k, v]) => `${k}: ${v}`);
	return [identidad, ...body, ['METADATOS', ...meta].join('\n')].join('\n\n');
}

/** `prompt` with each `corre: <line>` appended to its METADATOS block, skipping lines already there. */
export function withRunLines(prompt, lines) {
	const have = new Set(linesOf(prompt).map((l) => l.trim()));
	const add = lines
		.map((l) => `corre: ${String(l).replace(/^Corre en: /, '')}`)
		.filter((l) => !have.has(l));
	return add.length ? `${prompt.replace(/\s+$/, '')}\n${add.join('\n')}` : prompt;
}

const ROUND_WORDS = ['PRIMERA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA', 'SEXTA'];
const roundWord = (n) => `${ROUND_WORDS[n - 1] ?? n} VUELTA`;

/**
 * The title and prompt-v1 (T160) of review round `n` of `src` at `sha`, as task `T<num> <id>`; from round 2 on
 * they name the previous round's SHA and start from the diff between both, so a reviewer never answers the
 * earlier round again (T79). It runs read-only in `carril` (folder `carpeta`).
 */
export function reviewText(src, { id, num, n, sha, prev, agente, generado, carril, carpeta }) {
	const short = (s) => String(s).slice(0, 7);
	const tag = (t, ref) => (t.num ? `T${t.num} ${ref}` : ref);
	const pr = `#${String(src.pr).replace(/^#/, '')}`;
	const round = n < 2 ? '' : ` vuelta ${n}`;
	const name = `f04 · T${num} · PR ${pr} · Revisión${round}`;
	const later = n >= 2;
	const prompt = buildPrompt({
		identidad: name,
		secciones: [
			[
				'QUÉ SE BUSCA',
				[
					`Revisión cruzada${later ? `, ${roundWord(n)},` : ''} del PR ${pr} de ${tag(src, src.id)} en ${sha}: corrección, regresiones, pruebas y AGENTS.md.`,
					...(later
						? [
								`La vuelta anterior (${prev.id}) revisó ${prev.revisionSha}; compruebe que se atendieron sus hallazgos y que los commits nuevos no traen regresiones.`,
							]
						: []),
					`Terminado cuando: los hallazgos están en el PR (gh pr review) y la tarea queda cerrada con --sha=${sha}.`,
				],
			],
			[
				'ANTES DE EMPEZAR',
				[
					`Solo lectura en Integración (carpeta ${carpeta}). Compruebe que la cabeza del PR sigue en ${sha}; si cambió, pare y avise al coordinador.`,
					`  gh pr view ${pr.slice(1)} --json headRefOid --jq .headRefOid`,
					`  pnpm board claim ${id} --agente=${agente} --titulo="${name}"`,
				],
			],
			[
				'PASOS',
				[
					'1. Lea .agent/rules/board.md y la descripción del PR.',
					later
						? `2. Empiece por lo que cambió: git fetch origin && git diff ${prev.revisionSha}..${sha}`
						: `2. Revise el diff completo del PR en ${short(sha)}.`,
					`3. Revise corrección, regresiones, pruebas y AGENTS.md${later ? ' donde llega el diff' : ''}.`,
					'4. Publique los hallazgos con gh pr review.',
				],
			],
			['AUTORIZO', [`(solo lectura) Publicar la revisión del PR ${pr} con gh pr review.`]],
			[
				'NO HAGAS',
				['- No edite el carril del autor ni una el PR.', '- No pida permisos adyacentes.'],
			],
			[
				'DECISIONES',
				[
					'- d183: revisión cruzada por otro agente.',
					'- Solo revisión: informe la evidencia que falte.',
				],
			],
			[
				'PARE Y PREGUNTE SI',
				[
					`La cabeza del PR ya no es ${sha} o falta evidencia para decidir. Anote cada pregunta al dueño también con pnpm board msg ${id} --de=${agente} --para=dueno "<pregunta>" (d230).`,
				],
			],
			[
				'AL TERMINAR',
				[
					`1. pnpm board close ${id} --resumen=… --comprobacion=… --saltada=… --veredicto=aprobado|cambios|bloqueado --sha=${sha} --hallazgo="P2|archivo:línea|texto"`,
					'2. Avise al coordinador con la línea que imprime close.',
					'3. Responda: qué revisó, comprobaciones corridas y saltadas, riesgos.',
				],
			],
		],
		metadatos: [
			['tarea', `T${num} ${id}`],
			['origen', tag(src, src.id)],
			['agente', agente],
			['carril', `${carril} (solo lectura)`],
			['carpeta', carpeta],
			['rama', src.rama],
			['pr', pr],
			['sha', sha],
			['prerrequisito', later ? prev.id : undefined],
			['decisiones', 'd183'],
			['tablero', 'rev 1'],
			['generado', generado],
		],
	});
	const titulo = later
		? `Revisión cruzada, vuelta ${n} (${short(sha)}): ${src.titulo}`
		: `Revisión cruzada: ${src.titulo}`;
	return { titulo, prompt };
}
