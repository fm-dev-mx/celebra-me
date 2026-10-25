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
 *                                               T172: a pendiente task becomes en curso)
 *   entregada <id> --agente=<a> [--quien=<a>]  d249: its prompt was pasted into <a>'s chat; it leaves «Le toca
 *                                               a usted» until 30 min pass without a claim (claim clears it)
 *   plan <id> --carril=<id> --coordinador --rev=<n>   d177: the lane a ready task runs in; --carril= clears it
 *   release <id> --agente=<a> [--nombre=<s>] [--coordinador]   copies the lock's session into `sesion`;
 *                                               --coordinador frees a legacy lock without sesion, or
 *                                               (d274) one silent for 2 h whose task has a valid cierre;
 *                                               a task still en curso goes back to pendiente (T172), a
 *                                               review with its verdict becomes hecha
 *   merged <id> --coordinador [--rev=<n>] [--pr=#N]   d170: its PR is MERGED on GitHub → unida and the
 *                                               lock goes, whoever holds it (pnpm board:sync uses it)
 *   move <id> --agente=<b> [--quien=<a>]        hand over (only without a lock), with a bitácora row
 *   review <id> [--agente=<b>] [--sha=<sha>]    cross review: <id>-revision, then <id>-revision-2, … per new SHA;
 *                                               without --agente the reviewer follows d183
 *   close <id> --resumen=… [--resumen=…] [--comprobacion=…] [--saltada=…] [--pendiente="texto→T58"]
 *         [--fallida=…] [--riesgo=…] [--duda=…] [--excepcion=…]
 *         [--veredicto=aprobado|cambios|bloqueado] [--hallazgo="P2|archivo|texto"] [--sha=<sha>]
 *         [--nivel=validate:changed|type-check|ci] [--pr=#N] [--commit=<sha>] [--rev=<n>]
 *                                               d178: closing summary (lock owner, or --coordinador to
 *                                               complete it); repeat a flag for each line or item, «ninguna»
 *                                               for an empty list; a pendiente without its task is refused.
 *                                               T129: a task created under contrato 2 also names every
 *                                               Handoff list and its resultado (review: veredicto, sha,
 *                                               hallazgos; code: pr, sha, nivel); prints a one-line signal
 *   set <id> estado=cancelada --motivo=…        T129: a cancellation writes its cierre, the reason as summary
 *   archive <id> [--rev=<n>] / unarchive <id>   hide a finished, unlocked task with its closing summary from
 *                                               «Finalizadas» (bitácora row)
 *   decide decision=… motivo=… [tareas=a,b] [reemplaza=dNNN] [quien=…]
 *                                               T172: «(reemplaza dNNN)» in the text links it without the field
 *   carril [--json]                             T172: the lanes live, like carriles, with each record's own fields
 *   carril <id> --rev=<n> campo=valor…          lane row (no rev field yet: --rev=0)
 *   estado --rev=<n> campo=valor…               Production strip (estado/actual)
 *   history [--q=<texto>] [--todas] [--json]   replaced decisions only with --todas
 *   compact --antes=7d [--dry-run]              d187: tasks archived 7+ days ago → one line in mensual/resumen-<mes>.md,
 *                                               the whole file in mensual/<mes>.zip, a small archivo record
 *   restore <id> [--dry-run]                    a compacted task back from its .zip
 *   prune-backups [--dry-run|--aplicar]        d185: lists the surplus backup copies; only --aplicar removes them
 *   migrate-log [--dry-run]                     old one-file-per-row bitácora → bitacora/<day>.jsonl, every row kept
 *   verify [--json] [--archivadas]              same as pnpm board:verify
 *   msg <id> --de=<a> --para=<b> "texto"        T126: a message about a task, kept in the bitácora
 *   inbox --agente=<a> [--todos]                messages to <a> not read yet; marks them read
 *   sigue [--json]                              T126: «Le toca a usted», «Le toca al coordinador» and «Detenidas»,
 *                                               with GitHub's open PRs (list prints them without GitHub)
 *   carriles [--json]                           T126: each lane's branch, clean or not, and its locked task, from git
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
import { WORKTREE_LANES } from '../shared/worktree-lane.ts';
import {
	canFinish,
	claimable,
	color,
	nextFor,
	normalizePr,
	prIssues,
	queue,
	requisitos,
	requisitoLine,
	blockedText,
	stage,
	taskIssues,
	inTab,
	isFinished,
	isReadOnly,
	isReview,
	READONLY_LANE,
	laneAllowed as laneAllowedIn,
	authorOf,
	buildLogRow,
	reviewerIssue,
	reviewChild,
	reviewChildId,
	roundLines,
	reviewRounds,
	historyRows,
	logRowError,
	laneLines,
	promptWithLane,
	lockSessionIssue,
	sessionOf,
	cleaned,
	CLEANED_ON,
	unlocked,
	isSilentLock,
	SILENT_LOCK_HOURS,
	CONTRATO,
	findTask,
} from './model.mjs';
import { calendarLine, parentIssue, parentText, subtaskLines } from './subtasks.mjs';
import { archiveBlock, cierreBlock, cierreIssues } from './cierre.mjs';
import { cancelOnSet, cancelReplaced, closeCommands, reviewDone } from './close-commands.mjs';
import { claimTitleIssue, deliveryLine, nextSections, sectionLines } from './next.mjs';
import { beatCaller, nextCommands } from './next-commands.mjs';
import { deliveryCommands } from './delivery-commands.mjs';
import { undelivered } from './delivery.mjs';
import {
	appendLog,
	assertId,
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
import { UsageError, say } from './cli.mjs';
import { externalSessionLines, externalSessions } from './external-sessions.mjs';
import { kindCommands, withKindPrompt } from './kind-commands.mjs';
import { inventoryCommands } from './inventory-commands.mjs';
import { maintenanceCommands } from './maintenance.mjs';
import { ghPrState, reviewSha } from './github.mjs';
import { codexQuota, pickReviewer } from './reviewer.mjs';
import { reviewCierreIssue } from './require-cierre.mjs';
import { withTrace } from './trace.mjs';
import { traceText } from './format.mjs';
import { addToZip } from './zip.mjs';

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

/** Save a task when it gains no shape problem; bump rev and log an estado change. */
function saveTask(dir, before, after, opts = {}) {
	const { corrio, salio } = opts;
	// T172: agregadaPor on creation, seguimientoPor when opts.seguimiento marks a follow-up write.
	const traced = withTrace(before, cleaned(after, opts), opts);
	const t = { ...traced, rev: (before?.rev ?? 0) + 1, actualizado: nowIso() };
	// Archive never deletes tasks; both collections reserve their numbers permanently. A task saved before
	// numbering existed gets the next number on its first write, like a new one.
	t.num = Number.isSafeInteger(before?.num) ? before.num : nextNum(dir);
	if (t.num !== before?.num && !Number.isSafeInteger(t.num))
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
	return t;
}

/** d174: `padre=T12` becomes the mother's id; a mother off the board or a loop of mothers is refused. */
function withParent(dir, before, t) {
	if (t.padre === undefined || t.padre === before?.padre) return;
	const board = {
		tareas: readCollection(dir, 'tareas'),
		archivo: readCollection(dir, 'archivo'),
	};
	const mother = findTask(t.padre, board);
	if (mother) t.padre = mother.id;
	const issue = parentIssue(t, board);
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

function assertOwner(task, flags) {
	if (!task.candado) {
		if (!flags.coordinador)
			throw new UsageError(
				'sin candado: primero claim o use --coordinador para coordinación explícita',
			);
		return;
	}
	const sesion = sessionOf(flags.agente, flags.sesion, process.env);
	if (task.candado.agente !== flags.agente || !sesion || task.candado.sesion !== sesion)
		throw new UsageError(
			'el candado pertenece a otra sesión; indique --agente y --sesion coincidentes',
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

const laneAllowed = (carril, task) => laneAllowedIn(carril, task, WORKTREE_LANES);

/** d177: only a declared coordinator plans a lane, and only a canonical one. */
function assertPlan(task, carril, flags) {
	if (!flags.coordinador)
		throw new UsageError('el carril planeado lo asigna el coordinador: use --coordinador');
	if (isReadOnly(task)) throw new UsageError(readOnlyLaneError(task, 'carril planeado'));
	if (!laneAllowed(carril, task))
		throw new UsageError(
			`carril ${carril} no es canónico (f05-f12; integration solo para coordinador)`,
		);
}

/** Read-only tasks always run in READONLY_LANE, so they never take a lane of their own. */
const readOnlyLaneError = (task, what) =>
	isReview(task)
		? `una revisión no tiene ${what}`
		: `una tarea de solo lectura corre en ${READONLY_LANE}: no tiene ${what}`;

function claimLocation(before, flags, board) {
	const rama = typeof flags.rama === 'string' ? flags.rama : before.rama;
	const planned = before.carrilPlaneado;
	const given = typeof flags.carril === 'string' ? flags.carril : undefined;
	if (planned && given && given !== planned && !flags.coordinador)
		throw new UsageError(
			`${before.id} corre en ${planned}: omita --carril o pida al coordinador otro carril`,
		);
	const carril = given ?? planned;
	if (isReview(before) && given)
		throw new UsageError('la revisión no toma el carril del autor; omita --carril');
	// A read-only task runs in READONLY_LANE, the lane its prompt announces, and its lock holds none.
	if (isReadOnly(before) && given)
		throw new UsageError(`${readOnlyLaneError(before, 'carril propio')}; omita --carril`);
	if (isReadOnly(before) && planned)
		throw new UsageError(
			`${readOnlyLaneError(before, 'carril planeado')}; el coordinador lo quita con plan --carril= --coordinador`,
		);
	if (!isReadOnly(before) && !laneAllowed(carril, before))
		throw new UsageError(
			'falta --carril=<carril canónico f05-f12; integration solo para coordinador>',
		);
	if (carril && board.tareas.some((t) => t.id !== before.id && t.candado?.carril === carril))
		throw new UsageError(`el carril ${carril} tiene otra tarea con candado`);
	return { rama, carril };
}

function row(t, n, board, agente) {
	const c = color(t, board, { agente });
	const lock = t.candado ? ` [${t.candado.agente}]` : '';
	const why = blockedText(t, board) || deliveryLine(t);
	return `${String(n).padStart(2)}. ${COLOR_LABEL[c].padEnd(11)} ${String(t.urgencia ?? '').padEnd(8)} ${t.num ? `T${t.num} ` : ''}${t.titulo} · ${t.id}${lock}${why ? `  — ${why}` : ''}`;
}

const commands = {
	list({ flags }, dir, out) {
		const board = loadBoard(dir);
		const tab = flags.agente ?? flags.tab;
		const q = queue(board).filter((t) => inTab(t, tab));
		const review = board.tareas
			.filter((t) => stage(t, board) === 'revision' && !t.archivada && inTab(t, tab))
			.sort((a, b) => Date.parse(b.actualizado) - Date.parse(a.actualizado));
		if (flags.json)
			return out(
				JSON.stringify(
					[...q, ...review].map((t, i) => ({
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
		if (!q.length) out('Sin tareas abiertas.');
		q.forEach((t, i) => out(row(t, i + 1, board, flags.agente)));
		const mine = q.filter((t) => color(t, board) === 'own').length;
		out(`\nUsted: ${mine ? `${mine} ${mine > 1 ? 'cosas' : 'cosa'}` : 'nada'}`);
		for (const line of sectionLines(nextSections(board))) out(line);
		if (review.length) {
			out(`\nEn revisión (${review.length}):`);
			for (const t of review) out(row(t, '·', board, flags.agente));
		}
		// d276: tasks that only wait for a date left the queue; one line says when the next one comes back.
		const calendar = calendarLine(board);
		if (calendar)
			out(`
${calendar}`);
	},
	next({ flags }, dir, out) {
		const agente = need(flags.agente, 'falta --agente=claude|codex|gemini');
		const t = nextFor(agente, loadBoard(dir));
		if (flags.json) return out(JSON.stringify(t, null, 2));
		if (!t) return out(`Nada listo para ${agente}.`);
		out(
			`${t.id} (rev ${t.rev}) — ${t.num ? `T${t.num} ` : ''}${t.titulo}\n\n${promptWithLane(t, loadBoard(dir)) ?? ''}`,
		);
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
		const up = parentText(t, board);
		if (up) out(`  ${up}`);
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
			assertOwner(before, flags);
			const data = flags.data ? JSON.parse(readFileSync(resolve(flags.data), 'utf8')) : {};
			for (const key of [
				'candado',
				'agente',
				'carril',
				'carrilPlaneado',
				'origen',
				'revisionSha',
				'archivada',
				'cierre',
				'num',
				'contrato',
				'agregadaPor',
				'seguimientoPor',
				'entregada',
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
			const t = saveTask(dir, before, merged, { ...flags, seguimiento: true });
			say(flags, out, t, `${t.id} rev ${t.rev}`);
		});
	},
	claim({ pos, flags }, dir, out) {
		const agente = need(flags.agente, 'falta --agente');
		const sesion = sessionOf(agente, flags.sesion, process.env);
		const issue = lockSessionIssue(agente, sesion);
		if (issue) throw new UsageError(issue);
		return withLock(dir, () => {
			const before = getTask(dir, need(pos[0], 'falta <id>'));
			if (
				before.candado &&
				(before.candado.agente !== agente || before.candado.sesion !== sesion)
			)
				throw new UsageError(
					`${before.id} ya la tiene ${before.candado.agente} desde ${before.candado.desde}`,
				);
			if (before.candado)
				return say(flags, out, before, `${before.id} ya pertenece a esta sesión`);
			if (before.agente && before.agente !== 'cualquiera' && before.agente !== agente)
				throw new UsageError(
					`${before.id} es de ${before.agente}: pídale al coordinador un «move»`,
				);
			const board = loadBoard(dir);
			if (
				!claimable(before, agente, board) ||
				(before.actor === 'coordinador' && !flags.coordinador)
			)
				throw new UsageError(
					`${before.id} no está lista para ${agente} o requiere acción del dueño`,
				);
			const { rama, carril } = claimLocation(before, flags, board);
			const titleIssue = claimTitleIssue(before, flags.titulo, carril);
			if (titleIssue) throw new UsageError(titleIssue);
			const candado = { agente, desde: nowIso() };
			for (const [k, v] of Object.entries({
				sesion,
				carril,
				rama,
				titulo: typeof flags.titulo === 'string' ? flags.titulo.trim() : undefined,
			}))
				if (v && v !== true) candado[k] = v;
			// T172: taking a pendiente task starts it, with its «pendiente → en curso» bitácora row.
			const started = (before.estado ?? 'pendiente') === 'pendiente';
			const t = saveTask(
				dir,
				before,
				{
					// d249: a claim ends the wait the delivery mark announced.
					...undelivered(before),
					candado,
					...(carril ? { carril } : {}),
					...(rama ? { rama } : {}),
					...(started ? { estado: 'en curso' } : {}),
				},
				{ quien: flags.quien, agente, corrio: 'pnpm board claim' },
			);
			say(flags, out, t, `${t.id} es de ${agente} (rev ${t.rev})`);
		});
	},
	/** d177: the coordinator plans the lane a task runs in; claim then takes it without --carril. */
	plan({ pos, flags }, dir, out) {
		if (typeof flags.carril !== 'string') throw new UsageError('falta --carril=<carril>');
		return withLock(dir, () => {
			const before = getTask(dir, need(pos[0], 'falta <id>'));
			checkRev(before, flags);
			const carril = flags.carril || undefined;
			if (carril) assertPlan(before, carril, flags);
			else if (!flags.coordinador)
				throw new UsageError(
					'el carril planeado lo quita el coordinador: use --coordinador',
				);
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
	 */
	merged({ pos, flags }, dir, out, { prState = ghPrState } = {}) {
		if (!flags.coordinador) throw new UsageError('merged requiere --coordinador (d170)');
		return withLock(dir, () => {
			const before = getTask(dir, need(pos[0], 'falta <id>'));
			if (before.revisionSha)
				throw new UsageError('una revisión se cierra con su --sha, no con merged');
			if (flags.rev !== undefined) checkRev(before, flags);
			const given = typeof flags.pr === 'string' ? normalizePr(flags.pr) : undefined;
			const pr = normalizePr(before.pr) ?? given;
			if (!pr) throw new UsageError(`${before.id} no tiene pr: indique --pr=#<número>`);
			if (given && given !== pr) throw new UsageError(`${before.id} ya tiene ${pr}`);
			const state = prState(pr);
			if (state !== 'MERGED')
				throw new UsageError(`${pr} no está unido en GitHub (${state || 'sin respuesta'})`);
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
		return withLock(dir, () => {
			const before = getTask(dir, need(pos[0], 'falta <id>'));
			if (!before.candado) return say(flags, out, before, `${before.id} no tiene candado`);
			// A lock from before sessions were recorded has no sesion: only a declared coordinator frees it.
			// d274: so does one whose session went silent, once the task's cierre is valid.
			const silent =
				flags.coordinador && before.candado.sesion && isSilentLock(before.candado);
			if (silent) assertClosed(before, loadBoard(dir));
			else if (before.candado.sesion || !flags.coordinador) assertOwner(before, flags);
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
			say(flags, out, t, `${t.id} libre (rev ${t.rev})`);
		});
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
	/** T79: every round is a new child `<id>-revision`, `-revision-2`, … with its own prompt; d183 picks the reviewer. */
	review({ pos, flags }, dir, out) {
		return withLock(dir, () => {
			const src = getTask(dir, need(pos[0], 'falta <id>'));
			if (!src.pr || src.estado !== 'en revision')
				throw new UsageError('el origen requiere PR y estado en revision');
			const noCierre = reviewCierreIssue(src, loadBoard(dir));
			if (noCierre) throw new UsageError(noCierre);
			const author = authorOf(src);
			// d209: without --agente, Claude's work goes to the less loaded of Gemini and Codex.
			const pick =
				typeof flags.agente === 'string'
					? { agente: flags.agente, motivo: '' }
					: pickReviewer(author, loadBoard(dir), { quota: codexQuota() });
			const { agente } = pick;
			if (!agente)
				throw new UsageError('falta --agente=<revisor>: la tarea no dice su autor');
			const issue = reviewerIssue(author, agente);
			if (issue) throw new UsageError(issue);
			const sha = reviewSha(src, flags);
			const prev = reviewRounds(src.id, loadBoard(dir)).at(-1);
			if (prev?.revisionSha === sha)
				return say(flags, out, prev, `${prev.id} ya revisa ${sha}`);
			const id = reviewChildId(src, prev);
			const before = readDoc(dir, 'tareas', id);
			// The prompt-v1 session name (T160) needs the number saveTask is about to give the child.
			const num = Number.isSafeInteger(before?.num) ? before.num : nextNum(dir);
			const t = reviewChild(src, { agente, sha, prev, num, generado: nowIso() });
			// --agente names the reviewer here; the writer is --quien, the coordinator or the author.
			const who = { quien: flags.quien, coordinador: flags.coordinador, agente: author };
			const saved = saveTask(dir, before, t, who);
			const live = cancelReplaced(dir, saveTask, { prev, saved, sha, who });
			const text = `${saved.id} creada para ${agente} (vuelta ${saved.vuelta})${pick.motivo ? ` · ${pick.motivo}` : ''}${live ? `; ${live.id} cancelada` : ''}`;
			say(flags, out, saved, text);
		});
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
		const r = await externalSessions(loadBoard(dir));
		say(flags, out, r, externalSessionLines(r).join('\n'));
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
	delivery.commands,
	closeCommands({ getTask, saveTask, checkRev, assertOwner }),
	kindCommands({ getTask, saveTask, checkRev, assertOwner }),
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
	const result = await fn(args, dir, out, prState ? { prState } : undefined);
	beatCaller(dir, cmd, args.flags);
	return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	run(process.argv.slice(2)).catch((e) => {
		console.error(e instanceof UsageError ? e.message : e);
		process.exitCode = e instanceof UsageError ? 2 : 1;
	});
}
