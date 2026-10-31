#!/usr/bin/env node
/**
 * `pnpm board` — the only way agents read and write the board (rules: .agent/rules/board.md, d143/d144).
 *
 *   list [--agente=<a>|--tab=libres] [--json]   numbered queue with its color
 *   next --agente=<a> [--json]                  first ready, unlocked task that agent finishes alone
 *   show <id|T<n>> [--json]                    set and claim also accept the fixed task number
 *   add <id> titulo=… urgencia=… actor=… [campo=valor…]
 *                                               T130: a session task needs tipo=codigo|revision|release|invitacion|
 *                                               creativo|auditoria|operacion and busca=… (its QUÉ SE BUSCA);
 *                                               add, set and plan then generate its prompt from .agent/kinds/
 *   prompt <id> [--guardar --rev=<n>] [--json]  T130: the prompt generated from the task's tipo and how the
 *                                               saved one differs; --guardar saves it (lock owner or --coordinador)
 *   set <id> --rev=<n> campo=valor… [--data=<file.json>] [--quien=<a>] [--corrio=…] [--salio=…]
 *   claim <id> --agente=<a> [--titulo="f05 · T<n> · …"] [--sesion=<id>] [--carril=<id>] [--rama=<b>]
 *                                               lock: one owner at a time; --titulo (the session name) is
 *                                               required for tasks created under the contract (T126)
 *                                               (rama defaults to the task's declared branch; Claude's sesion
 *                                               defaults to CLAUDE_CODE_HOST_SESSION_ID and must start with local_;
 *                                               carril defaults to the planned lane, another needs --coordinador;
 *                                               T172: a pendiente task becomes en curso; T297: run from a
 *                                               lane, the lane and branch must be the task's and it opens
 *                                               the git-safety session --session=<rama>; T543: a lane task
 *                                               is refused from Integration or an unknown folder)
 *   entregada <id> --agente=<a> [--quien=<a>]  d249: its prompt was pasted into <a>'s chat; it leaves «Le toca
 *                                               a usted» until 15 min pass without a claim (claim clears it)
 *   plan <id> --carril=<id> --coordinador --quien=<q> --rev=<n> d177: the lane a ready task runs in; --carril= clears it;
 *                                               T382: refused on a busy lane (other branch, uncommitted)
 *   release <id> --agente=<a> [--nombre=<s>] [--coordinador]   copies the lock's session into `sesion`;
 *                                               --coordinador frees a legacy lock without sesion, or
 *                                               (d274) one silent for 2 h whose task has a valid cierre;
 *                                               a task still en curso goes back to pendiente (T172), a
 *                                               review with its verdict becomes hecha; T297: from the lane,
 *                                               --git-safety=commit[,history] also finishes git-safety
 *   merged [<id>] --coordinador --quien=<q> [--rev=<n>] [--pr=#N]   d170: its PR is MERGED on GitHub → unida and the
 *                                               lock goes, whoever holds it (pnpm board:sync uses it)
 *   move <id> --agente=<b> [--quien=<a>]        hand over (only without a lock), with a bitácora row
 *   review <id> [--agente=<b>] [--sha=<sha>]    cross review: round <id>-revision, then <id>-revision-2, … per
 *                                               new SHA, kept inside <id> (T529), never a task of its own;
 *                                               T543: rounds still in files of their own move in first;
 *                                               without --agente the reviewer follows d183; d282: a
 *                                               low-risk PR by Claude goes to a Claude subagent
 *   close <id> --resumen=… [--resumen=…] [--comprobacion=…] [--saltada=…] [--pendiente="texto→T58"]
 *         [--fallida=…] [--riesgo=…] [--duda=…] [--excepcion=…]
 *         [--veredicto=aprobado|cambios|bloqueado] [--hallazgo="P2|archivo|texto"] [--sha=<sha>]
 *         [--nivel=validate:changed|type-check|ci] [--pr=#N] [--commit=<sha>] [--rev=<n>]
 *         [--changelog="Added: …"|--changelog=ninguno] [--git-safety=commit[,history]]
 *                                               d178: closing summary (lock owner, or --coordinador to
 *                                               complete it); repeat a flag for each line or item, «ninguna»
 *                                               for an empty list; a pendiente without its task is refused.
 *                                               T129: a task created under contrato 2 also names every
 *                                               Handoff list and its resultado (review: veredicto, sha,
 *                                               hallazgos; code: pr, sha, nivel); prints a one-line signal
 *                                               T297: --changelog is the release note (Keep a Changelog
 *                                               group); --git-safety finishes the lane's session
 *   changelog [--desde=<fecha>] [--faltan [--archivo=CHANGELOG.md]]
 *                                               T297: merged tasks' release notes as [Unreleased] Markdown;
 *                                               --faltan lists the ones CHANGELOG.md lacks (exit 1)
 *   set <id> estado=cancelada --motivo=…        T129: a cancellation writes its cierre, the reason as summary
 *   archive <id> [--rev=<n>] / unarchive <id>   hide a finished, unlocked task with its closing summary from
 *                                               «Finalizadas» (bitácora row)
 *   decide decision=… motivo=… tareas=a,b|--sin-tarea [--mensaje=<id>] [reemplaza=dNNN] [quien=…]
 *                                               T172: «(reemplaza dNNN)» in the text links it without the field
 *   carril [--json]                             canonical lane catalog with live Git/task state (read-only)
 *   estado --rev=<n> campo=valor…               Production strip (estado/actual)
 *   history [--q=<texto>] [--todas] [--json]   replaced decisions only with --todas
 *   compact --antes=7d [--dry-run]              d187: tasks archived 7+ days ago → one line in mensual/resumen-<mes>.md,
 *                                               the whole file in mensual/<mes>.zip, a small archivo record
 *   restore <id> [--dry-run]                    a compacted task back from its .zip
 *   prune-backups [--dry-run|--aplicar]        d185: lists the surplus backup copies; only --aplicar removes them
 *   migrate-log [--dry-run]                     old one-file-per-row bitácora → bitacora/<day>.jsonl, every row kept
 *   migrate-rounds <id> [--aplicar]             T543: lists <id>'s review rounds still in files of their own;
 *                                               --aplicar moves them into its rondas (backups kept)
 *   verify [--json] [--archivadas]              same as pnpm board:verify
 *   msg <id> --de=<a> --para=<b> "texto" [--opcion="…" …] [--detalle="…"]
 *                                               T126: a message about a task, kept in the bitácora; T322: --opcion
 *                                               (recommended first) only --para=dueno; --detalle holds the technical part
 *   inbox --agente=<a> [--todos]                messages to <a> not read yet; marks them read
 *   atendido <id> --para=dueno|coordinador [--mensaje=<id>] [--nota=…]
 *                                               d291: those messages about <id> were answered; they leave
 *                                               «Le toca a usted»/«Le toca al coordinador» (bitácora row)
 *   solape <id> [--sha=<head>] [--json]         d270/d291: may <id>'s board PR open now? git merge-tree against
 *                                               each open board PR; exit 1 while it waits
 *   sigue [--json]                              T126: «Le toca a usted», «Le toca al coordinador» and «Detenidas»,
 *                                               with GitHub's open PRs (list prints them without GitHub)
 *   carriles [--json]                           T126: each lane's branch, clean or not, and its locked task, from git
 *   resumen [--agente=<a>] [--json]             T383: table per agent: task, status, PR, SHA, latest novelty and wait
 *   sesiones [--json]                           d211: open Codex and Gemini chats crossed with the board, read-only;
 *                                               says which ones the owner can archive by hand
 *   view [--port=4320]                          local page at http://127.0.0.1:<port>/, live; its only write is
 *                                               archive/unarchive, same-origin from 127.0.0.1; it takes new
 *                                               code by itself without closing the port (view-supervisor.mjs)
 *
 * Aliases: get = show, update = set, decision = decide, log = history. Every command takes --json.
 * Every command renews the heartbeat (`candado.latido`) of the locks its --agente and session hold (T126).
 * Values are JSON when they look like JSON (numbers, true/false/null, [..], {..}); `campo=` removes the field.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	authorOf,
	blockedText,
	buildLogRow,
	buildMessageRow,
	canFinish,
	cleaned,
	CLEANED_ON,
	color,
	CONTRATO,
	findTask,
	historyRows,
	inTab,
	isExternal,
	isFinished,
	isReview,
	isSilentLock,
	laneLines,
	logRowError,
	normalizePr,
	prIssues,
	promptWithLane,
	queue,
	requisitoLine,
	requisitos,
	reviewRounds,
	roundLines,
	SILENT_LOCK_HOURS,
	stage,
	taskIssues,
	taskLabel,
	unlocked,
} from './model.mjs';
import { assertLaneReady, assertPlan, readLaneGit } from './lane-plan.mjs';
import { blocked, listTail, originLines, refIssue, subtaskLines } from './subtasks.mjs';
import { ciGate, reviewPreflight, sinCiTrace, untilGreen, viewPr } from './review-preflight.mjs';
import { assertOwner, noteOverride, overrideReason } from './lock-owner.mjs';
import { authorSession } from './findings.mjs';
import { leftByUnanswered, reviewChild, reviewChildId } from './rounds.mjs';
import { overlapCommands } from './overlap.mjs';
import { archiveBlock, cierreBlock, cierreIssues } from './cierre.mjs';
import {
	cancelOnSet,
	cancelReplaced,
	closeCommands,
	mergedRef,
	reviewDone,
} from './close-commands.mjs';
import { deliveryLine, mergeSignalsFor, nextSections, sectionLines, unreadFor } from './next.mjs';
import { beatCaller, nextCommands } from './next-commands.mjs';
import { deliveryCommands } from './delivery-commands.mjs';
import {
	appendLog,
	assertId,
	embedLegacyRounds,
	migrateLegacyLog,
	migrateLogLines,
	boardDir,
	loadBoard,
	monthlyZip,
	readCollection,
	readDoc,
	withLock,
	writeDoc,
} from './store.mjs';
import { UsageError, failureText, say } from './cli.mjs';
import { archiveSessions, externalSessionLines, externalSessions } from './external-sessions.mjs';
import { masterConfigPath, readLocal } from './master-config.mjs';
import { generatedPrompt, kindCommands, withKindPrompt } from './kind-commands.mjs';
import { inventoryCommands } from './inventory-commands.mjs';
import { maintenanceCommands } from './maintenance.mjs';
import { ghPrState, reviewSha } from './github.mjs';
import { resumenCommands } from './resumen.mjs';
import { chooseReviewer, reviewCreatedText, reviewerPrecheck } from './reviewer.mjs';
import { reviewCierreIssue } from './require-cierre.mjs';
import { withTrace } from './trace.mjs';
import { assertCoordinator } from './coordinator-authority.mjs';
import { traceText } from './format.mjs';
import { addToZip } from './zip.mjs';
import { checkoutState, finishGitSafety, finishOps, lockLaneIssue } from './lane-session.mjs';
import { claimCommands, sayClaim } from './claim-commands.mjs';

const COLOR_LABEL = {
	own: 'USTED',
	auto: 'AUTÓNOMA',
	block: 'BLOQUEADA',
	run: 'EN CURSO',
	rev: 'EN REVISIÓN',
	done: 'HECHA',
};
const LOOKS_JSON = /^(\[|\{|true$|false$|null$|-?\d+(\.\d+)?$)/;

export function parseArgs(argv) {
	const flags = {};
	const lists = {};
	const pairs = {};
	const pos = [];
	for (const a of argv) {
		if (a.startsWith('--')) {
			const [k, ...v] = a.slice(2).split('=');
			flags[k] = v.length ? v.join('=') : true;
			// A repeated flag keeps its last value in `flags` and every value in `lists`.
			(lists[k] ??= []).push(flags[k]);
		} else if (/^[A-Za-z_][\w]*=/.test(a)) {
			const i = a.indexOf('=');
			pairs[a.slice(0, i)] = a.slice(i + 1);
		} else pos.push(a);
	}
	return { flags, lists, pairs, pos };
}

export function parseValue(v) {
	if (v === '') return undefined;
	if (LOOKS_JSON.test(v)) {
		try {
			return JSON.parse(v);
		} catch {
			throw new UsageError(`valor JSON no válido: ${v}`);
		}
	}
	return v;
}

function applyPairs(doc, pairs) {
	const out = { ...doc };
	for (const [k, v] of Object.entries(pairs)) {
		if (['id', 'num', 'rev', 'actualizado'].includes(k))
			throw new UsageError(`${k} lo pone el comando`);
		const value = parseValue(v);
		if (value === undefined) delete out[k];
		else out[k] = value;
	}
	return out;
}

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const need = (v, msg) => {
	if (!v || v === true) throw new UsageError(msg);
	return v;
};

/** A bitácora row checked before anything is written (see buildLogRow). */
function logEntry(tarea, change, who, extra) {
	const row = buildLogRow(tarea, change, who, extra, nowIso());
	const why = logRowError(row);
	if (why) throw new UsageError(why);
	return row;
}

