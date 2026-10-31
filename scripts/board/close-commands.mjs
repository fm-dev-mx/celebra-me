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
	findTask,
	isExternal,
	isFinished,
	isReview,
	logRowError,
	normalizePr,
	quienOf,
	unlocked,
} from './model.mjs';
import {
	checkoutState,
	finishGitSafety,
	finishOps,
	gitSafetyOpen,
	lockLaneIssue,
} from './lane-session.mjs';
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
 * d274: an open review whose cierre carries a verdict is done, `cambios` included (the next `review` opens the next
 * round inside the same task, T529), and its lock goes. `after` is returned unchanged for any other task. The caller has already checked the cierre.
 */
export function reviewDone(before, after, flags) {
	if (!isReview(before) || isFinished(before)) return after;
	if (!VEREDICTOS.includes(after.cierre?.resultado?.veredicto)) return after;
	return { ...unlocked(after, flags), estado: 'hecha' };
}

/**
 * T529: a round closed with `cambios` sends the reviewed task from «en revision» back to «en curso», its lock kept,
 * so the author answers the findings in the same task; the author's next close returns it to «en revision».
 */
function reopenOrigin(dir, saveTask, before, t, flags) {
	if (!isReview(before) || isFinished(before) || t.estado !== 'hecha') return null;
	if (t.cierre?.resultado?.veredicto !== 'cambios' || !t.origen) return null;
	const origin = readDoc(dir, 'tareas', t.origen);
	if (origin?.estado !== 'en revision') return null;
	return saveTask(
		dir,
		origin,
		{ ...origin, estado: 'en curso' },
		{ ...flags, seguimiento: true, corrio: 'pnpm board close' },
	);
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

const label = (t) => (t.num !== undefined ? `T${t.num}` : t.id);

/**
 * T480: the task `merged` moves. A review round shares its origin's PR, so `merged` names the origin instead,
 * and with no <id> the one live non-review task carrying `--pr=#N` is the one.
 */
export function mergedRef(ref, pr, board) {
	if (typeof ref === 'string' && ref) {
		const t = findTask(ref, board);
		if (!t || !isReview(t)) return ref;
		const id = t.origen ?? String(t.id).replace(/-revision(?:-\d+)?$/, '');
		const origen = findTask(id, board);
		const name = origen ? label(origen) : id;
		throw new UsageError(
			`${label(t)} es la revisión de ${name} (se cierra con su --sha); use pnpm board merged ${name} --coordinador --quien=claude`,
		);
	}
	const given = typeof pr === 'string' ? normalizePr(pr) : undefined;
	if (!given) throw new UsageError('falta <id> o --pr=#<número>');
	const hits = (board.tareas ?? []).filter(
		(t) => !isReview(t) && (normalizePr(t.pr) ?? t.cierre?.pr) === given,
	);
	if (hits.length === 1) return hits[0].id;
	if (!hits.length)
		throw new UsageError(`ninguna tarea del tablero tiene ${given}: indique <id>`);
	throw new UsageError(`${given} está en ${hits.map(label).join(', ')}: indique <id>`);
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
			const info = withLock(dir, () => {
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
				reopenOrigin(dir, saveTask, before, t, flags);
				if (final.estado !== before.estado)
					noteOverride(dir, before, override, 'pnpm board close');
				// T129: the one-line signal the agent hands back, built only from the cierre.
				const senal = signalLine(t, board);
				const enviado = sendFindings(dir, t, board);
				return {
					t,
					board,
					before,
					enviado,
					next,
					closed,
					senal,
					// T480: a task nobody claimed has no lane session; the coordinator's close skips git-safety.
					sinCandado: Boolean(flags.coordinador) && !before.candado,
					rama: before.candado?.rama ?? before.rama,
				};
			});
			// T297: from the task's lane, the git-safety session ends with the close (--git-safety=commit).
			// A session still open for the branch (a released task) is finished as before.
			const gitSafety =
				isExternal(info.before) || isExternal(info.t)
					? null
					: info.sinCandado && !gitSafetyOpen(checkout, info.rama)
						? ops && {
								ok: true,
								line: `git-safety: ${info.t.id} no tenía candado; se cerró sin sesión de carril`,
							}
						: finishGitSafety(checkout, info.rama, ops);
			if (gitSafety && !gitSafety.ok) process.exitCode = 1;
			const text = [
				`${info.t.id} con cierre (rev ${info.t.rev}) · ${info.t.estado ?? 'pendiente'}`,
				...cierreLines(info.t, info.board),
				...(info.enviado ? [info.enviado] : []),
				...(info.next === info.closed ? [] : [cycleLine(info.t)]),
				...(gitSafety ? [gitSafety.line] : []),
				info.senal,
			];
			const data = { ...info.t, senal: info.senal, ...(gitSafety ? { gitSafety } : {}) };
			say(flags, out, data, text.join('\n'));
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
