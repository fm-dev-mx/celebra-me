#!/usr/bin/env node
/**
 * `pnpm board` — the only way agents read and write the board (rules: .agent/rules/board.md, d143/d144).
 *
 *   list [--agente=<a>|--tab=libres] [--json]   numbered queue with its color
 *   next --agente=<a> [--json]                  first ready, unlocked task that agent finishes alone
 *   show <id|T<n>> [--json]                    set and claim also accept the fixed task number
 *   add <id> titulo=… urgencia=… actor=… [campo=valor…]
 *   set <id> --rev=<n> campo=valor… [--data=<file.json>] [--quien=<a>] [--corrio=…] [--salio=…]
 *   claim <id> --agente=<a> [--sesion=<id>] [--carril=<id>] [--rama=<b>]   lock: one owner at a time
 *                                               (rama defaults to the task's declared branch; Claude's sesion
 *                                               defaults to CLAUDE_CODE_HOST_SESSION_ID and must start with local_;
 *                                               carril defaults to the planned lane, another needs --coordinador)
 *   plan <id> --carril=<id> --coordinador --rev=<n>   d177: the lane a ready task runs in; --carril= clears it
 *   release <id> --agente=<a> [--nombre=<s>] [--coordinador]   copies the lock's session into `sesion`;
 *                                               --coordinador frees only a legacy lock without sesion
 *   merged <id> --coordinador [--rev=<n>] [--pr=#N]   d170: its PR is MERGED on GitHub → unida and the
 *                                               lock goes, whoever holds it (pnpm board:sync uses it)
 *   move <id> --agente=<b> [--quien=<a>]        hand over (only without a lock), with a bitácora row
 *   review <id> [--agente=<b>] [--sha=<sha>]    cross review: <id>-revision, then <id>-revision-2, … per new SHA;
 *                                               without --agente the reviewer follows d183
 *   close <id> --resumen=… [--resumen=…] [--comprobacion=…] [--saltada=…] [--pendiente="texto→T58"]
 *         [--pr=#N] [--commit=<sha>] [--rev=<n>]   d178: closing summary (lock owner, or --coordinador to
 *                                               complete it); repeat a flag for each line or item, «ninguna»
 *                                               for an empty list; a pendiente without its task is refused
 *   archive <id> [--rev=<n>] / unarchive <id>   hide a finished, unlocked task with its closing summary from
 *                                               «Finalizadas» (bitácora row)
 *   decide decision=… motivo=… [tareas=a,b] [reemplaza=dNNN] [quien=…]
 *   carril <id> --rev=<n> campo=valor…          lane row (no rev field yet: --rev=0)
 *   estado --rev=<n> campo=valor…               Production strip (estado/actual)
 *   history [--q=<texto>] [--todas] [--json]   replaced decisions only with --todas
 *   compact --antes=7d [--dry-run]              d187: tasks archived 7+ days ago → one line in mensual/resumen-<mes>.md,
 *                                               the whole file in mensual/<mes>.zip, a small archivo record
 *   restore <id> [--dry-run]                    a compacted task back from its .zip
 *   prune-backups [--dry-run|--aplicar]        d185: lists the surplus backup copies; only --aplicar removes them
 *   migrate-log [--dry-run]                     old one-file-per-row bitácora → bitacora/<day>.jsonl, every row kept
 *   verify [--json]                             same as pnpm board:verify
 *   view [--port=4320]                          local page at http://127.0.0.1:<port>/, live; its only write is
 *                                               archive/unarchive, same-origin from 127.0.0.1
 *
 * Aliases: get = show, update = set, decision = decide, log = history. Every command takes --json.
 * Values are JSON when they look like JSON (numbers, true/false/null, [..], {..}); `campo=` removes the field.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORKTREE_LANES } from '../shared/worktree-lane.ts';
import {
	archiveBlock,
	buildCierre,
	canFinish,
	cierreBlock,
	cierreIssues,
	cierreLines,
	claimable,
	AGENT_REGISTRY,
	color,
	nextFor,
	normalizePr,
	prIssues,
	queue,
	requisitos,
	stage,
	taskIssues,
	inTab,
	isFinished,
	isReview,
	laneAllowed as laneAllowedIn,
	authorOf,
	buildLogRow,
	defaultReviewer,
	reviewerIssue,
	reviewChild,
	roundLines,
	reviewRounds,
	historyRows,
	logRowError,
	laneLines,
	promptWithLane,
	lockSessionIssue,
	sessionOf,
	cleaned,
	unlocked,
} from './model.mjs';
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
import { maintenanceCommands } from './maintenance.mjs';
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

/** Save a task when it gains no shape problem; bump rev and log an estado change. */
function saveTask(dir, before, after, opts = {}) {
	const { corrio, salio } = opts;
	const t = { ...cleaned(after, opts), rev: (before?.rev ?? 0) + 1, actualizado: nowIso() };
	// Archive never deletes tasks; both collections reserve their numbers permanently. A task saved before
	// numbering existed gets the next number on its first write, like a new one.
	t.num = Number.isSafeInteger(before?.num)
		? before.num
		: [...readCollection(dir, 'tareas'), ...readCollection(dir, 'archivo')].reduce(
				(max, task) => (Number.isSafeInteger(task.num) ? Math.max(max, task.num) : max),
				0,
			) + 1;
	if (t.num !== before?.num && !Number.isSafeInteger(t.num))
		throw new UsageError('se agotaron los números de tarea');
	const pr = normalizePr(t.pr);
	if (pr === undefined) delete t.pr;
	else t.pr = pr;
	const old = before ? new Set(taskIssues(before)) : new Set();
	// A legacy record keeps unrelated problems, but a write that touches the PR rule must satisfy it.
	const touchesPr = ['pr', 'estado', 'rama'].some((k) => before?.[k] !== t[k]);
	const strict = new Set(touchesPr ? prIssues(t) : []);
	const added = taskIssues(t).filter((m) => strict.has(m) || !old.has(m));
	if (added.length) throw new UsageError(`no se escribió ${t.id}: ${added.join('; ')}`);
	const row =
		(before?.estado ?? null) !== t.estado &&
		logEntry(t.id, { de: before?.estado, a: t.estado }, opts, { corrio, salio });
	// The prompt reaches the month's .zip before the task loses it.
	if (after.prompt && !t.prompt)
		addToZip(monthlyZip(dir, t.actualizado.slice(0, 7)), [
			{ name: `prompts/${t.id}.rev${t.rev}.md`, data: after.prompt },
		]);
	writeDoc(dir, 'tareas', t.id, t, { backup: !isFinished(before) });
	if (row) appendLog(dir, row);
	return t;
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

/** `gh pr view <n> --json state` → OPEN, MERGED or CLOSED. */
function ghPrState(pr) {
	return execFileSync(
		'gh',
		['pr', 'view', String(pr).replace(/^#/, ''), '--json', 'state', '--jq', '.state'],
		{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
	).trim();
}

function reviewSha(task, flags) {
	const sha =
		typeof flags.sha === 'string'
			? flags.sha
			: execFileSync(
					'gh',
					[
						'pr',
						'view',
						String(task.pr).replace(/^#/, ''),
						'--json',
						'headRefOid',
						'--jq',
						'.headRefOid',
					],
					{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
				).trim();
	if (!/^[a-f0-9]{40}$/.test(sha))
		throw new UsageError('falta un SHA completo del PR (--sha=<40 hex>)');
	return sha;
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

/** d178: the closing summary a session writes when it finishes (or the coordinator completes). */
function closeCommand({ pos, flags, lists }, dir, out) {
	return withLock(dir, () => {
		const before = getTask(dir, need(pos[0], 'falta <id>'));
		if (flags.rev !== undefined) checkRev(before, flags);
		// The lock owner writes it; a declared coordinator completes it, also after the lock is gone.
		if (!flags.coordinador) assertOwner(before, flags);
		const board = loadBoard(dir);
		const cierre = buildCierre(before.cierre, { flags, lists }, board, nowIso());
		const issues = cierreIssues({ ...before, cierre }, board);
		if (issues.length)
			throw new UsageError(`no se escribió ${before.id}: ${issues.join('; ')}`);
		const t = saveTask(dir, before, { ...before, cierre });
		const text = [`${t.id} con cierre (rev ${t.rev})`, ...cierreLines(t, board)];
		say(flags, out, t, text.join('\n'));
	});
}

const laneAllowed = (carril, task) => laneAllowedIn(carril, task, WORKTREE_LANES);

/** d177: only a declared coordinator plans a lane, and only a canonical one. */
function assertPlan(task, carril, flags) {
	if (!flags.coordinador)
		throw new UsageError('el carril planeado lo asigna el coordinador: use --coordinador');
	if (!laneAllowed(carril, task))
		throw new UsageError(
			`carril ${carril} no es canónico (f05-f12; integration solo para coordinador)`,
		);
}

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
	if (!isReview(before) && !laneAllowed(carril, before))
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
	const first = requisitos(t, board).find((r) => !r.ok);
	const why =
		stage(t, board) === 'bloqueada' && first ? `espera ${first.tipo} ${first.ref}`.trim() : '';
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
		if (review.length) {
			out(`\nEn revisión (${review.length}):`);
			for (const t of review) out(row(t, '·', board, flags.agente));
		}
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
		for (const line of laneLines(t, board)) out(`  ${line}`);
		for (const r of requisitos(t, board)) out(`  ${r.ok ? '✓' : '○'} ${r.tipo} ${r.ref}`);
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
		for (const line of [...roundLines(t, board), ...cierreBlock(t, board)]) out(line);
		if (t.prompt) out(`\n${t.prompt}`);
	},
	add({ pos, pairs, flags }, dir, out) {
		const id = assertId(need(pos[0], 'falta <id>'));
		return withLock(dir, () => {
			if (readDoc(dir, 'tareas', id)) throw new UsageError(`ya existe la tarea ${id}`);
			const t = applyPairs({ id, estado: 'pendiente', requisitos: [] }, pairs);
			if (t.carrilPlaneado !== undefined) assertPlan(t, t.carrilPlaneado, flags);
			const saved = saveTask(dir, null, t, {
				quien: flags.quien,
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
			])
				if (Object.hasOwn(pairs, key) || Object.hasOwn(data, key))
					throw new UsageError(`${key} requiere su comando de coordinación, no set`);
			const merged = applyPairs({ ...before, ...data, id: before.id }, pairs);
			if (before.candado?.rama && merged.rama !== before.candado.rama)
				throw new UsageError('rama distinta del candado');
			if (
				isReview(before) &&
				['hecha', 'comprobada'].includes(merged.estado) &&
				flags.sha !== before.revisionSha
			)
				throw new UsageError('la revisión debe declarar --sha igual al SHA revisado');
			const t = saveTask(dir, before, merged, flags);
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
			const candado = { agente, desde: nowIso() };
			for (const [k, v] of Object.entries({
				sesion,
				carril,
				rama,
			}))
				if (v && v !== true) candado[k] = v;
			const t = saveTask(dir, before, {
				...before,
				candado,
				...(carril ? { carril } : {}),
				...(rama ? { rama } : {}),
			});
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
			const after = { ...before };
			if (carril) after.carrilPlaneado = carril;
			else delete after.carrilPlaneado;
			const row = logEntry(
				before.id,
				{ carril: { de: before.carrilPlaneado ?? '', a: carril ?? '' } },
				{ quien: flags.quien, coordinador: flags.coordinador },
				{ corrio: 'pnpm board plan' },
			);
			const t = saveTask(dir, before, after);
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
			if (before.candado.sesion || !flags.coordinador) assertOwner(before, flags);
			if (before.candado.agente !== agente)
				throw new UsageError(`el candado es de ${before.candado.agente}`);
			const t = saveTask(dir, before, unlocked(before, flags));
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
			const t = saveTask(dir, before, { ...before, agente });
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
			const author = authorOf(src);
			const agente =
				typeof flags.agente === 'string' ? flags.agente : defaultReviewer(author);
			if (!agente)
				throw new UsageError('falta --agente=<revisor>: la tarea no dice su autor');
			const issue = reviewerIssue(author, agente);
			if (issue) throw new UsageError(issue);
			const sha = reviewSha(src, flags);
			const prev = reviewRounds(src.id, loadBoard(dir)).at(-1);
			if (prev?.revisionSha === sha)
				return say(flags, out, prev, `${prev.id} ya revisa ${sha}`);
			const t = reviewChild(src, { agente, sha, prev });
			// --agente names the reviewer here; the writer is --quien, the coordinator or the author.
			const who = { quien: flags.quien, coordinador: flags.coordinador, agente: author };
			const saved = saveTask(dir, readDoc(dir, 'tareas', t.id), t, who);
			say(flags, out, saved, `${saved.id} creada para ${agente} (vuelta ${saved.vuelta})`);
		});
	},
	decide({ pairs, flags }, dir, out) {
		need(pairs.decision, 'falta decision=…');
		return withLock(dir, () => {
			const all = readCollection(dir, 'decisiones');
			const n =
				Math.max(0, ...all.map((d) => Number(String(d.id).replace(/^d/, '')) || 0)) + 1;
			const id = `d${String(n).padStart(3, '0')}`;
			if (pairs.reemplaza) {
				const old = readDoc(dir, 'decisiones', pairs.reemplaza);
				if (!old) throw new UsageError(`no existe ${pairs.reemplaza}`);
				writeDoc(dir, 'decisiones', old.id, { ...old, vigente: false });
			}
			const tareas = pairs.tareas ? pairs.tareas.split(',').filter(Boolean) : [];
			const d = {
				...pairs,
				tareas,
				id,
				en: nowIso(),
				vigente: true,
				quien: pairs.quien ?? 'dueño',
			};
			writeDoc(dir, 'decisiones', id, d);
			say(flags, out, d, `${id} registrada`);
		});
	},
	carril({ pos, pairs, flags }, dir, out) {
		if (!pos.length)
			return say(
				flags,
				out,
				readCollection(dir, 'carriles'),
				JSON.stringify(readCollection(dir, 'carriles'), null, 2),
			);
		const id = assertId(need(pos[0], 'falta <id>'));
		return withLock(dir, () => {
			const before = readDoc(dir, 'carriles', id) ?? { id };
			checkRev(before, flags);
			const l = {
				...applyPairs(before, pairs),
				rev: (before.rev ?? 0) + 1,
				comprobadoEn: nowIso(),
			};
			writeDoc(dir, 'carriles', id, l);
			say(flags, out, { ...l, id }, `${id} rev ${l.rev}`);
		});
	},
	estado({ pairs, flags }, dir, out) {
		if (!Object.keys(pairs).length)
			return say(
				flags,
				out,
				readDoc(dir, 'estado', 'actual'),
				JSON.stringify(readDoc(dir, 'estado', 'actual'), null, 2),
			);
		return withLock(dir, () => {
			const before = readDoc(dir, 'estado', 'actual') ?? { id: 'actual' };
			checkRev(before, flags);
			const e = { ...applyPairs(before, pairs), rev: (before.rev ?? 0) + 1, revEn: nowIso() };
			writeDoc(dir, 'estado', 'actual', e);
			say(flags, out, { ...e, id: 'actual' }, `estado rev ${e.rev}`);
		});
	},
	agentes({ pos, flags, pairs }, dir, out) {
		if (!pos.length) {
			const records = Object.entries(AGENT_REGISTRY).map(([id, a]) => ({
				id,
				...a,
				...readDoc(dir, 'agentes', id),
			}));
			return say(flags, out, records, JSON.stringify(records, null, 2));
		}
		if (!flags.coordinador) throw new UsageError('capacidades requieren --coordinador');
		const id = pos[0];
		if (!Object.hasOwn(AGENT_REGISTRY, id)) throw new UsageError('agente desconocido');
		return withLock(dir, () => {
			const before = readDoc(dir, 'agentes', id);
			checkRev(before, flags);
			if (Object.keys(pairs).some((k) => k !== 'capacidades'))
				throw new UsageError('solo se actualiza capacidades');
			const after = applyPairs({ id, ...before }, pairs);
			if (
				!Array.isArray(after.capacidades) ||
				after.capacidades.some((c) => typeof c !== 'string')
			)
				throw new UsageError('capacidades debe ser lista de texto');
			after.rev = (before?.rev ?? 0) + 1;
			writeDoc(dir, 'agentes', id, after);
			say(flags, out, after, `${id} rev ${after.rev}`);
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
	async view({ flags }, dir, out) {
		const { serveView } = await import('./view-server.mjs');
		const port = Number(flags.port ?? 4320);
		await serveView(dir, port, { archive: viewArchiver(dir) });
		const url = `http://127.0.0.1:${port}/`;
		say(flags, out, { url }, `Tablero en ${url}  (Ctrl+C para cerrar)`);
	},
	verify({ flags }, dir, out) {
		const script = join(dirname(fileURLToPath(import.meta.url)), 'verify-board.mjs');
		const args = [script, dir, ...(flags.json ? ['--json'] : [])];
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
Object.assign(commands, maintenanceCommands, {
	close: closeCommand,
	archive: archiveCommand(true),
	unarchive: archiveCommand(false),
	get: commands.show,
	update: commands.set,
	decision: commands.decide,
	log: commands.history,
});

export async function run(argv, { dir = boardDir(), out = console.log, prState } = {}) {
	const [cmd, ...rest] = argv;
	const fn = commands[cmd];
	if (!fn)
		throw new UsageError(
			`comando desconocido: ${cmd ?? '(ninguno)'}. Use: ${Object.keys(commands).join(', ')}`,
		);
	return fn(parseArgs(rest), dir, out, prState ? { prState } : undefined);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	run(process.argv.slice(2)).catch((e) => {
		console.error(e instanceof UsageError ? e.message : e);
		process.exitCode = e instanceof UsageError ? 2 : 1;
	});
}
