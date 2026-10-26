/**
 * `pnpm board` writes of how a task ends (d178, T129): `close` writes the closing summary and prints its one-line
 * signal, and a cancellation, by hand or of a replaced review round, writes its cierre in the same command.
 */
import { randomBytes } from 'node:crypto';
import { UsageError, say } from './cli.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { changelogMarkdown, changelogNotes, missingNotes } from './changelog.mjs';
import { buildCierre, cancelCierre, cierreIssues, cierreLines, signalLine } from './cierre.mjs';
import { findingsNotice, findingsPending, findingsRow } from './findings.mjs';
import {
	HANDOFF_LISTS,
	VEREDICTOS,
	isFinished,
	isReview,
	logRowError,
	normalizePr,
	quienOf,
	unlocked,
} from './model.mjs';
import { checkoutState, finishGitSafety, finishOps, lockLaneIssue } from './lane-session.mjs';
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
 * d268: closing a started cycle of a periodic task (`cada`) ends that cycle only: it goes back to pendiente
 * without its lock, lane, PR or branch, the PR joins `prsPrevios` (so sync never matches it again) and its `fecha`
 * requisito moves to the next cycle. The cierre stays as the last cycle's. A task still pendiente has no cycle
 * running, so a second close (an amended summary, a retry) keeps the date. `after` is returned unchanged for any
 * other task.
 */
export function rescheduled(before, after, flags, now = Date.now()) {
	const started = !isFinished(before) && (before.estado ?? 'pendiente') !== 'pendiente';
	if (!cadaMs(before.cada) || isReview(before) || !started) return after;
	// This cycle's PRs: the task's own and the one this close names (`--pr`), never a cierre PR inherited from an
	// earlier cycle when no --pr was given.
	const given = typeof flags.pr === 'string' ? normalizePr(flags.pr) : undefined;
	const previos = Array.isArray(before.prsPrevios) ? before.prsPrevios : [];
	const nuevos = [normalizePr(before.pr), given].filter(
		(pr, i, all) => typeof pr === 'string' && pr.startsWith('#') && all.indexOf(pr) === i,
	);
	const prsPrevios = [...previos, ...nuevos.filter((pr) => !previos.includes(pr))];
	const next = {
		...unlocked(after, flags),
		estado: 'pendiente',
		requisitos: nextCycle(after, now),
		...(prsPrevios.length ? { prsPrevios } : {}),
	};
	for (const k of ['carril', 'pr', 'rama', 'entregada']) delete next[k];
	return next;
}

/**
 * d290: a valid close finishes the task in the same command: a task with a PR waits in «en revision» for its
 * cross review (the lock stays, so the author can answer the findings), any other is «hecha» and its lock
 * goes. Review rounds, periodic tasks and tasks already finished keep their own rules.
 */
export function settled(before, after, flags) {
	if (isReview(before) || isFinished(before) || cadaMs(before.cada)) return after;
	// «Todos los campos»: a close that leaves a Handoff list out is a partial summary, so the task stays.
	if (!HANDOFF_LISTS.every(([field]) => after.cierre?.[field] !== undefined)) return after;
	const pr = normalizePr(after.pr) ?? after.cierre?.pr ?? after.cierre?.resultado?.pr;
	if (pr) return { ...after, pr, estado: 'en revision' };
	return { ...unlocked(after, flags), estado: 'hecha' };
}

/** The cierre `close` writes; a malformed --changelog is the caller's mistake, not a crash. */
function closingCierre(before, args, board) {
	try {
		return buildCierre(before.cierre, args, board, nowIso(), before);
	} catch (e) {
		if (String(e?.message).startsWith('--changelog'))
			throw new UsageError(e.message, { cause: e });
		throw e;
	}
}

const cycleLine = (t) => {
	const fechas = (t.requisitos ?? []).filter((r) => r.tipo === 'fecha').map((r) => r.ref);
	return `cada ${t.cada}: vuelve a pendiente hasta ${fechas.join(', ')}`;
};