/** The number the next new task gets: one past the highest in either collection. */
const nextNum = (dir) =>
	[...readCollection(dir, 'tareas'), ...readCollection(dir, 'archivo')].reduce(
		(max, task) => (Number.isSafeInteger(task.num) ? Math.max(max, task.num) : max),
		0,
	) + 1;

/** Snapshot the coordinator context before validation and persistence. */
function prepareQuestionRevision(dir, before, t, opts) {
	if (!before || !opts.coordinador) return [];
	const questions = unreadFor('dueno', { ...loadBoard(dir), bandejas: [] }).filter(
		(r) => r.tarea === t.id,
	);
	t.preguntasRev = t.rev;
	if (questions.length) t.prompt = generatedPrompt(t, loadBoard(dir), { rev: t.rev }) ?? t.prompt;
	return questions;
}

/** Keep the expired question in history and send the replacement prompt to its agent. */
function notifyExpiredQuestions(dir, before, t, questions) {
	if (questions.length) {
		appendLog(dir, {
			tarea: t.id,
			en: t.actualizado,
			quien: 'coordinador',
			atendido: {
				para: 'dueno',
				mensajes: questions.map((r) => r.mensaje.id),
				nota: `vencida: contexto actualizado a rev ${t.rev}`,
			},
		});
		const agente = before.candado?.agente ?? before.agente;
		if (['codex', 'claude', 'gemini'].includes(agente))
			appendLog(
				dir,
				buildMessageRow(
					t.id,
					{
						de: 'coordinador',
						para: agente,
						texto: `Pregunta vencida. Use el prompt actualizado:\n${promptWithLane(t, loadBoard(dir))}`,
						id: `prompt-${t.id}-${t.rev}`,
					},
					t.actualizado,
				),
			);
	}
}

