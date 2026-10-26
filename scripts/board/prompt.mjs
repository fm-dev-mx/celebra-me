/**
 * prompt-v1 (T160): the board prompt format the owner approved on 2026-10-24. Line 1 is the session name
 * (d158), then Spanish sections in a fixed order, then a METADATOS block of `clave: valor` lines. A prompt
 * without `formato: prompt-v1` is legacy and keeps its old rules, so saved prompts keep working.
 * No Node APIs: the view imports this module through model.mjs.
 */
import { ownerTextIssues } from './owner-text.mjs';

export const PROMPT_FORMAT = 'prompt-v1';

export const PROMPT_SECTIONS = [
	'PARA USTED',
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

/**
 * d230, T322: the command that records a question to the owner: one line, the options with the recommended one
 * first, and the technical detail apart.
 */
export const ownerAsk = (id, agente) =>
	`pnpm board msg ${id} --de=${agente} --para=dueno "<pregunta de una línea>" --opcion="<la recomendada>" --opcion="<otra>" --detalle="<detalle técnico>" (d230)`;

/**
 * T322: the three lines of PARA USTED, in this order, written for the owner in plain Spanish: what the session
 * does, what the owner must do or decide («nada» when nothing) and the main risk.
 */
export const OWNER_LINES = ['Qué hará:', 'Usted:', 'Riesgo:'];

/** T322: PARA USTED from its three texts, each on one line after its OWNER_LINES label. */
const ownerLines = ({ hara, usted, riesgo }) =>
	[hara, usted, riesgo].map(
		(s, i) =>
			`${OWNER_LINES[i]} ${String(s ?? '')
				.replace(/\s+/g, ' ')
				.trim()}`,
	);

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

/** T322: PARA USTED is exactly the three OWNER_LINES, each with text the owner can read; null = no section. */
function paraUstedIssues(section) {
	if (!section) return [];
	const lines = section.filter(Boolean);
	const out = [];
	if (lines.length !== OWNER_LINES.length || lines.some((l, i) => !l.startsWith(OWNER_LINES[i])))
		out.push(`prompt-v1: PARA USTED debe tener 3 líneas: ${OWNER_LINES.join(' … / ')} …`);
	for (const [i, label] of OWNER_LINES.entries()) {
		const line = lines[i] ?? '';
		if (line.startsWith(label) && !line.slice(label.length).trim())
			out.push(`prompt-v1: PARA USTED sin texto en «${label}»`);
	}
	for (const why of ownerTextIssues(lines.join(' ')))
		out.push(`prompt-v1: PARA USTED ${why} (en una tarea con tipo: hara=… usted=… riesgo=…)`);
	return out;
}

/**
 * T322: prompt-v1s saved before PARA USTED existed lack it and stay valid; every generated prompt carries it,
 * and when it is there it must be first and well formed.
 */
const OPTIONAL_SECTION = 'PARA USTED';

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
		if (at < 0 && name === OPTIONAL_SECTION) continue;
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
	out.push(...paraUstedIssues(promptSection(prompt, 'PARA USTED')));
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

/** The pre-push check every code session runs (gatekeeper §5.1, d246); `withPushCheck` adds it to AL TERMINAR. */
const PUSH_CHECK_LINE =
	'- Antes de cada push: pnpm validate:changed (con los cambios aún sin confirmar) y pnpm validate:structure; haga push solo si ambos pasan.';

/** d282: before pushing, the author reviews its own diff and fixes what the review finds. */
const SELF_REVIEW_LINE =
	'- Antes del push: corra /code-review sobre su propio diff (o la revisión equivalente de su agente) y corrija lo que encuentre.';

/**
 * `prompt` with PUSH_CHECK_LINE and SELF_REVIEW_LINE first under AL TERMINAR when it is a prompt-v1 for a
 * session that pushes a branch: one with `rama:` that does not run read-only. Other prompts stay, and one
 * that already has both lines comes back unchanged.
 */
export function withPushCheck(prompt) {
	const meta = promptMetadata(prompt);
	if (meta?.formato !== PROMPT_FORMAT || !meta.rama || /solo lectura/.test(meta.carril ?? ''))
		return prompt;
	const added = [PUSH_CHECK_LINE, SELF_REVIEW_LINE];
	const lines = linesOf(prompt);
	const at = lines.findIndex((l) => l.trim() === 'AL TERMINAR');
	if (at < 0 || added.every((a) => lines.some((l) => l.trim() === a))) return prompt;
	const rest = lines.slice(at + 1).filter((l) => !added.includes(l.trim()));
	return [...lines.slice(0, at + 1), ...added, ...rest].join('\n');
}

const ROUND_WORDS = ['PRIMERA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA', 'SEXTA'];
const roundWord = (n) => `${ROUND_WORDS[n - 1] ?? n} VUELTA`;

/** Conservative path-based review guidance; missing or unrecognized evidence requires a deep review. */
export function reviewRisk(files) {
	if (!Array.isArray(files) || !files.length) return 2;
	const docs = (p) => /^(?:docs\/|\.agent\/|\.gitignore$)|\.(?:md|mdx)$/.test(p);
	const frontend = (p) =>
		/^(?:src\/(?:components|styles|layouts|pages)\/|public\/)/.test(p) &&
		/\.(?:astro|tsx|jsx|scss|css|svg|png|jpe?g|webp|avif|woff2?)$/.test(p);
	if (
		files.some((p) =>
			/(?:^|\/)(?:api|auth|db|database|migrations|security|secrets)(?:\/|[.-])|^(?:supabase|workers)\//i.test(
				p,
			),
		)
	)
		return 2;
	if (files.every(docs)) return 0;
	return files.every((p) => docs(p) || frontend(p)) ? 1 : 2;
}

