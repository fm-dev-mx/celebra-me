/**
 * d209: who reviews Claude's work when `pnpm board review` has no --agente. Gemini and Codex share it by their
 * 7-day load (d233: open tasks count too); a tie goes to Gemini, and Codex is skipped while its quota is near the
 * cap. Work by Codex or Gemini still goes to Claude (d183), so the author never reviews itself. d282, d288: a
 * low- or medium-risk PR by Claude goes to a clean-context Claude subagent instead (`revisor: subagente`).
 * T382: an agent paused with `pnpm board agentes <a>=pausado hasta=<fecha>` is never picked.
 */
import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { agentPaused, defaultReviewer, isFinished, isReview, reviewerIssue } from './model.mjs';
import { reviewLevel, subagentReview } from './prompt.mjs';

export const LOAD_DAYS = 7;
const DAY_MS = 86_400_000;
/** d209: Codex is skipped at 80 % of its weekly window or 90 % of its 5-hour window. */
export const CODEX_CAP = { secondary: 80, primary: 90 };
/** Only the end of a rollout is read: the token_count events that carry rate_limits come often. */
const TAIL_BYTES = 1 << 20;
/** A rollout lives under the day it started; a long chat started this many days back may still be the newest. */
const DAY_DIRS = LOAD_DAYS + 1;

/**
 * Load of `agente`: its reviews open or updated in the last 7 days, plus the normal tasks it has open (d233).
 * Cancelled rounds were never done, so they do not count.
 */
export function reviewerLoad(board, agente, now) {
	const since = now - LOAD_DAYS * DAY_MS;
	const all = new Map(
		[...(board.archivo ?? []), ...(board.tareas ?? [])].map((t) => [t.id, t]),
	).values();
	let n = 0;
	for (const t of all) {
		if (t.estado === 'cancelada') continue;
		if (isReview(t)) {
			if (t.agente === agente && (!isFinished(t) || Date.parse(t.actualizado) >= since)) n++;
		} else if (
			!isFinished(t) &&
			((t.agente === agente && t.estado === 'en curso') || t.candado?.agente === agente)
		)
			n++;
	}
	return n;
}

/** A quota window that still applies at `now`: its used percent, or null when it is missing or already reset. */
function liveWindow(w, now) {
	if (!w || typeof w.used_percent !== 'number') return null;
	if (typeof w.resets_at === 'number' && w.resets_at * 1000 <= now) return null;
	return w.used_percent;
}

/** Why Codex is over its cap at `now` (`85 % semana`), or null. */
export function codexCapped(quota, now) {
	const week = liveWindow(quota?.secondary, now);
	const fiveHours = liveWindow(quota?.primary, now);
	if (week !== null && week >= CODEX_CAP.secondary) return `${week} % semana`;
	if (fiveHours !== null && fiveHours >= CODEX_CAP.primary) return `${fiveHours} % 5 h`;
	return null;
}

function quotaText(quota, now) {
	if (!quota) return 'cuota Codex sin dato';
	const part = (w, label) => {
		const v = liveWindow(w, now);
		return v === null ? `${label} sin dato` : `${v} % ${label}`;
	};
	return `cuota Codex ${part(quota.primary, '5 h')}, ${part(quota.secondary, 'semana')}`;
}

/** T382: «codex en pausa hasta 2026-11-02» while `agente` is paused (see agentPaused), else null. */
export function pauseText(agente, board, now = Date.now()) {
	if (!agentPaused(agente, board, now)) return null;
	const own = (board.agentes ?? []).find((a) => a.id === agente);
	return `${agente} en pausa hasta ${own.pausa.hasta}`;
}

/**
 * The reviewer of work by `author` and why: d288 a Claude subagent for Claude's low- or medium-risk `files`
 * outside release work (`task`), d209 between Gemini and Codex for Claude's other work, d183 otherwise. `quota`
 * is Codex's last rate_limits ({ primary, secondary }) or null; `now` is in milliseconds.
 */
export function pickReviewer(author, board, { quota = null, now = Date.now(), files, task } = {}) {
	if (author !== 'claude') {
		const claude = pauseText('claude', board, now);
		if (!claude) return { agente: defaultReviewer(author), motivo: '' };
		// T382: while Claude is paused, the other of Codex and Gemini reviews; the author never reviews itself.
		const other = ['codex', 'gemini'].find((a) => a !== author && !agentPaused(a, board, now));
		return other
			? { agente: other, motivo: claude, claudePaused: true }
			: { agente: 'claude', motivo: '', issue: `${claude} y no hay otro revisor libre` };
	}
	if (subagentReview(files, task))
		return {
			agente: 'claude',
			revisor: 'subagente',
			motivo: `riesgo ${reviewLevel(files)} (d288): subagente de claude`,
		};
	const load = {
		gemini: reviewerLoad(board, 'gemini', now),
		codex: reviewerLoad(board, 'codex', now),
	};
	const cap = codexCapped(quota, now);
	const paused = {
		gemini: pauseText('gemini', board, now),
		codex: pauseText('codex', board, now),
	};
	if (paused.gemini && paused.codex)
		return { agente: 'gemini', motivo: '', issue: `${paused.gemini}; ${paused.codex}` };
	const agente = paused.codex
		? 'gemini'
		: paused.gemini || !(cap || load.gemini <= load.codex)
			? 'codex'
			: 'gemini';
	// Past the subagent branch, a risk below «alto» can only mean release work.
	const motivo = [
		`riesgo ${reviewLevel(files)}${reviewLevel(files) === 'alto' ? '' : ', release'}`,
		`carga ${LOAD_DAYS} d: gemini ${load.gemini}, codex ${load.codex}`,
		cap ? `cuota Codex ${cap} (tope)` : quotaText(quota, now),
		...[paused.gemini, paused.codex].filter(Boolean),
	].join(' · ');
	return { agente, motivo };
}

