/**
 * T130: the prompt-v1 (prompt.mjs) of a task with a `tipo`, built from its kind file (kinds.mjs) and the board.
 * The coordinator writes only `busca` (QUÉ SE BUSCA, with «Terminado cuando:») and, when needed, the task's own
 * `pasos`, `autorizo`, `noHagas`, `lee` and `decisiones`; the lane, the linked decisions' current text and the
 * return contract come from the board, so the prompt changes with them. Pure functions only.
 */
import { taskLabel, laneFolder, taskLane } from './model.mjs';
import { PROMPT_SECTIONS, buildPrompt, promptSection, withPushCheck } from './prompt.mjs';

/** A refusal to build the prompt: the task or its kind lacks something the template needs. */
export class KindPromptError extends Error {}

const LISTO_LINE = {
	'validate:changed': 'pnpm validate:changed en verde.',
	'type-check': 'pnpm validate:changed y pnpm type-check en verde.',
	ci: 'pnpm validate:changed, pnpm type-check y pnpm run ci en verde.',
};

const CLOSE_FLAGS = {
	codigo: (kind, pr) => `--pr=${pr ?? '#<n>'} --sha=<sha del PR> --nivel=${kind.listo_si}`,
	revision: () =>
		'--veredicto=aprobado|cambios|bloqueado --sha=<sha revisado> --hallazgo="P2|archivo:línea|texto"',
};

const RESULT_EXAMPLE = {
	codigo: (kind, pr) => ({ pr: pr ?? '#<n>', sha: '<sha de 40>', nivel: kind.listo_si }),
	revision: () => ({
		veredicto: 'aprobado',
		sha: '<sha revisado>',
		hallazgos: [{ p: 'P2', archivo: 'scripts/x.mjs:12', texto: '…' }],
	}),
};

const oneLine = (s) =>
	String(s ?? '')
		.replace(/\s+/g, ' ')
		.trim();
const byNumber = (a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1));

/**
 * The decisions linked to `t` (its `decisiones`, its `decision` requisitos and the ones naming it in `tareas`),
 * each followed to the decision that replaced it.
 */
export function linkedDecisions(t, decisiones = []) {
	const ids = new Set([
		...(t.decisiones ?? []),
		...(t.requisitos ?? []).filter((r) => r.tipo === 'decision').map((r) => r.ref),
		...decisiones
			.filter((d) => d.vigente !== false && (d.tareas ?? []).includes(t.id))
			.map((d) => d.id),
	]);
	const out = new Map();
	for (const id of ids) {
		let d = decisiones.find((x) => x.id === id);
		if (!d) throw new KindPromptError(`decisión inexistente: ${id}`);
		for (let seen = new Set([d.id]); d.vigente === false;) {
			const next = decisiones.find((x) => x.reemplaza === d.id);
			if (!next || seen.has(next.id)) break;
			seen.add(next.id);
			d = next;
		}
		out.set(d.id, d);
	}
	return [...out.values()].sort(byNumber);
}

/** `{key}` placeholders of a kind's lines filled from `values`; a missing value refuses the prompt. */
const filler = (values, kind) => (line) =>
	line.replace(/\{([a-zA-Z]+)\}/g, (_, k) => {
		if (values[k] === undefined)
			throw new KindPromptError(`falta ${k} para el tipo ${kind.tipo}`);
		return values[k];
	});

/** `T<n> <id>` of a board or archived task, or the id alone. */
function labelIn(board) {
	const all = [...(board.tareas ?? []), ...(board.archivo ?? [])];
	return (id) => {
		const x = all.find((y) => y.id === id);
		return x ? taskLabel(x) : id;
	};
}

/** AL TERMINAR: the validation level, the kind's steps, the close with its contract, the steps after it, the signal. */
function closingLines(t, kind, pr, fill) {
	const close = [
		`pnpm board close ${t.id} --resumen=… --comprobacion=… --saltada=… --pendiente="<texto>→T<n>"`,
		'--fallida=… --riesgo=… --duda=… --excepcion=…',
		...(CLOSE_FLAGS[kind.tipo] ? [CLOSE_FLAGS[kind.tipo](kind, pr)] : []),
	].join(' ');
	const example = RESULT_EXAMPLE[kind.tipo]?.(kind, pr);
	return [
		...(LISTO_LINE[kind.listo_si] ? [LISTO_LINE[kind.listo_si]] : []),
		...kind.al_terminar.map(fill),
		`Cierre (d178, T129): ${close}`,
		...(example ? [`Resultado que guarda el cierre: ${JSON.stringify(example)}`] : []),
		...(kind.tras_cierre ?? []).map(fill),
		'Avise al coordinador con la línea que imprime close.',
		'Responda: qué cambió, comprobaciones corridas y saltadas, riesgos.',
	].map((line, i) => `${i + 1}. ${line}`);
}

