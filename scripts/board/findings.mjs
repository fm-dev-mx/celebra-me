/**
 * d251 (T212): a cross review that closes with veredicto `cambios` sends its findings straight to the author.
 * `close` stores one bitácora message about the origin task to its author agent, naming the author's session;
 * the coordinator no longer lists «Pasar los hallazgos de T<n> al autor» for a round whose message was sent.
 * Claude sessions read it with `pnpm board inbox --agente=claude`. Pure functions only: next.mjs and
 * close-commands.mjs share them.
 */
import {
	authorOf,
	buildMessageRow,
	findTask,
	normalizePr,
	reviewRound,
	taskTag,
} from './model.mjs';

/** The author's session of `t`: the lock's while the author holds it, else the last recorded session. */
export function authorSession(t, author) {
	const c = t.candado;
	if (c?.agente === author && c.sesion) return { id: c.sesion, nombre: c.titulo };
	const s = t.sesion;
	return s?.agente === author && s.id ? { id: s.id, nombre: s.nombre } : null;
}

/** «P2 scripts/board/next.mjs:199 texto», one finding as the message lists it. */
const findingText = (h) => [h.p, h.archivo, h.texto].filter(Boolean).join(' ');

/**
 * The message a closed review round `r` sends to its origin's author, `{tarea, de, para, texto, revision, sesion?}`,
 * or null when the round did not ask for changes, has no origin or the author is unknown.
 */
export function findingsNotice(r, board) {
	const res = r?.cierre?.resultado;
	if (res?.veredicto !== 'cambios' || r.estado === 'cancelada') return null;
	const origin = findTask(r.origen, board);
	const para = origin && authorOf(origin);
	if (!para) return null;
	const sesion = authorSession(origin, para);
	const at = [
		normalizePr(r.cierre.pr ?? origin.pr),
		String(res.sha ?? r.revisionSha ?? '').slice(0, 7),
	]
		.filter(Boolean)
		.join('@');
	const finds = (res.hallazgos ?? []).map(findingText);
	const texto = [
		`${taskTag(r)} (vuelta ${reviewRound(r)}) pide cambios en ${taskTag(origin)}${at ? ` (${at})` : ''}`,
		...(sesion?.nombre ? [` para la sesión «${sesion.nombre}»`] : []),
		finds.length
			? `: ${finds.join(' · ')}`
			: ': sin hallazgos escritos, vea el cierre de la revisión',
	].join('');
	return {
		tarea: origin.id,
		de: authorOf(r) ?? 'coordinador',
		para,
		texto,
		revision: r.id,
		...(sesion ? { sesion: sesion.id } : {}),
	};
}

/** The findings messages already sent for review round `id`. */
export const findingsSent = (id, board) =>
	(board.bitacora ?? []).filter((row) => row.mensaje?.revision === id);

/** Whether `notice` still has to be written: no message for its round carries the same text. */
export const findingsPending = (notice, board) =>
	Boolean(notice) &&
	!findingsSent(notice.revision, board).some((row) => row.mensaje.texto === notice.texto);

/** The bitácora row of `notice`: a T126 message that also names its review round and the author's session. */
export function findingsRow(notice, id, en) {
	const row = buildMessageRow(notice.tarea, { ...notice, id }, en);
	const { revision, sesion } = notice;
	return { ...row, mensaje: { ...row.mensaje, revision, ...(sesion ? { sesion } : {}) } };
}
