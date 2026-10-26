/**
 * d291: a review round that ended without a verdict (cancelled, or still open when `review` replaces it) answered
 * nothing, so the next round reviews the whole PR instead of the diff since that round's SHA, and its prompt
 * carries what those rounds left: their bitácora messages, any findings in their cierre and the reports they
 * name. It also builds each round's child task (T79, T160). Pure functions only.
 */
import {
	CONTRATO,
	isFinished,
	laneFolder,
	READONLY_LANE,
	reviewRound,
	reviewRounds,
	taskTag,
} from './model.mjs';
import { reviewVerdict } from './next.mjs';
import { reviewText } from './prompt.mjs';

/** A message's text is cut here so one long report never fills the prompt. */
const MAX_NOTE = 1200;
/** A long chain of cancelled rounds keeps only its newest notes, so the prompt stays bounded. */
const MAX_NOTES = 20;
/** Report paths a reviewer names in its messages or summary (`.agent/tmp/reports/…`). */
const REPORT = /\.agent\/tmp\/reports\/[^\s,;:)»"'`]+/g;

/**
 * Whether round `r` ended (or is about to be replaced) without a verdict: an open round never answered (a close with
 * a verdict ends it, d274), whatever partial cierre it has.
 */
export const unanswered = (r) => Boolean(r) && (!isFinished(r) || !reviewVerdict(r));

/** The rounds of `origen` after its last round with a verdict, oldest first; empty when the last one answered. */
export function unansweredRounds(origen, board) {
	const rounds = reviewRounds(origen, board);
	const out = [];
	for (let i = rounds.length - 1; i >= 0 && unanswered(rounds[i]); i--) out.unshift(rounds[i]);
	return out;
}

const cut = (s) => {
	const text = String(s ?? '')
		.replace(/\s+/g, ' ')
		.trim();
	return text.length > MAX_NOTE ? `${text.slice(0, MAX_NOTE - 1)}…` : text;
};

/**
 * What the unanswered rounds of `origen` left, `null` when its last round has a verdict (or there is none):
 * `{vueltas: ['T298'], notas: ['T298 · codex → coordinador: texto'], informes: ['.agent/tmp/reports/…']}`.
 * Notes are the rounds' bitácora messages and the findings or summary their cierre kept, oldest first; past
 * MAX_NOTES, one line counts the oldest ones it drops.
 */
export function leftByUnanswered(origen, board) {
	const rounds = unansweredRounds(origen, board);
	if (!rounds.length) return null;
	const notas = [];
	const informes = new Set();
	const seen = (text) => {
		for (const m of String(text ?? '').matchAll(REPORT))
			informes.add(m[0].replace(/[.…]+$/, ''));
	};
	for (const r of rounds) {
		const tag = taskTag(r);
		const rows = (board.bitacora ?? [])
			.filter((row) => row.mensaje && (row.tarea === r.id || row.mensaje.revision === r.id))
			.sort((a, b) => String(a.en).localeCompare(String(b.en)));
		for (const row of rows) {
			seen(row.mensaje.texto);
			notas.push(
				`${tag} · ${row.quien ?? '¿?'} → ${row.mensaje.para}: ${cut(row.mensaje.texto)}`,
			);
		}
		for (const h of r.cierre?.resultado?.hallazgos ?? [])
			notas.push(
				`${tag} · hallazgo: ${cut([h.p, h.archivo, h.texto].filter(Boolean).join(' '))}`,
			);
		seen(r.cierre?.resumen);
	}
	const dropped = notas.length - (MAX_NOTES - 1);
	if (notas.length > MAX_NOTES)
		notas.splice(0, dropped, `… ${dropped} notas anteriores omitidas`);
	return { vueltas: rounds.map((r) => taskTag(r)), notas, informes: [...informes] };
}

/** The id of the next review round of `src`, after `prev` (the latest round, if any). */
export function reviewChildId(src, prev) {
	const n = prev ? reviewRound(prev) + 1 : 1;
	return n > 1 ? `${src.id}-revision-${n}` : `${src.id}-revision`;
}

/**
 * The child task of the next review round of `src`, after `prev`, numbered `num` (T160); `previas` is what rounds
 * without a verdict left (d291, leftByUnanswered).
 */
export function reviewChild(
	src,
	{ agente, revisor, sha, prev, num, files, previas, generado = new Date().toISOString() },
) {
	const n = prev ? reviewRound(prev) + 1 : 1;
	const id = reviewChildId(src, prev);
	return {
		id,
		...reviewText(src, {
			id,
			num,
			n,
			sha,
			prev,
			files,
			agente,
			revisor,
			generado,
			carril: READONLY_LANE,
			carpeta: laneFolder('integration'),
			previas,
		}),
		estado: 'pendiente',
		urgencia: src.urgencia,
		actor: 'sesion',
		agente,
		...(revisor ? { revisor } : {}),
		tipo: 'revision',
		contrato: CONTRATO,
		origen: src.id,
		revisionSha: sha,
		...(files ? { revisionFiles: files } : {}),
		vuelta: n,
		requisitos: [{ tipo: 'revision', ref: src.id }],
		...(src.rama ? { rama: src.rama } : {}),
		...(src.pr ? { pr: src.pr } : {}),
	};
}