const decisionLines = (decisiones) =>
	decisiones.length
		? decisiones.map(
				(d) =>
					`- ${d.id}: ${oneLine(d.decision)}${d.vigente === false ? ' (ya no vigente)' : ''}`,
			)
		: ['- Ninguna todavía: pregunte al inicio en una sola ronda.'];

// A `\n` typed in a shell argument breaks the line too.
const buscaLines = (t) =>
	String(t.busca ?? '')
		.trimEnd()
		.split(/\r?\n|\\n/)
		.map((l) => l.trimEnd());

function metadataOf(t, board, { num, lane, pr, agente, decisiones, rev, generado }) {
	const label = labelIn(board);
	const reqs = (t.requisitos ?? []).filter((r) => r.tipo === 'tarea' || r.tipo === 'revision');
	return [
		['tarea', `T${num} ${t.id}`],
		['origen', t.origen ? label(t.origen) : undefined],
		['agente', agente],
		['carril', lane],
		['carpeta', laneFolder(lane)],
		['rama', t.rama],
		['base', t.rama ? 'develop' : undefined],
		['pr', pr],
		['prerrequisito', reqs.length ? reqs.map((r) => label(r.ref)).join(', ') : 'ninguno'],
		['decisiones', decisiones.map((d) => d.id).join(', ')],
		['tablero', `rev ${rev}`],
		['generado', generado],
	];
}

/**
 * The prompt-v1 of typed task `t` numbered `num`, at board revision `rev`; null while it has no lane (its
 * session name needs one).
 */
export function kindPrompt(t, board, kind, { num = t.num, rev = t.rev, generado }) {
	const lane = taskLane(t);
	if (!lane) return null;
	const pr = t.pr ? `#${String(t.pr).replace(/^#/, '')}` : undefined;
	const nombre = `${lane.split('-')[0]} · T${num}${pr ? ` · PR ${pr}` : ''} · ${oneLine(t.corto ?? t.titulo)}`;
	const agente = t.agente && t.agente !== 'cualquiera' ? t.agente : undefined;
	const fill = filler({ id: t.id, agente: agente ?? '<agente>', rama: t.rama, nombre }, kind);
	const decisiones = linkedDecisions(t, board.decisiones);
	const lee = [...new Set([...kind.lee, ...(t.lee ?? [])])];
	const branch = t.rama ? `, rama ${t.rama} desde origin/develop` : '';
	const noHagas = [...kind.no_hagas, ...(t.noHagas ?? [])].map((l) =>
		l.startsWith('- ') ? l : `- ${l}`,
	);
	return withPushCheck(
		buildPrompt({
			identidad: nombre,
			secciones: [
				['QUÉ SE BUSCA', buscaLines(t)],
				[
					'ANTES DE EMPEZAR',
					[
						`Carril ${lane} (carpeta ${laneFolder(lane)})${branch}. Compruebe la rev del tablero de METADATOS; si cambió, pare.`,
						`Lea AGENTS.md, .agent/rules/board.md y lo que .agent/routing-matrix.yaml pide para: ${lee.join(', ')}.`,
						...kind.pasos_inicio.map((c) => `  ${fill(c)}`),
					],
				],
				['PASOS', (t.pasos ?? kind.pasos).map(fill)],
				['AUTORIZO', [...kind.autorizado_por_defecto, ...(t.autorizo ?? [])].map(fill)],
				['NO HAGAS', noHagas.map(fill)],
				['DECISIONES', decisionLines(decisiones)],
				[
					'PARE Y PREGUNTE SI',
					[
						...kind.pare_si.map(fill),
						`Pregunte al dueño y anote la pregunta también con pnpm board msg ${t.id} --de=${agente ?? '<agente>'} --para=dueno "<pregunta>" (d230).`,
					],
				],
				['AL TERMINAR', closingLines(t, kind, pr, fill)],
			],
			metadatos: metadataOf(t, board, { num, lane, pr, agente, decisiones, rev, generado }),
		}),
	);
}

/** METADATOS keys that change on every write or copy, so a comparison leaves them out. */
const VOLATILE = /^(?:generado|tablero|corre): /;

/** The lines of `prompt` that a regenerated prompt must repeat: all but the volatile METADATOS keys. */
const comparable = (prompt) =>
	String(prompt ?? '')
		.split('\n')
		.map((l) => l.trimEnd())
		.filter((l) => !VOLATILE.test(l.trim()));

/** The sections (and «nombre» for line 1) where two prompts differ, ignoring the volatile METADATOS keys. */
export function promptDiff(saved, fresh) {
	const a = comparable(saved).join('\n');
	const b = comparable(fresh).join('\n');
	if (a === b) return [];
	const out = a.split('\n')[0] === b.split('\n')[0] ? [] : ['nombre'];
	for (const name of PROMPT_SECTIONS) {
		const x = (promptSection(a, name) ?? []).join('\n');
		const y = (promptSection(b, name) ?? []).join('\n');
		if (x !== y) out.push(name);
	}
	return out.length ? out : ['formato'];
}