/** d290: agent rules are governance, so a PR that changes one is never low risk. */
const RULES = /^\.agent\/rules\//;

/**
 * d282, d290: a PR is low risk when GitHub's complete inventory touches only board and agent tooling, tests,
 * docs, `.gitignore` or `.agent` outside `.agent/rules`, and nothing published, persistent or secret (invitation
 * content, Supabase, migrations, payments, secrets, Wrangler, Production). Missing evidence is never low risk.
 */
export function lowRisk(files) {
	if (!Array.isArray(files) || !files.length) return false;
	const tooling = (p) =>
		/^(?:scripts\/(?:board|agent)\/|tests\/|docs\/|\.agent\/|\.gitignore$)|\.(?:md|mdx)$/.test(
			p,
		) && !RULES.test(p);
	const sensitive = (p) =>
		/^(?:src\/content|supabase|workers)\/|(?:^|\/)(?:migrations?|secrets?|payments?|pagos?)(?:\/|[.-])|wrangler|\.env|produc(?:tion|cion)/i.test(
			p,
		);
	return files.every((p) => tooling(p) && !sensitive(p));
}

/**
 * d282: «bajo», «medio» or «alto» (reviewRisk below 2, or 2). d290: a change to `.agent/rules` is «alto», like
 * any unclassified path.
 */
export const reviewLevel = (files) => {
	if (lowRisk(files)) return 'bajo';
	if (Array.isArray(files) && files.some((p) => RULES.test(p))) return 'alto';
	return reviewRisk(files) === 2 ? 'alto' : 'medio';
};

/**
 * d288: a Claude subagent with a clean context may review Claude's PR of low or medium risk; high risk
 * (migrations, auth, APIs, unclassified paths) and release work keep Codex or Gemini.
 */
export const subagentReview = (files, task) =>
	reviewLevel(files) !== 'alto' && task?.tipo !== 'release' && task?.categoria !== 'release';