/** Save a task when it gains no shape problem; bump rev and log an estado change. */
function saveTask(dir, before, after, opts = {}) {
	const { corrio, salio } = opts;
	// T172: agregadaPor on creation, seguimientoPor when opts.seguimiento marks a follow-up write.
	const traced = withTrace(before, cleaned(after, opts), opts);
	const t = { ...traced, rev: (before?.rev ?? 0) + 1, actualizado: nowIso() };
	const questions = prepareQuestionRevision(dir, before, t, opts);
	// Archive never deletes tasks; both collections reserve their numbers permanently. A task saved before
	// numbering existed gets the next number on its first write, like a new one. A review round lives inside its
	// task (T529) and takes no number of its own.
	if (t.ronda) delete t.num;
	else t.num = Number.isSafeInteger(before?.num) ? before.num : nextNum(dir);
	if (!t.ronda && t.num !== before?.num && !Number.isSafeInteger(t.num))
		throw new UsageError('se agotaron los números de tarea');
	const pr = normalizePr(t.pr);
	if (pr === undefined) delete t.pr;
	else t.pr = pr;
	withParent(dir, before, t);
	const old = before ? new Set(taskIssues(before)) : new Set();
	// A legacy record keeps unrelated problems, but a write that touches the PR rule must satisfy it.
	const touchesPr = ['pr', 'estado', 'rama'].some((k) => before?.[k] !== t[k]);
	const strict = new Set(touchesPr ? prIssues(t) : []);
	const added = taskIssues(t).filter((m) => strict.has(m) || !old.has(m));
	if (added.length) throw new UsageError(`no se escribió ${t.id}: ${added.join('; ')}`);
	const row =
		(before?.estado ?? null) !== t.estado &&
		logEntry(t.id, { de: before?.estado, a: t.estado }, opts, { corrio, salio });
	archiveLostPrompt(dir, before, after, t);
	writeDoc(dir, 'tareas', t.id, t, { backup: !isFinished(before) });
	if (row) appendLog(dir, row);
	notifyExpiredQuestions(dir, before, t, questions);
	return t;
}