/** Folders named by number (`2026`, `10`, `24`), newest first. */
function numberedDirs(dir) {
	try {
		return readdirSync(dir, { withFileTypes: true })
			.filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
			.map((e) => e.name)
			.sort((a, b) => Number(b) - Number(a));
	} catch {
		return [];
	}
}

/** The newest Codex rollout: the most recently written `.jsonl` of the latest day folders, or null. */
export function latestRollout(home = homedir()) {
	const root = join(home, '.codex', 'sessions');
	if (!existsSync(root)) return null;
	const days = [];
	walk: for (const y of numberedDirs(root))
		for (const m of numberedDirs(join(root, y)))
			for (const d of numberedDirs(join(root, y, m))) {
				days.push(join(root, y, m, d));
				if (days.length >= DAY_DIRS) break walk;
			}
	let best = null;
	for (const day of days) {
		let names;
		try {
			names = readdirSync(day).filter((n) => n.endsWith('.jsonl'));
		} catch {
			continue;
		}
		for (const n of names) {
			const file = join(day, n);
			const mtime = statSync(file).mtimeMs;
			if (!best || mtime > best.mtime) best = { file, mtime };
		}
	}
	return best?.file ?? null;
}

/** The rate_limits of the last event in `file` that carries them, reading only its last TAIL_BYTES. */
function lastRateLimits(file) {
	const fd = openSync(file, 'r');
	try {
		const size = statSync(file).size;
		const len = Math.min(size, TAIL_BYTES);
		const buf = Buffer.alloc(len);
		readSync(fd, buf, 0, len, size - len);
		const lines = buf.toString('utf8').split('\n');
		for (let i = lines.length - 1; i >= 0; i--) {
			if (!lines[i].includes('"rate_limits"')) continue;
			try {
				const limits = JSON.parse(lines[i])?.payload?.rate_limits;
				if (limits) return limits;
			} catch {
				// The first line of the tail may be cut in half: keep looking further up.
			}
		}
		return null;
	} finally {
		closeSync(fd);
	}
}

/**
 * Codex's last rate_limits from its newest rollout, or null without a file or a value. Only that event is
 * parsed: the conversation itself is never read into the board.
 */
export function codexQuota({ home = homedir() } = {}) {
	try {
		const file = latestRollout(home);
		const limits = file && lastRateLimits(file);
		return limits && (limits.primary || limits.secondary)
			? { primary: limits.primary ?? null, secondary: limits.secondary ?? null }
			: null;
	} catch {
		return null;
	}
}

/**
 * d282: what the author session does with a round its own subagent reviews. The subagent gets only the PR, the
 * SHA and the round's prompt, never the author's conversation; the session claims and closes the round.
 */
export function subagentSteps(round, sha) {
	const name = String(round.prompt ?? '').split('\n')[0];
	return [
		'Revisor: subagente de claude (d288, riesgo bajo o medio). Pasos de la sesión autora:',
		`1. pnpm board claim ${round.id} --agente=claude --titulo="${name}"`,
		`2. Lance un subagente Agent con contexto limpio y dele solo el PR ${round.pr}, el SHA ${sha} y el prompt de pnpm board show ${round.id}; nada de su conversación ni de su opinión del cambio.`,
		`3. Con su veredicto: pnpm board close ${round.id} --resumen=… --comprobacion=… --saltada=… --veredicto=<el del subagente> --sha=${sha} --hallazgo="P2|archivo:línea|texto" (uno por hallazgo).`,
	];
}

/** Why `review` stops before asking GitHub: no author and no --agente, or an explicit pairing never allowed. */
export function reviewerPrecheck(author, agente) {
	if (typeof agente === 'string') return reviewerIssue(author, agente, { subagent: true });
	return author ? null : 'falta --agente=<revisor>: la tarea no dice su autor';
}

/**
 * The reviewer of `author`'s PR with `files` (GitHub's complete inventory, or undefined) for origin `task`: an
 * explicit `agente` wins when allowed, otherwise pickReviewer. `issue` refuses the pairing; `revisor` is
 * `subagente` when Claude reviews Claude's low- or medium-risk work (d288).
 */
export function chooseReviewer(author, agente, board, files, task, now = Date.now()) {
	const pick =
		typeof agente === 'string'
			? { agente, motivo: '' }
			: pickReviewer(author, board, { quota: codexQuota(), now, files, task });
	const issue =
		pick.issue ??
		reviewerIssue(author, pick.agente, {
			subagent: subagentReview(files, task),
			claudePaused: agentPaused('claude', board, now),
			// The author's own subagent is not a separate agent: Claude's pause does not stop it.
			paused: pick.agente === author ? null : pauseText(pick.agente, board, now),
		});
	return { ...pick, revisor: pick.agente === author ? 'subagente' : undefined, issue };
}

/** What `review` prints for the new round `saved` (and its --sin-ci trace), with the author session's steps for a subagent round. */
export function reviewCreatedText(saved, pick, live, sha, sinCi = null) {
	const text = [
		`${saved.id} creada para ${pick.agente} (vuelta ${saved.vuelta})${pick.motivo ? ` · ${pick.motivo}` : ''}${live ? `; ${live.id} cancelada` : ''}`,
		...(sinCi ? [`Sin CI: ${sinCi.salio}; anotado en la bitácora.`] : []),
	].join('\n');
	return pick.revisor ? [text, ...subagentSteps(saved, sha)].join('\n') : text;
}