export function reviewGuidance(files, previousSha, sha) {
	const tier = reviewRisk(files);
	return [
		[
			'Tier 0 · Metadatos/docs: validación ágil de enlaces, consistencia y alcance; se sugiere un modelo ligero.',
			'Tier 1 · UI/Frontend: revise interacción, accesibilidad, estilos y regresiones; valide las superficies afectadas.',
			'Tier 2 · DB/Auth/APIs o alcance sin clasificar: revisión profunda de contratos, permisos, errores y pruebas.',
		][tier],
		'El nivel orienta el esfuerzo; no reduce las comprobaciones exigidas por el contrato ni las reglas del repositorio.',
		...(previousSha && sha
			? [
					`Enfoque la revisión en el diff incremental ${previousSha}..${sha} (prev.revisionSha..HEAD, fijado al SHA solicitado). Verifique los hallazgos previos y amplíe a contexto relacionado cuando el cambio lo requiera; no repita la revisión completa sin motivo.`,
				]
			: []),
	];
}

/** T322: PARA USTED of a review round: read-only, and the owner has nothing to do. */
const reviewOwnerLines = (pr, later) =>
	ownerLines({
		hara: `${later ? 'revisa otra vez' : 'revisa'} el PR ${pr}${later ? ' tras los cambios del autor' : ''} sin cambiar código y publica lo que encuentre.`,
		usted: 'nada; el coordinador une el PR cuando la revisión lo aprueba.',
		riesgo: 'ninguno; la revisión solo lee el código.',
	});

/**
 * d291: the QUÉ SE BUSCA lines of a round after rounds without a verdict (`previas`): which rounds, what their
 * bitácora and cierre kept and the reports they named, so the findings they reached are checked again.
 */
function leftLines({ vueltas, notas, informes }, sha) {
	const which = vueltas.join(', ');
	return [
		`${which} ${vueltas.length > 1 ? 'terminaron' : 'terminó'} sin veredicto (cancelada o reemplazada): revise el PR completo en ${sha}, no solo el diff desde su SHA, y compruebe cada hallazgo que dejó.`,
		...(notas.length
			? ['Lo que dejó en la bitácora:', ...notas.map((x) => `- ${x}`)]
			: [`${which} no dejó mensajes ni hallazgos en la bitácora.`]),
		...informes.map((p) => `Informe: ${p} (en Integración; léalo si existe).`),
	];
}

/** The DECISIONES lines of a review round and its METADATOS `decisiones` (d183, d288, d291). */
function reviewDecisions(sub, left) {
	return {
		lineas: [
			sub
				? '- d288: riesgo bajo o medio; la revisa un subagente de Claude con contexto limpio, no la sesión autora.'
				: '- d183: revisión cruzada por otro agente.',
			...(left
				? [
						'- d291: la vuelta anterior no dejó veredicto; esta revisa el PR completo y comprueba lo que dejó.',
					]
				: []),
			'- Solo revisión: informe la evidencia que falte.',
		],
		ids: [sub ? 'd183, d288' : 'd183', ...(left ? ['d291'] : [])].join(', '),
	};
}

/**
 * The title and prompt-v1 (T160) of review round `n` of `src` at `sha`, as task `T<num> <id>`; from round 2 on
 * they name the previous round's SHA and start from the diff between both, so a reviewer never answers the
 * earlier round again (T79). d291: `previas` (rounds.mjs leftByUnanswered) means the rounds since the last verdict
 * answered nothing, so this one reviews the whole PR and carries what they left. It runs read-only in `carril`
 * (folder `carpeta`).
 */