/**
 * d174: `padre=T12` becomes the mother's id; a mother off the board or a loop of mothers is refused. T481: `deriva=T12`
 * becomes the source's id the same way, and a source off the board is refused.
 */
function withParent(dir, before, t) {
	const refs = ['padre', 'deriva'].filter((k) => t[k] !== undefined && t[k] !== before?.[k]);
	if (!refs.length) return;
	const board = {
		tareas: readCollection(dir, 'tareas'),
		archivo: readCollection(dir, 'archivo'),
	};
	for (const k of refs) {
		const found = findTask(t[k], board);
		if (found) t[k] = found.id;
	}
	const issue = refIssue(t, board, refs);
	if (issue) throw new UsageError(`no se escribió ${t.id}: ${issue}`);
}

/**
 * The prompt reaches the month's .zip before a closed task loses it, also when the write itself clears it: a
 * finished task gets no backup that would keep it.
 */
function archiveLostPrompt(dir, before, after, t) {
	const lost = !t.prompt && (after.prompt ?? before?.prompt);
	if (lost && (CLEANED_ON.has(t.estado) || isFinished(before)))
		addToZip(monthlyZip(dir, t.actualizado.slice(0, 7)), [
			{ name: `prompts/${t.id}.rev${t.rev}.md`, data: lost },
		]);
}

function getTask(dir, id) {
	const number = /^T([1-9]\d*)$/i.exec(id);
	let t;
	if (number) {
		const matches = readCollection(dir, 'tareas').filter(
			(task) => task.num === Number(number[1]),
		);
		if (matches.length > 1) throw new UsageError(`número de tarea repetido: ${id}`);
		[t] = matches;
	} else t = readDoc(dir, 'tareas', assertId(id));
	if (!t) throw new UsageError(`no existe la tarea ${id}`);
	return t;
}

function checkRev(doc, flags) {
	const want = Number(need(flags.rev, 'falta --rev=<n> (la versión que leyó)'));
	const have = doc?.rev ?? 0;
	if (have !== want)
		throw new UsageError(
			`${doc?.id ?? 'documento'} cambió: está en rev ${have}, usted leyó ${want}. Vuelva a leerla.`,
		);
}

/** d274: the coordinator frees a silent session's lock only after that session wrote a valid cierre. */
function assertClosed(task, board) {
	const issues = cierreIssues(task, board);
	if (issues.length)
		throw new UsageError(
			`${task.id} no tiene un cierre válido (${issues.join('; ')}): el candado sin latido desde hace ${SILENT_LOCK_HOURS} h solo se suelta después de «close»`,
		);
}

/**
 * Archive (`archivar: true`) or unarchive one finished, unlocked task, with a bitácora row (d167). The
 * `archive`/`unarchive` commands and the view's POST share it; the task file is never deleted.
 */
export function setArchived(dir, id, archivar, { rev, quien, coordinador, corrio } = {}) {
	return withLock(dir, () => {
		const before = getTask(dir, need(id, 'falta <id>'));
		if (rev !== undefined) checkRev(before, { rev });
		if (!isFinished(before))
			throw new UsageError(`${before.id} sigue abierta: solo se archivan tareas finalizadas`);
		if (before.candado)
			throw new UsageError(
				`${before.id} tiene candado de ${before.candado.agente}: no se archiva`,
			);
		if (archivar === Boolean(before.archivada)) return before;
		// d178: archiving needs the closing summary; tasks archived before it stay as they are.
		const why = archivar && archiveBlock(before, loadBoard(dir));
		if (why) throw new UsageError(`${before.id}: ${why}`);
		const after = { ...before };
		if (archivar) after.archivada = nowIso();
		else delete after.archivada;
		const change = archivar
			? { de: before.estado, a: 'archivada' }
			: { de: 'archivada', a: before.estado };
		const row = logEntry(before.id, change, { quien, coordinador }, { corrio });
		const t = saveTask(dir, before, after);
		appendLog(dir, row);
		return t;
	});
}

/** The view server's `archive` option: a refused write comes back as `{ error }` for a 409. */
export function viewArchiver(dir) {
	return (id, archivar, opts) => {
		try {
			return { task: setArchived(dir, id, archivar, opts) };
		} catch (e) {
			if (e instanceof UsageError) return { error: e.message };
			throw e;
		}
	};
}

function archiveCommand(archivar) {
	return ({ pos, flags }, dir, out) => {
		const t = setArchived(dir, pos[0], archivar, {
			rev: flags.rev,
			quien: flags.quien,
			coordinador: flags.coordinador,
			corrio: archivar ? 'pnpm board archive' : 'pnpm board unarchive',
		});
		say(flags, out, t, `${t.id} ${t.archivada ? 'archivada' : 'sin archivar'} (rev ${t.rev})`);
	};
}

function row(t, n, board, agente) {
	const c = color(t, board, { agente });
	const lock = t.candado ? ` [${t.candado.agente}]` : '';
	const why = blockedText(t, board) || deliveryLine(t);
	return `${String(n).padStart(2)}. ${COLOR_LABEL[c].padEnd(11)} ${String(t.urgencia ?? '').padEnd(8)} ${t.num ? `T${t.num} ` : ''}${t.titulo} · ${t.id}${lock}${why ? `  — ${why}` : ''}`;
}

/**
 * T79: one try of `review`: every round `<id>-revision`, `-revision-2`, … has its own prompt and lives inside the
 * reviewed task (T529), with no number of its own; d183 picks the reviewer. d288: `{espera}` (nothing written) while the head's CI is not green yet, unless --sin-ci.
 */