/** The `close` command; board.mjs passes the task helpers it owns. */
export function closeCommands({
	getTask,
	saveTask,
	checkRev,
	assertOwner,
	overrideReason,
	noteOverride,
}) {
	return {
		/** d178: the closing summary a session writes when it finishes (or the coordinator completes). */
		close({ pos, flags, lists }, dir, out) {
			const ops = finishOps(flags['git-safety']);
			const checkout = checkoutState();
			return withLock(dir, () => {
				const before = getTask(dir, need(pos[0], 'falta <id>'));
				if (flags.rev !== undefined) checkRev(before, flags);
				// The lock owner writes it; a declared coordinator completes it, also after the lock is gone.
				if (!flags.coordinador) assertOwner(before, flags);
				// T297: run from a lane, it must be the lock's.
				const laneIssue = lockLaneIssue(checkout, before);
				if (laneIssue) throw new UsageError(laneIssue);
				// d290: the coordinator's close moves the task on only when no lock is live, and says so.
				const override = overrideReason(before.candado, flags);
				const moves = !flags.coordinador || !before.candado || Boolean(override);
				const board = loadBoard(dir);
				const cierre = closingCierre(before, { flags, lists }, board);
				const issues = cierreIssues({ ...before, cierre }, board);
				if (issues.length)
					throw new UsageError(`no se escribió ${before.id}: ${issues.join('; ')}`);
				const closed = reviewDone(before, { ...before, cierre }, flags);
				const next = rescheduled(before, closed, flags);
				const final = next === closed && moves ? settled(before, closed, flags) : next;
				const t = saveTask(dir, before, final, {
					...flags,
					seguimiento: true,
				});
				if (final.estado !== before.estado)
					noteOverride(dir, before, override, 'pnpm board close');
				// T129: the one-line signal the agent hands back, built only from the cierre.
				const senal = signalLine(t, board);
				const enviado = sendFindings(dir, t, board);
				// T297: from the task's lane, the git-safety session ends with the close (--git-safety=commit).
				const gitSafety = finishGitSafety(
					checkout,
					before.candado?.rama ?? before.rama,
					ops,
				);
				if (gitSafety && !gitSafety.ok) process.exitCode = 1;
				const text = [
					`${t.id} con cierre (rev ${t.rev}) · ${t.estado ?? 'pendiente'}`,
					...cierreLines(t, board),
					...(enviado ? [enviado] : []),
					...(next === closed ? [] : [cycleLine(t)]),
					...(gitSafety ? [gitSafety.line] : []),
					senal,
				];
				const data = { ...t, senal, ...(gitSafety ? { gitSafety } : {}) };
				say(flags, out, data, text.join('\n'));
			});
		},
		/**
		 * T297 (U-05): the release notes of the merged tasks as `[Unreleased]` Markdown, for release preparation;
		 * `--desde=<fecha>` keeps closes since the last tag and `--faltan` lists the notes CHANGELOG.md's
		 * `[Unreleased]` does not mention yet (exit 1 while any is missing).
		 */
		changelog({ flags }, dir, out) {
			const desde = typeof flags.desde === 'string' ? flags.desde : undefined;
			if (desde && Number.isNaN(Date.parse(desde)))
				throw new UsageError('--desde debe ser una fecha, por ejemplo 2026-10-26');
			const notes = changelogNotes(loadBoard(dir), { desde });
			if (!flags.faltan) {
				const md = changelogMarkdown(notes);
				return say(flags, out, notes, md.length ? md.join('\n') : 'Sin notas de versión.');
			}
			const file = typeof flags.archivo === 'string' ? flags.archivo : 'CHANGELOG.md';
			let text;
			try {
				text = readFileSync(resolve(process.cwd(), file), 'utf8');
			} catch (e) {
				throw new UsageError(`no se pudo leer ${file}: ${e.code ?? e.message}`, {
					cause: e,
				});
			}
			const missing = missingNotes(notes, text);
			if (missing.length) process.exitCode = 1;
			const lines = missing.length
				? [
						`Faltan ${missing.length} de ${notes.length} notas en [Unreleased] de ${file}:`,
						...changelogMarkdown(missing),
					]
				: [`[Unreleased] de ${file} tiene las ${notes.length} notas del tablero.`];
			say(flags, out, missing, lines.join('\n'));
		},
	};
}
