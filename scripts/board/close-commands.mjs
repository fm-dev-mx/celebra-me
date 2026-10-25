/**
 * `pnpm board` writes of how a task ends (d178, T129): `close` writes the closing summary and prints its one-line
 * signal, and a cancellation, by hand or of a replaced review round, writes its cierre in the same command.
 */
import { randomBytes } from 'node:crypto';
import { UsageError, say } from './cli.mjs';
import { buildCierre, cancelCierre, cierreIssues, cierreLines, signalLine } from './cierre.mjs';
import { findingsNotice, findingsPending, findingsRow } from './findings.mjs';
import { VEREDICTOS, isFinished, isReview, logRowError, quienOf, unlocked } from './model.mjs';
import { cadaMs, nextCycle } from './recurring.mjs';
import { appendLog, loadBoard, readDoc, withLock } from './store.mjs';

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const need = (v, msg) => {
	if (!v || v === true) throw new UsageError(msg);
	return v;
};

/**
 * `set <id> estado=cancelada --motivo=…`: the cancelled task gets its cierre with the reason as summary, so
 * «Archivar» never lacks one. A task that already has a summary may omit the reason.
 */
export function cancelOnSet(before, merged, flags) {
	if (merged.estado !== 'cancelada' || before.estado === 'cancelada') return merged;
	const motivo = typeof flags.motivo === 'string' ? flags.motivo.trim() : '';
	if (!motivo && !before.cierre?.resumen)
		throw new UsageError('falta --motivo=<por qué se cancela> (queda como resumen de cierre)');
	const cierre = cancelCierre(before.cierre, motivo, { en: nowIso(), quien: quienOf(flags) });
	return { ...merged, cierre };
}

/**
 * `review` opened round `saved` on a new head: an earlier round still open reviews a stale SHA, so it is cancelled
 * with its cierre and its lock goes. Returns the cancelled task, or null.
 */
export function cancelReplaced(dir, saveTask, { prev, saved, sha, who }) {
	const live = prev && !isFinished(prev) && readDoc(dir, 'tareas', prev.id);
	if (!live) return null;
	const from = String(prev.revisionSha).slice(0, 7);
	const motivo = `Reemplazada por la vuelta ${saved.vuelta} (${sha.slice(0, 7)}): el PR cambió de ${from}.`;
	const cierre = cancelCierre(live.cierre, motivo, { en: nowIso(), quien: quienOf(who) });
	return saveTask(
		dir,
		live,
		{ ...unlocked(live, {}), estado: 'cancelada', cierre },
		{ ...who, corrio: 'pnpm board review' },
	);
}

/**
 * d251 (T212): a review round closed with `cambios` sends its findings to the origin's author as a message, once
 * per text; returns the line `close` prints about it, or null.
 */
function sendFindings(dir, t, board) {
	const notice = findingsNotice(t, board);
	if (!findingsPending(notice, board)) return null;
	const en = nowIso();
	const row = findingsRow(notice, `${en}-${randomBytes(3).toString('hex')}`, en);
	const why = logRowError(row);
	if (why) throw new UsageError(why);
	appendLog(dir, row);
	return `hallazgos enviados a ${notice.para} sobre ${notice.tarea} (pnpm board inbox --agente=${notice.para})`;
}

/**
 * d274: an open review whose cierre carries a verdict is done, `cambios` included (the next round is another task),
 * and its lock goes. `after` is returned unchanged for any other task. The caller has already checked the cierre.
 */
export function reviewDone(before, after, flags) {
	if (!isReview(before) || isFinished(before)) return after;
	if (!VEREDICTOS.includes(after.cierre?.resultado?.veredicto)) return after;
	return { ...unlocked(after, flags), estado: 'hecha' };
}

/**
 * d268: closing an open periodic task (`cada`) ends this cycle only: it goes back to pendiente without its lock,
 * lane, PR or branch, and its `fecha` requisito moves to the next cycle. The cierre stays as the last cycle's.
 * `after` is returned unchanged for any other task.
 */
export function rescheduled(before, after, flags, now = Date.now()) {
	if (!cadaMs(before.cada) || isReview(before) || isFinished(before)) return after;
	const next = {
		...unlocked(after, flags),
		estado: 'pendiente',
		requisitos: nextCycle(after, now),
	};
	for (const k of ['carril', 'pr', 'rama', 'entregada']) delete next[k];
	return next;
}

const cycleLine = (t) => {
	const fechas = (t.requisitos ?? []).filter((r) => r.tipo === 'fecha').map((r) => r.ref);
	return `cada ${t.cada}: vuelve a pendiente hasta ${fechas.join(', ')}`;
};

/** The `close` command; board.mjs passes the task helpers it owns. */
export function closeCommands({ getTask, saveTask, checkRev, assertOwner }) {
	return {
		/** d178: the closing summary a session writes when it finishes (or the coordinator completes). */
		close({ pos, flags, lists }, dir, out) {
			return withLock(dir, () => {
				const before = getTask(dir, need(pos[0], 'falta <id>'));
				if (flags.rev !== undefined) checkRev(before, flags);
				// The lock owner writes it; a declared coordinator completes it, also after the lock is gone.
				if (!flags.coordinador) assertOwner(before, flags);
				const board = loadBoard(dir);
				const cierre = buildCierre(
					before.cierre,
					{ flags, lists },
					board,
					nowIso(),
					before,
				);
				const issues = cierreIssues({ ...before, cierre }, board);
				if (issues.length)
					throw new UsageError(`no se escribió ${before.id}: ${issues.join('; ')}`);
				const closed = reviewDone(before, { ...before, cierre }, flags);
				const next = rescheduled(before, closed, flags);
				const t = saveTask(dir, before, next, {
					...flags,
					seguimiento: true,
				});
				// T129: the one-line signal the agent hands back, built only from the cierre.
				const senal = signalLine(t, board);
				const enviado = sendFindings(dir, t, board);
				const text = [
					`${t.id} con cierre (rev ${t.rev})`,
					...cierreLines(t, board),
					...(enviado ? [enviado] : []),
					...(next === closed ? [] : [cycleLine(t)]),
					senal,
				];
				say(flags, out, { ...t, senal }, text.join('\n'));
			});
		},
	};
}