function reviewOnce({ pos, flags }, dir, out) {
	return withLock(dir, () => {
		const src = getTask(dir, need(pos[0], 'falta <id>'));
		if (!src.pr || src.estado !== 'en revision')
			throw new UsageError('el origen requiere PR y estado en revision');
		const noCierre = reviewCierreIssue(src, loadBoard(dir));
		if (noCierre) throw new UsageError(noCierre);
		const author = authorOf(src);
		const early = reviewerPrecheck(author, flags.agente);
		if (early) throw new UsageError(early);
		const sha = reviewSha(src, flags);
		const sinCi = sinCiTrace(flags, src, sha);
		const prev = reviewRounds(src.id, loadBoard(dir)).at(-1);
		if (prev?.revisionSha === sha) return say(flags, out, prev, `${prev.id} ya revisa ${sha}`);
		const pr = viewPr(src, sha);
		const waiting = ciGate(src, sha, pr, { sinCi: Boolean(sinCi) });
		if (waiting) return waiting;
		const preflight = reviewPreflight(src, sha, pr);
		if (preflight.conflicts !== null) {
			const en = nowIso();
			const texto = `${taskLabel(src)} (${src.pr}@${sha.slice(0, 7)}): revisión rechazada por conflictos de merge. Archivos: ${preflight.conflicts.length ? preflight.conflicts.join(', ') : 'UNVERIFIED (objetos locales no disponibles; compruebe los archivos en GitHub)'}. Una origin/develop a su rama con un merge normal, resuelva los conflictos y haga push normal; nunca rebase ni push --force.`;
			const row = buildMessageRow(
				src.id,
				{ de: 'coordinador', para: author, texto, id: `merge-${src.id}-${sha}-${en}` },
				en,
			);
			const sesion = authorSession(src, author);
			if (sesion) row.mensaje.sesion = sesion.id;
			appendLog(dir, row);
			throw new UsageError(texto);
		}
		// d282: the reviewer follows the PR's risk, so it is picked from GitHub's file inventory.
		const pick = chooseReviewer(author, flags.agente, loadBoard(dir), preflight.files, src);
		if (pick.issue) throw new UsageError(pick.issue);
		const { agente, revisor } = pick;
		// T543: rounds that still have a file of their own move into the task, so no round is left outside it.
		embedLegacyRounds(dir, 'tareas', src.id);
		const id = reviewChildId(src, prev);
		const before = readDoc(dir, 'tareas', id);
		// T529: the round lives inside the reviewed task, so its prompt-v1 session name (T160) carries that number.
		const t = reviewChild(src, {
			agente,
			revisor,
			sha,
			prev,
			num: src.num,
			files: preflight.files,
			// d291: rounds since the last verdict answered nothing, so this one reviews the whole PR.
			previas: leftByUnanswered(src.id, loadBoard(dir)) ?? undefined,
			generado: nowIso(),
		});
		// --agente names the reviewer here; the writer is --quien, the coordinator or the author.
		const who = { quien: flags.quien, coordinador: flags.coordinador, agente: author };
		const saved = saveTask(dir, before, t, { ...who, ...sinCi });
		const live = cancelReplaced(dir, saveTask, { prev, saved, sha, who });
		say(flags, out, saved, reviewCreatedText(saved, pick, live, sha, sinCi));
	});
}