export function reviewText(
	src,
	{ id, num, n, sha, prev, files, agente, revisor, generado, carril, carpeta, previas },
) {
	// d288: a low- or medium-risk PR by Claude is reviewed by a clean-context subagent the author session launches.
	const sub = revisor === 'subagente';
	const short = (s) => String(s).slice(0, 7);
	const tag = (t, ref) => (t.num ? `T${t.num} ${ref}` : ref);
	const pr = `#${String(src.pr).replace(/^#/, '')}`;
	const round = n < 2 ? '' : ` vuelta ${n}`;
	const name = `f04 · T${num} · PR ${pr} · Revisión${round}`;
	const later = n >= 2;
	// d291: after a round without a verdict, nothing reviewed the earlier diff, so the whole PR is in scope.
	const left = later ? previas : undefined;
	const incremental = later && !left;
	const decided = reviewDecisions(sub, left);
	const prompt = buildPrompt({
		identidad: name,
		secciones: [
			['PARA USTED', reviewOwnerLines(pr, later)],
			[
				'QUÉ SE BUSCA',
				[
					`Revisión cruzada${later ? `, ${roundWord(n)},` : ''} del PR ${pr} de ${tag(src, src.id)} en ${sha}: corrección, regresiones, pruebas y AGENTS.md.`,
					...(sub
						? [
								'Riesgo bajo o medio (d288): la hace un subagente de Claude con contexto limpio; la sesión autora toma y cierra esta vuelta con su veredicto.',
							]
						: []),
					...reviewGuidance(files, incremental ? prev?.revisionSha : undefined, sha),
					...(incremental
						? [
								`La vuelta anterior (${prev.id}) revisó ${prev.revisionSha}; compruebe que se atendieron sus hallazgos y que los commits nuevos no traen regresiones.`,
							]
						: []),
					...(left ? leftLines(left, sha) : []),
					sub
						? `Terminado cuando: los hallazgos están en el PR (gh pr review --comment) y el veredicto, el SHA ${sha} y los hallazgos vuelven a la sesión autora.`
						: `Terminado cuando: los hallazgos están en el PR (gh pr review) y la tarea queda cerrada con --sha=${sha}.`,
				],
			],
			[
				'ANTES DE EMPEZAR',
				[
					`Solo lectura en Integración (carpeta ${carpeta}). Compruebe que la cabeza del PR sigue en ${sha}; si cambió, pare y avise al coordinador.`,
					`  gh pr view ${pr.slice(1)} --json headRefOid --jq .headRefOid`,
					...(sub
						? ['No tome ni cierre la tarea del tablero: lo hace la sesión autora.']
						: [`  pnpm board claim ${id} --agente=${agente} --titulo="${name}"`]),
				],
			],
			[
				'PASOS',
				[
					'1. Lea .agent/rules/board.md y la descripción del PR.',
					incremental
						? `2. Empiece por lo que cambió: git fetch origin && git diff ${prev.revisionSha}..${sha}`
						: `2. Revise el diff completo del PR en ${short(sha)}.`,
					`3. Revise corrección, regresiones, pruebas y AGENTS.md${incremental ? ' donde llega el diff' : ''}.`,
					sub
						? '4. Publique los hallazgos con gh pr review --comment (la cuenta de GitHub es la del autor).'
						: '4. Publique los hallazgos con gh pr review.',
				],
			],
			['AUTORIZO', [`(solo lectura) Publicar la revisión del PR ${pr} con gh pr review.`]],
			[
				'NO HAGAS',
				['- No edite el carril del autor ni una el PR.', '- No pida permisos adyacentes.'],
			],
			['DECISIONES', decided.lineas],
			[
				'PARE Y PREGUNTE SI',
				[
					`La cabeza del PR ya no es ${sha} o falta evidencia para decidir. Anote cada pregunta al dueño también con ${ownerAsk(id, agente)}.`,
				],
			],
			[
				'AL TERMINAR',
				sub
					? [
							`1. Devuelva a la sesión autora: veredicto aprobado|cambios|bloqueado, SHA ${sha}, cada hallazgo como «P2|archivo:línea|texto», comprobaciones corridas y saltadas.`,
							`2. La sesión autora cierra: pnpm board close ${id} --resumen=… --comprobacion=… --saltada=… --veredicto=… --sha=${sha} --hallazgo=…`,
						]
					: [
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
			['decisiones', decided.ids],
			['tablero', 'rev 1'],
			['generado', generado],
		],
	});
	const titulo = later
		? `Revisión cruzada, vuelta ${n} (${short(sha)}): ${src.titulo}`
		: `Revisión cruzada: ${src.titulo}`;
	return { titulo, prompt };
}