const commands = {
	list({ flags }, dir, out) {
		const board = loadBoard(dir);
		const tab = flags.agente ?? flags.tab;
		const q = queue(board).filter((t) => inTab(t, tab));
		const review = board.tareas
			.filter((t) => stage(t, board) === 'revision' && !t.archivada && inTab(t, tab))
			.sort((a, b) => Date.parse(b.actualizado) - Date.parse(a.actualizado));
		// T258: blocked tasks are not numbered; --json still lists them, after the queue.
		const stuck = blocked(board).flatMap(({ t }) => (inTab(t, tab) ? [t] : []));
		if (flags.json)
			return out(
				JSON.stringify(
					[...q, ...stuck, ...review].map((t, i) => ({
						n: i < q.length ? i + 1 : null,
						num: t.num,
						id: t.id,
						titulo: t.titulo,
						color: color(t, board, { agente: flags.agente }),
						stage: stage(t, board),
					})),
					null,
					2,
				),
			);
		if (!q.length) out('Sin tareas en la cola.');
		q.forEach((t, i) => out(row(t, i + 1, board, flags.agente)));
		// T489: the count is «Le toca a usted»; prompts to paste are the coordinator's.
		const sections = nextSections(board);
		const mine = sections.usted.length;
		out(`\nUsted: ${mine ? `${mine} ${mine > 1 ? 'cosas' : 'cosa'}` : 'nada'}`);
		for (const line of sectionLines(sections)) out(line);
		if (review.length) {
			out(`\nEn revisión (${review.length}):`);
			for (const t of review) out(row(t, '·', board, flags.agente));
		}
		// d276/T258: tasks waiting for a date or blocked left the queue; their lines close the list.
		const tail = listTail(board);
		if (tail) out(tail);
	},
	show({ pos, flags }, dir, out) {
		const t = getTask(dir, need(pos[0], 'falta <id>'));
		const board = loadBoard(dir);
		if (flags.json)
			return out(
				JSON.stringify(
					{
						...t,
						color: color(t, board),
						stage: stage(t, board),
						requisitos: requisitos(t, board),
					},
					null,
					2,
				),
			);
		out(
			`${t.id} · rev ${t.rev} · ${COLOR_LABEL[color(t, board)]} · ${t.estado ?? 'pendiente'}\n${t.num ? `T${t.num} ` : ''}${t.titulo}`,
		);
		for (const line of originLines(t, board)) out(`  ${line}`);
		const trace = traceText(t, board);
		if (trace) out(`  ${trace.text}`);
		const delivered = deliveryLine(t);
		if (delivered) out(`  ${delivered}`);
		for (const line of laneLines(t, board)) out(`  ${line}`);
		for (const r of requisitos(t, board)) out(`  ${requisitoLine(r, board)}`);
		for (const k of [
			'urgencia',
			'actor',
			'agente',
			'toca',
			'requiere',
			'candado',
			'carrilPlaneado',
			'carril',
			'rama',
			'pr',
			'sesion',
			'ahora',
		])
			if (t[k] !== undefined)
				out(`  ${k}: ${typeof t[k] === 'string' ? t[k] : JSON.stringify(t[k])}`);
		for (const line of [
			...subtaskLines(t, board),
			...roundLines(t, board),
			...cierreBlock(t, board),
		])
			out(line);
		if (t.prompt) out(`\n${t.prompt}`);
	},
	add({ pos, pairs, flags }, dir, out) {
		const id = assertId(need(pos[0], 'falta <id>'));
		return withLock(dir, () => {
			if (readDoc(dir, 'tareas', id)) throw new UsageError(`ya existe la tarea ${id}`);
			// A compacted task keeps its id: it comes back with restore, never as a new task.
			if (readDoc(dir, 'archivo', id))
				throw new UsageError(`${id} está compactada: use pnpm board restore ${id}`);
			const draft = {
				...applyPairs({ id, estado: 'pendiente', requisitos: [] }, pairs),
				contrato: CONTRATO,
			};
			if (draft.carrilPlaneado !== undefined) assertPlan(draft, draft.carrilPlaneado, flags);
			// T130: a typed task gets its prompt from its kind (once it has a lane).
			const t = withKindPrompt(null, draft, dir, { num: nextNum(dir), pairs });
			const saved = saveTask(dir, null, t, {
				quien: flags.quien,
				agente: flags.agente,
				coordinador: flags.coordinador,
			});
			say(flags, out, saved, `${saved.id} creada (rev 1)`);
		});
	},
	set({ pos, pairs, flags }, dir, out) {
		const id = need(pos[0], 'falta <id>');
		return withLock(dir, () => {
			const before = getTask(dir, id);
			checkRev(before, flags);
			const override = assertOwner(before, flags);
			const data = flags.data ? JSON.parse(readFileSync(resolve(flags.data), 'utf8')) : {};
			for (const key of [
				'candado',
				'agente',
				'carril',
				'carrilPlaneado',
				'origen',
				'revisionSha',
				'revisionFiles',
				'revisor',
				'archivada',
				'cierre',
				'num',
				'contrato',
				'agregadaPor',
				'seguimientoPor',
				'entregada',
				'preguntasRev',
				'prsPrevios',
			])
				if (Object.hasOwn(pairs, key) || Object.hasOwn(data, key))
					throw new UsageError(`${key} requiere su comando de coordinación, no set`);
			// T129: a cancellation writes its cierre in the same command.
			// T130: a typed task regenerates its prompt when what it is built from changes.
			const edited = cancelOnSet(
				before,
				applyPairs({ ...before, ...data, id: before.id }, pairs),
				flags,
			);
			const merged = withKindPrompt(before, edited, dir, { pairs: { ...data, ...pairs } });
			if (before.candado?.rama && merged.rama !== before.candado.rama)
				throw new UsageError('rama distinta del candado');
			if (
				isReview(before) &&
				['hecha', 'comprobada'].includes(merged.estado) &&
				flags.sha !== before.revisionSha
			)
				throw new UsageError('la revisión debe declarar --sha igual al SHA revisado');
			// d290: the coordinator moving an inactive session's task to pendiente or an end state frees its lock.
			const freed =
				override && (isFinished(merged) || merged.estado === 'pendiente')
					? unlocked(merged, flags)
					: merged;
			const t = saveTask(dir, before, freed, { ...flags, seguimiento: true });
			noteOverride(dir, before, override, 'pnpm board set');
			say(flags, out, t, `${t.id} rev ${t.rev}${override ? ` · ${override}; anotado` : ''}`);
		});
	},
	/** d177: the coordinator plans the lane a task runs in; claim then takes it without --carril. */
	async plan({ pos, flags }, dir, out) {
		if (typeof flags.carril !== 'string') throw new UsageError('falta --carril=<carril>');
		// T382: the lanes' Git state is read before the lock; the check itself runs inside it.
		const git = flags.carril ? await readLaneGit(dir) : [];
		return withLock(dir, () => {
			const before = getTask(dir, need(pos[0], 'falta <id>'));
			checkRev(before, flags);
			const carril = flags.carril || undefined;
			if (carril) assertPlan(before, carril, flags);
			else if (!flags.coordinador)
				throw new UsageError(
					'el carril planeado lo quita el coordinador: use --coordinador',
				);
			if (carril) assertLaneReady(carril, before, git, loadBoard(dir));
			if (isReview(before)) throw new UsageError('una revisión no tiene carril planeado');
			if (before.candado)
				throw new UsageError(
					`${before.id} tiene candado de ${before.candado.agente}: el carril ya está en uso`,
				);
			if (carril === before.carrilPlaneado)
				return say(
					flags,
					out,
					before,
					`${before.id} ya corre en ${carril ?? 'ningún carril'}`,
				);
			const planned = { ...before };
			if (carril) planned.carrilPlaneado = carril;
			else delete planned.carrilPlaneado;
			const after = withKindPrompt(before, planned, dir);
			const row = logEntry(
				before.id,
				{ carril: { de: before.carrilPlaneado ?? '', a: carril ?? '' } },
				{ quien: flags.quien, coordinador: flags.coordinador },
				{ corrio: 'pnpm board plan' },
			);
			const t = saveTask(dir, before, after, {
				quien: flags.quien,
				coordinador: flags.coordinador,
				seguimiento: true,
			});
			appendLog(dir, row);
			say(
				flags,
				out,
				t,
				[`${t.id} rev ${t.rev}`, ...laneLines(t, loadBoard(dir))].join('\n'),
			);
		});
	},
	/**
	 * d170: once a task's PR is merged the board moves it to unida and drops its lock without waiting for the
	 * session. The PR state is read from GitHub (`prState` lets board:sync pass the state it just listed).
	 * T521: review rounds' merge signals are acknowledged too; an archived task only gets that atendido row.
	 */
	merged({ pos, flags }, dir, out, { prState = ghPrState } = {}) {
		if (!flags.coordinador) throw new UsageError('merged requiere --coordinador (d170)');
		return withLock(dir, () => {
			const board = loadBoard(dir);
			const ref = mergedRef(pos[0], flags.pr, board);
			const archived = findTask(ref, board) && !findTask(ref, { tareas: board.tareas });
			const before = archived ? findTask(ref, board) : getTask(dir, ref);
			if (flags.rev !== undefined) checkRev(before, flags);
			const given = typeof flags.pr === 'string' ? normalizePr(flags.pr) : undefined;
			const pr = normalizePr(before.pr) ?? given;
			if (!pr) throw new UsageError(`${before.id} no tiene pr: indique --pr=#<número>`);
			if (given && given !== pr) throw new UsageError(`${before.id} ya tiene ${pr}`);
			const state = prState(pr);
			if (state !== 'MERGED')
				throw new UsageError(`${pr} no está unido en GitHub (${state || 'sin respuesta'})`);
			const signals = mergeSignalsFor(before.id, board);
			if (signals.length)
				appendLog(dir, {
					tarea: before.id,
					en: nowIso(),
					quien: 'coordinador',
					atendido: {
						para: 'coordinador',
						mensajes: signals.map((r) => r.mensaje.id),
						nota: 'merged',
					},
				});
			const s = signals.length === 1 ? '' : 's';
			const acks = `${signals.length} aviso${s} atendido${s}`;
			if (archived) return say(flags, out, before, `${before.id} está archivada; ${acks}`);
			const after = { ...unlocked(before, flags), pr };
			if (!['unida', 'comprobada'].includes(after.estado)) after.estado = 'unida';
			if (!before.candado && after.estado === before.estado)
				return say(flags, out, before, `${before.id} ya está ${before.estado}`);
			const t = saveTask(dir, before, after, {
				quien: flags.quien,
				coordinador: true,
				corrio: typeof flags.corrio === 'string' ? flags.corrio : 'pnpm board merged',
				salio: `PR ${pr} MERGED`,
				seguimiento: true,
			});
			const freed = before.candado ? `; candado de ${before.candado.agente} suelto` : '';
			say(flags, out, t, `${t.id} ${t.estado} (rev ${t.rev})${freed}`);
		});
	},
	release({ pos, flags }, dir, out) {
		const agente = need(flags.agente, 'falta --agente');
		const ops = finishOps(flags['git-safety']);
		const checkout = checkoutState();
		const info = withLock(dir, () => {
			const before = getTask(dir, need(pos[0], 'falta <id>'));
			if (!before.candado) return { noLock: true, before };
			const laneIssue = lockLaneIssue(checkout, before);
			if (laneIssue) throw new UsageError(laneIssue);
			// A lock from before sessions were recorded has no sesion: only a declared coordinator frees it.
			// d274: so does one whose session went silent, once the task's cierre is valid.
			const silent =
				flags.coordinador && before.candado.sesion && isSilentLock(before.candado);
			if (silent) assertClosed(before, loadBoard(dir));
			// d274 keeps its own rule here: d290's inactive-lock writes are set and close, never release.
			else if (before.candado.sesion || !flags.coordinador)
				assertOwner(before, { ...flags, coordinador: undefined });
			if (before.candado.agente !== agente)
				throw new UsageError(`el candado es de ${before.candado.agente}`);
			// T172: a task released while still en curso goes back to pendiente, so another session can claim it.
			const after = reviewDone(before, unlocked(before, flags), flags);
			if (after.estado === 'en curso') after.estado = 'pendiente';
			const t = saveTask(dir, before, after, {
				quien: flags.quien,
				agente,
				corrio: 'pnpm board release',
			});
			return { t, rama: before.candado.rama };
		});
		if (info.noLock) return say(flags, out, info.before, `${info.before.id} no tiene candado`);
		sayClaim(
			flags,
			out,
			info.t,
			`${info.t.id} libre (rev ${info.t.rev})`,
			isExternal(info.t) ? null : finishGitSafety(checkout, info.rama, ops),
		);
	},
	move({ pos, flags }, dir, out) {
		const agente = need(flags.agente, 'falta --agente=<destino>');
		return withLock(dir, () => {
			const before = getTask(dir, need(pos[0], 'falta <id>'));
			if (before.candado)
				throw new UsageError(
					`${before.id} tiene candado de ${before.candado.agente}: primero «release»`,
				);
			// --agente names the new agent here, not the writer.
			const row = logEntry(
				before.id,
				{ agente: { de: before.agente ?? 'cualquiera', a: agente } },
				{ quien: flags.quien, coordinador: flags.coordinador },
				{ corrio: 'pnpm board move' },
			);
			const t = saveTask(
				dir,
				before,
				{ ...before, agente },
				{ quien: flags.quien, coordinador: flags.coordinador, seguimiento: true },
			);
			appendLog(dir, row);
			const aviso =
				agente === 'cualquiera' || canFinish(t, agente, loadBoard(dir))
					? ''
					: `aviso: ${agente} no tiene todo lo que pide requiere (${(t.requiere ?? []).join(', ')}); la tarea queda gris para ${agente}.`;
			const text = `${t.id} pasa a ${agente} (rev ${t.rev})${aviso ? `\n${aviso}` : ''}`;
			say(flags, out, aviso ? { ...t, aviso } : t, text);
		});
	},
	/** d288: the round waits for the head's CI to be green, polling outside the board lock (--espera-min). */
	review(args, dir, out) {
		return untilGreen(args.flags, out, () => reviewOnce(args, dir, out));
	},
	/** Old one-file-per-row bitácora → one JSONL file per day, keeping every row; --dry-run only counts. */
	'migrate-log'({ flags }, dir, out) {
		return withLock(dir, () => {
			const r = migrateLegacyLog(dir, { dryRun: Boolean(flags['dry-run']) });
			say(flags, out, r, migrateLogLines(r).join('\n'));
		});
	},
	history({ flags }, dir, out) {
		const q = typeof flags.q === 'string' ? flags.q.toLowerCase() : '';
		const rows = historyRows(loadBoard(dir), { todas: flags.todas === true }).filter(
			(r) => !q || r.txt.toLowerCase().includes(q),
		);
		if (flags.json) return out(JSON.stringify(rows, null, 2));
		for (const r of rows.slice(0, 50)) out(`${r.en}  ${r.txt.slice(0, 140)}`);
	},
	/** d210: a supervisor keeps the port open and swaps in new code by itself; nobody restarts it by hand. */
	async view({ flags }, dir, out) {
		const { superviseView } = await import('./view-supervisor.mjs');
		const port = Number(flags.port ?? 4320);
		await superviseView({ port, env: { CELEBRA_BOARD_DIR: dir }, log: console.error });
		const url = `http://127.0.0.1:${port}/`;
		say(flags, out, { url }, `Tablero en ${url}  (se actualiza solo; Ctrl+C para cerrar)`);
	},
	async sesiones({ flags }, dir, out) {
		const board = loadBoard(dir);
		const r = flags.archivables
			? await archiveSessions(board, { dir })
			: await externalSessions(board, { config: readLocal(masterConfigPath(dir)) });
		say(
			flags,
			out,
			r,
			flags.archivables
				? [
						'Se pueden archivar (d351):',
						...r.chats.map((c) => `${c.agente} · ${c.titulo} · ${c.id} · ${c.motivo}`),
						...Object.entries(r.fuentes)
							.filter(([, f]) => !f.disponible)
							.map(([agent]) => `${agent}: no disponible`),
					].join('\n')
				: externalSessionLines(r).join('\n'),
		);
	},
	verify({ flags }, dir, out) {
		const script = join(dirname(fileURLToPath(import.meta.url)), 'verify-board.mjs');
		const args = [
			script,
			dir,
			...(flags.json ? ['--json'] : []),
			...(flags.archivadas ? ['--archivadas'] : []),
		];
		try {
			out(execFileSync(process.execPath, args, { encoding: 'utf8' }).trimEnd());
		} catch (e) {
			// Exit 1 = the board has shape problems: the report is still the answer.
			if ([1, 2].includes(e.status) && e.stdout) {
				out(String(e.stdout).trimEnd());
				process.exitCode = e.status;
				return;
			}
			throw new UsageError(String(e.stderr ?? '').trim() || 'board:verify falló', {
				cause: e,
			});
		}
	},
};
const inventory = inventoryCommands({ applyPairs, checkRev });
const delivery = deliveryCommands({ getTask, saveTask });
/** The view server's `deliver` option (d249), used by «Copiar prompt». */
export const viewDeliverer = delivery.viewDeliverer;
Object.assign(
	commands,
	maintenanceCommands,
	inventory,
	nextCommands({ getTask }),
	overlapCommands({ getTask }),
	delivery.commands,
	claimCommands({ getTask, saveTask }),
	closeCommands({ getTask, saveTask, checkRev, assertOwner, overrideReason, noteOverride }),
	kindCommands({ getTask, saveTask, checkRev, assertOwner, noteOverride }),
	resumenCommands(),
	{
		archive: archiveCommand(true),
		unarchive: archiveCommand(false),
		get: commands.show,
		update: commands.set,
		decision: inventory.decide,
		log: commands.history,
	},
);

export async function run(argv, { dir = boardDir(), out = console.log, prState } = {}) {
	const [cmd, ...rest] = argv;
	const fn = commands[cmd];
	if (!fn)
		throw new UsageError(
			`comando desconocido: ${cmd ?? '(ninguno)'}. Use: ${Object.keys(commands).join(', ')}`,
		);
	const args = parseArgs(rest);
	assertCoordinator(cmd, args.flags, () => getTask(dir, need(args.pos[0], 'falta <id>')));
	const result = await fn(args, dir, out, prState ? { prState } : undefined);
	beatCaller(dir, cmd, args.flags);
	return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const argv = process.argv.slice(2);
	run(argv).catch((e) => {
		const codigo = e instanceof UsageError ? 2 : 1;
		const error = failureText(argv[0], e);
		console.error(error);
		// d290: a --json caller reads stdout, so the reason goes there too.
		if (argv.includes('--json')) console.log(JSON.stringify({ error, codigo }));
		process.exitCode = codigo;
	});
}
