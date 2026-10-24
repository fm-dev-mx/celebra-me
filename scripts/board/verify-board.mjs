#!/usr/bin/env node
/**
 * Read-only verifier for the «Seguimiento Celebra-me» coordinator board (rules: .agent/rules/board.md).
 *
 * Usage: pnpm board:verify [<dir>] [--json] [--sesiones=<file.json>]
 *   <dir> defaults to the local store (`.agent/tmp/board/` of Integration, d143); an ArtifactData export with the
 *   same layout (tareas/*.json, and optionally bitacora/*.json and decisiones/*.json) works too.
 *   --sesiones: JSON list of Claude sessions, either the raw `list_sessions` snapshot the coordinator writes
 *   ({ sessionId, title, isArchived }, archived sessions included) or the short form
 *   { id, nombre?, rama?, archivada? }; defaults to <dir>/sesiones.json. Without it the session drift
 *   sections are skipped and the report says so.
 *
 * Every open, «unida» or «hecha» task is checked. A task's own `chequeo: { cmd, espera }` wins; otherwise the
 * implicit check is `gh pr view <pr> --json state` → MERGED, or `git ls-remote origin <rama>` → the ref exists.
 * It also lists open PRs and worktree branches without a task, tasks whose session is archived, and tasks
 * ready to move to «comprobada», plus lifecycle drift between task, session, branch and PR: sessions without a
 * task, locks naming a missing session, session names off the d158 form, merged PR branches still present, PRs
 * closed without merge and stale close-queue entries. It only reports; it never proposes deletions. Only finite read-only argument arrays run, without a shell.
 * CELEBRA_BOARD_COMMAND_FIXTURE supplies explicit subprocess results in hermetic tests.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORKTREE_LANES } from '../shared/worktree-lane.ts';
import {
	cierreIssues,
	isFinished as isClosed,
	isReview,
	isStaleLock,
	laneAllowed,
	NO_CIERRE,
	ordenOf,
	prNumber,
	stage,
	taskIdFromBranch,
	taskIssues,
	taskLane,
	taskTag as tag,
} from './model.mjs';
import { boardDir } from './store.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const SAFE_BRANCH = /^[A-Za-z0-9._/-]{1,200}$/;
const BASE_BRANCHES = new Set(['develop', 'main', 'master']);

/** A close-queue step still pending after this long is stale. */
const CLOSING_STALE_MS = 24 * 3600_000;

export { prNumber, taskIdFromBranch };

/** Finite read-only grammar. Never execute stored shell text or arbitrary API/HTTP options. */
export function commandArgs(cmd) {
	if (typeof cmd !== 'string') return null;
	if (cmd === 'git worktree list --porcelain') return ['git', 'worktree', 'list', '--porcelain'];
	if (cmd === 'gh pr list --state open --json number,headRefName,title --limit 100')
		return cmd.split(' ');
	if (
		/^gh pr list --state closed --head [A-Za-z0-9._/-]{1,200} --json number,headRefName,state --limit 100$/.test(
			cmd,
		)
	)
		return cmd.split(' ');
	if (cmd === 'git ls-remote --heads origin') return cmd.split(' ');
	if (/^gh pr view [1-9]\d* --json (state|headRefOid)$/.test(cmd)) return cmd.split(' ');
	if (/^git ls-remote origin refs\/heads\/[A-Za-z0-9._/-]{1,200}$/.test(cmd))
		return cmd.split(' ');
	return null;
}
export const isAllowedCommand = (cmd) => commandArgs(cmd) !== null;

/** The check a task runs: its own `chequeo`, else the implicit one derived from `pr` or `rama`. */
export function checkFor(t) {
	if (t.origen && /^[a-f0-9]{40}$/.test(t.revisionSha ?? '') && prNumber(t.pr))
		return {
			cmd: `gh pr view ${prNumber(t.pr)} --json headRefOid`,
			espera: `"headRefOid":\\s*"${t.revisionSha}"`,
			implicito: true,
		};
	if (t.chequeo?.tipo === 'pr' && /^[1-9]\d*$/.test(String(t.chequeo.pr)))
		return checkFor({ pr: t.chequeo.pr });
	if (
		t.chequeo?.tipo === 'rama' &&
		typeof t.chequeo.rama === 'string' &&
		SAFE_BRANCH.test(t.chequeo.rama)
	)
		return checkFor({ rama: t.chequeo.rama });
	if (t.chequeo?.tipo) return { cmd: '', implicito: false };
	if (t.chequeo?.cmd) return { ...t.chequeo, implicito: false };
	const pr = prNumber(t.pr);
	if (pr)
		return {
			cmd: `gh pr view ${pr} --json state`,
			espera: '"state":\\s*"MERGED"',
			implicito: true,
		};
	if (t.rama && SAFE_BRANCH.test(t.rama))
		return {
			cmd: `git ls-remote origin refs/heads/${t.rama}`,
			espera: `^[a-f0-9]+\\s+refs/heads/${t.rama.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
			implicito: true,
		};
	return null;
}

function defaultRunner() {
	const fixture = process.env.CELEBRA_BOARD_COMMAND_FIXTURE;
	if (fixture) {
		const answers = JSON.parse(readFileSync(fixture, 'utf8'));
		return (cmd) =>
			answers[cmd] ?? { ok: false, output: '', error: 'sin respuesta de fixture' };
	}
	return (cmd) => {
		const args = commandArgs(cmd);
		if (!args) return { ok: false, output: '', error: 'comando rechazado' };
		try {
			return {
				ok: true,
				output: execFileSync(args[0], args.slice(1), {
					encoding: 'utf8',
					cwd: repoRoot,
					timeout: 60_000,
					stdio: ['ignore', 'pipe', 'pipe'],
					shell: false,
				}),
				error: '',
			};
		} catch {
			return { ok: false, output: '', error: 'comando falló o agotó su tiempo' };
		}
	};
}

function readJsonDir(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith('.json'))
		.map((f) => ({ id: f.slice(0, -5), ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
}

export function loadExport(dir, sesionesFile) {
	const base = readdirSync(dir).includes('tareas') ? join(dir, 'tareas') : dir;
	const root = base === dir ? join(dir, '..') : dir;
	const file = sesionesFile ?? join(root, 'sesiones.json');
	return {
		tareas: readJsonDir(base),
		bitacora: readJsonDir(join(root, 'bitacora')),
		decisiones: readJsonDir(join(root, 'decisiones')),
		archivo: readJsonDir(join(root, 'archivo')),
		cierres: readJsonDir(join(root, 'cierres')),
		sesiones: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null,
	};
}

function parseJson(text, fallback) {
	try {
		return JSON.parse(text);
	} catch {
		return fallback;
	}
}

/** Branches checked out in worktrees, from `git worktree list --porcelain`. */
export function worktreeBranches(porcelain) {
	return [...String(porcelain).matchAll(/^branch refs\/heads\/(.+)$/gm)].map((m) => m[1].trim());
}

const claims = (t, { branch, pr }) =>
	(pr && prNumber(t.pr) === pr) ||
	(branch && (t.rama === branch || t.id === taskIdFromBranch(branch)));

function expectationMet(espera, out) {
	// espera "VACIO" means the command must print nothing (e.g. git grep finds no match).
	if (espera === 'VACIO') return out.trim() === '';
	return espera ? new RegExp(espera, 'm').test(out) : out.trim().length > 0;
}

function checkTask(t, run) {
	const c = checkFor(t);
	const row = { id: t.id, estado: t.estado };
	if (!c) return { ...row, veredicto: 'SIN CHEQUEO', salida: '' };
	if (!isAllowedCommand(c.cmd))
		return {
			...row,
			veredicto: 'RECHAZADO',
			salida: 'comando fuera de la lista de solo lectura',
		};
	const result = commandResult(run, c.cmd);
	if (!result.ok) return { ...row, veredicto: 'UNVERIFIED', salida: result.error, cmd: c.cmd };
	const out = result.output;
	let ok;
	try {
		if (c.cmd.startsWith('gh pr view')) {
			const parsed = JSON.parse(out);
			if (
				c.cmd.endsWith('headRefOid')
					? !/^[a-f0-9]{40}$/.test(parsed.headRefOid ?? '')
					: !['OPEN', 'CLOSED', 'MERGED'].includes(parsed.state)
			)
				throw new Error('invalid PR response');
		}
		ok = expectationMet(c.espera, out);
	} catch {
		return {
			...row,
			veredicto: 'UNVERIFIED',
			salida: 'respuesta o expectativa inválida',
			cmd: c.cmd,
		};
	}
	const ready = ok && (t.estado === 'unida' || t.estado === 'hecha');
	let veredicto = 'NO CUMPLE';
	if (ok) veredicto = ready ? 'CUMPLE → comprobada' : 'CUMPLE (¿ya está unida?)';
	const salida = out.trim().split('\n')[0]?.slice(0, 90) ?? '';
	return { ...row, veredicto, salida, cmd: c.cmd, implicito: c.implicito, ready };
}

function commandResult(run, cmd) {
	try {
		const result = run(cmd);
		return typeof result === 'string' ? { ok: true, output: result } : result;
	} catch {
		return { ok: false, output: '', error: 'no se pudo comprobar' };
	}
}

function unclaimedWork(tareas, run) {
	const prResult = commandResult(
		run,
		'gh pr list --state open --json number,headRefName,title --limit 100',
	);
	const openPrs = prResult.ok ? parseJson(prResult.output, null) : null;
	const branchResult = commandResult(run, 'git worktree list --porcelain');
	const prsSinTarea = (Array.isArray(openPrs) ? openPrs : [])
		.filter((p) => !tareas.some((t) => claims(t, { branch: p.headRefName, pr: p.number })))
		.map((p) => ({ pr: p.number, rama: p.headRefName, titulo: p.title }));
	const laneBranches = worktreeBranches(branchResult.ok ? branchResult.output : '');
	const ramasSinTarea = laneBranches
		.filter((b) => !BASE_BRANCHES.has(b) && !tareas.some((t) => claims(t, { branch: b })))
		.filter((b) => !prsSinTarea.some((p) => p.rama === b));
	return {
		prsSinTarea,
		ramasSinTarea,
		laneBranches,
		cobertura: {
			prs: Array.isArray(openPrs) ? 'VERIFIED' : 'UNVERIFIED',
			ramas: branchResult.ok ? 'VERIFIED' : 'UNVERIFIED',
		},
	};
}

/** One shape for the raw `list_sessions` rows and the short form. */
export function normalizeSession(s) {
	return {
		id: s.sessionId ?? s.id,
		nombre: s.title ?? s.nombre ?? '',
		rama: s.rama,
		archivada:
			s.isArchived === true ||
			s.archivada === true ||
			s.estado === 'archivada' ||
			s.state === 'archived',
	};
}

function archivedSessions(tareas, sesiones) {
	if (!Array.isArray(sesiones)) return [];
	const found = [];
	for (const t of tareas.filter((x) => !isClosed(x) && x.estado !== 'unida')) {
		const s = sesiones.find(
			(x) =>
				(t.sesion?.id && x.id === t.sesion.id) || (x.rama && claims(t, { branch: x.rama })),
		);
		if (s?.archivada)
			found.push({ id: t.id, sesion: s.id, nombre: s.nombre || t.sesion?.nombre || '' });
	}
	return found;
}

const titleNum = (title) => {
	const m = String(title).match(/\bT(\d+)\b/);
	return m ? Number(m[1]) : null;
};
/** Lane part of a session name: `f08-demos` → `f08`. */
const laneTag = (carril) => String(carril ?? '').match(/^f\d+/)?.[0] ?? String(carril ?? '');
// The coordinator session owns no task of its own.
const isCoordinator = (s) => /coordinador/i.test(s.nombre);

/** Session name rule d158: `<lane> · T<n> · PR #<n> · <description>`; no PR part before it opens. */
export function nameDrift(t, nombre) {
	// Review tasks run without a lane (they never inherit the author's), so any lane prefix fits.
	const lane = laneTag(taskLane(t));
	const laneRe = lane ? lane.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '[^\\s·]+';
	const pr = prNumber(t.pr);
	const base = `^${laneRe} · T${t.num} · `;
	if (new RegExp(`${base}${pr ? `PR #${pr} · ` : ''}\\S`).test(nombre)) return null;
	if (pr && new RegExp(base).test(nombre) && !nombre.includes(`PR #${pr}`))
		return `le falta «PR #${pr}»`;
	return `se espera «${lane || '<carril>'} · T${t.num} · ${pr ? `PR #${pr} · ` : ''}<descripción>»`;
}

/** Drift between tasks and the sessions snapshot (d158, d175); null without a snapshot. */
function sessionDrift(tareas, sesiones) {
	if (!Array.isArray(sesiones)) return null;
	const open = sesiones.filter((s) => !s.archivada);
	const nums = new Set(tareas.map((t) => t.num).filter(Boolean));
	const nombreDistinto = [];
	for (const t of tareas.filter((x) => x.num && !isClosed(x))) {
		const own = open.find((s) => s.id === t.candado?.sesion);
		for (const s of own ? [own] : open.filter((x) => titleNum(x.nombre) === t.num)) {
			const msg = nameDrift(t, s.nombre);
			if (msg)
				nombreDistinto.push({
					id: t.id,
					tarea: tag(t),
					sesion: s.id,
					nombre: s.nombre,
					msg,
				});
		}
	}
	return {
		sesionesSinTarea: open
			.filter((s) => !isCoordinator(s) && !nums.has(titleNum(s.nombre)))
			.map((s) => ({ sesion: s.id, nombre: s.nombre })),
		candadoSinSesion: tareas
			.filter((t) => t.candado?.agente === 'claude' && t.candado.sesion)
			.filter((t) => !sesiones.some((s) => s.id === t.candado.sesion))
			.map((t) => ({ id: t.id, tarea: tag(t), sesion: t.candado.sesion })),
		nombreDistinto,
	};
}

/** Lifecycle drift that needs no sessions snapshot. */
function lifecycleDrift(tareas) {
	return {
		enCursoSinSesion: tareas
			.filter((t) => t.estado === 'en curso' && !t.candado)
			.map((t) => ({ id: t.id, tarea: tag(t) })),
		unidasConCandado: tareas
			.filter((t) => ['unida', 'hecha'].includes(t.estado) && t.candado)
			.map((t) => ({ id: t.id, tarea: tag(t), carril: t.candado.carril ?? '' })),
	};
}

/** Merged PR branches still present, and PRs closed without merge whose task is closed. Report only. */
function branchDrift(tareas, run, laneBranches) {
	const remoteResult = commandResult(run, 'git ls-remote --heads origin');
	const remote = new Set(
		remoteResult.ok
			? [...String(remoteResult.output).matchAll(/refs\/heads\/(\S+)/g)].map((m) => m[1])
			: [],
	);
	// One query per present branch: a repository-wide closed list would stop at its limit and
	// silently skip older PRs whose branch still exists.
	const present = [...new Set([...remote, ...laneBranches])].filter(
		(b) => !BASE_BRANCHES.has(b) && SAFE_BRANCH.test(b),
	);
	const prs = [];
	let complete = true;
	for (const branch of present) {
		const result = commandResult(
			run,
			`gh pr list --state closed --head ${branch} --json number,headRefName,state --limit 100`,
		);
		const rows = result.ok ? parseJson(result.output, null) : null;
		if (!Array.isArray(rows) || rows.length >= 100) complete = false;
		if (Array.isArray(rows)) prs.push(...rows.filter((p) => p.headRefName === branch));
	}
	const ramasUnidasSinBorrar = [];
	for (const p of prs.filter((x) => x.state === 'MERGED' && !BASE_BRANCHES.has(x.headRefName))) {
		if (remote.has(p.headRefName))
			ramasUnidasSinBorrar.push({ pr: p.number, rama: p.headRefName, donde: 'remota' });
		if (laneBranches.includes(p.headRefName))
			ramasUnidasSinBorrar.push({ pr: p.number, rama: p.headRefName, donde: 'carril' });
	}
	const prCerradoSinUnir = [];
	for (const p of prs.filter((x) => x.state === 'CLOSED' && remote.has(x.headRefName))) {
		const t = tareas.find((x) => claims(x, { branch: p.headRefName, pr: p.number }));
		if (isClosed(t))
			prCerradoSinUnir.push({ pr: p.number, rama: p.headRefName, tarea: tag(t) });
	}
	return {
		ramasUnidasSinBorrar,
		prCerradoSinUnir,
		cobertura: {
			prsCerrados: complete ? 'VERIFIED' : 'UNVERIFIED',
			ramasRemotas: remoteResult.ok ? 'VERIFIED' : 'UNVERIFIED',
		},
	};
}

/** Close-queue entries (`cierres/*.json`) with a step still pending after a day, or undated. */
function staleClosings(cierres, now) {
	return cierres
		.filter((c) => Object.values(c.pasos ?? {}).includes('pendiente'))
		.filter((c) => !c.creada || now - Date.parse(c.creada) > CLOSING_STALE_MS)
		.map((c) => ({
			id: c.tarea ?? c.id,
			nombre: c.nombre ?? '',
			pendiente: Object.keys(c.pasos).filter((k) => c.pasos[k] === 'pendiente'),
		}));
}

/** Newest log row per task, to catch a change without a new rev. */
function lastLogByTask(bitacora) {
	const last = {};
	for (const r of bitacora)
		if (r.tarea && r.en && !(Date.parse(last[r.tarea] ?? 0) >= Date.parse(r.en)))
			last[r.tarea] = r.en;
	return last;
}

function closingIssues(t) {
	const out = [];
	if (t.estado === 'comprobada' && t.prompt) out.push('cerrada con prompt');
	if (t.estado === 'comprobada' && !t.evidencia?.salio) out.push('comprobada sin evidencia');
	return out;
}

/** A log row newer than the task means a change without a new rev. */
function logIssues(t, lastLog) {
	const last = lastLog[t.id];
	return last && Date.parse(last) > Date.parse(t.actualizado ?? 0) + 60_000
		? [`bitácora de ${last} más nueva que actualizado: suba rev`]
		: [];
}

/** Requisitos naming a missing task or decision, and locks left behind. */
function taskWarnings(t, byId, decIds, now) {
	const out = [];
	for (const r of Array.isArray(t.requisitos) ? t.requisitos : []) {
		if (r.tipo === 'tarea' && !byId[r.ref])
			out.push(`requisito a una tarea fuera del tablero: ${r.ref}`);
		if (r.tipo === 'decision' && !decIds.has(r.ref))
			out.push(`requisito a una decisión inexistente: ${r.ref}`);
	}
	if (t.candado && isClosed(t)) out.push(`cerrada con candado de ${t.candado.agente}`);
	else if (t.candado && isStaleLock(t.candado, now))
		out.push(`candado de ${t.candado.agente} desde ${t.candado.desde}: ¿sigue trabajando?`);
	return out;
}

/** d178: a finished task not archived yet needs its closing summary before «Archivar». */
function cierreWarnings(t, board) {
	if (!isClosed(t) || t.archivada) return [];
	const issues = cierreIssues(t, board);
	if (!issues.length) return [];
	const fix = `pnpm board close ${t.id} --resumen=… --coordinador`;
	return [
		issues[0] === NO_CIERRE
			? `finalizada sin resumen de cierre: ${fix}`
			: `cierre incompleto (${issues.join('; ')}): ${fix}`,
	];
}

/** Numbers remain mandatory and unique even after a task is closed or archived. */
function numberIssues(tareas) {
	const issues = [];
	const numbers = new Map();
	for (const t of tareas) {
		if (!Number.isSafeInteger(t.num) || t.num < 1) {
			issues.push({
				id: t.id,
				msg: 'num debe ser un entero positivo (falta o no es válido)',
			});
			continue;
		}
		const ids = numbers.get(t.num) ?? [];
		ids.push(t.id);
		numbers.set(t.num, ids);
	}
	for (const [num, ids] of numbers)
		if (ids.length > 1)
			for (const id of ids)
				issues.push({ id, msg: `num repetido: T${num} (${ids.join(', ')})` });
	return issues;
}

/**
 * d177: a ready, unlocked agent task needs a planned canonical lane, and two of them never share one; a review
 * child runs where its reviewer is and needs none.
 */
function laneWarnings(tareas, decisiones, archivo, now) {
	const board = { tareas, decisiones, archivo };
	const avisos = [];
	const inconsistencias = [];
	const byLane = {};
	for (const t of tareas.filter((x) => !isClosed(x) && x.carrilPlaneado !== undefined))
		if (!laneAllowed(t.carrilPlaneado, t, WORKTREE_LANES))
			inconsistencias.push({
				id: t.id,
				msg: `carril planeado no canónico: ${t.carrilPlaneado}`,
			});
	const ready = tareas.filter(
		(t) =>
			t.actor === 'sesion' && !isReview(t) && !t.candado && stage(t, board, now) === 'lista',
	);
	for (const t of ready) {
		if (!t.carrilPlaneado)
			avisos.push({
				id: t.id,
				msg: `lista sin carril planeado: pnpm board plan ${t.id} --rev=${t.rev} --carril=<carril> --coordinador`,
			});
		else (byLane[t.carrilPlaneado] ??= []).push(t.id);
	}
	for (const [lane, ids] of Object.entries(byLane))
		if (ids.length > 1)
			for (const id of ids)
				avisos.push({
					id,
					msg: `carril ${lane} planeado para ${ids.length} tareas listas: ${ids.join(', ')}`,
				});
	return { avisos, inconsistencias };
}

function boardIssues(tareas, bitacora, decisiones, archivo, now) {
	const byId = Object.fromEntries(tareas.map((t) => [t.id, t]));
	const decIds = new Set(decisiones.map((d) => d.id));
	const lastLog = lastLogByTask(bitacora);
	const inconsistencias = numberIssues(tareas);
	const avisos = [];
	const visited = new Set();
	const cycles = new Set();
	const visit = (id, path = []) => {
		const start = path.indexOf(id);
		if (start >= 0) {
			for (const member of path.slice(start)) cycles.add(member);
			return;
		}
		if (visited.has(id)) return;
		visited.add(id);
		for (const r of byId[id]?.requisitos ?? [])
			if (['tarea', 'revision'].includes(r.tipo)) visit(r.ref, [...path, id]);
	};
	for (const t of tareas) visit(t.id);
	for (const id of cycles) inconsistencias.push({ id, msg: 'ciclo de requisitos' });
	for (const t of tareas) {
		const msgs = closingIssues(t);
		if (!isClosed(t)) msgs.push(...taskIssues(t), ...logIssues(t, lastLog));
		for (const msg of msgs) inconsistencias.push({ id: t.id, msg });
		for (const msg of taskWarnings(t, byId, decIds, now)) avisos.push({ id: t.id, msg });
		for (const msg of cierreWarnings(t, { tareas, archivo })) avisos.push({ id: t.id, msg });
	}
	for (const d of decisiones) {
		if (typeof d.vigente !== 'boolean')
			avisos.push({ id: d.id, msg: 'decisión sin vigente: true|false' });
		if (d.reemplaza && !decIds.has(d.reemplaza))
			inconsistencias.push({
				id: d.id,
				msg: `reemplaza a una decisión inexistente: ${d.reemplaza}`,
			});
	}
	const lanes = laneWarnings(tareas, decisiones, archivo, now);
	avisos.push(...lanes.avisos);
	inconsistencias.push(...lanes.inconsistencias);
	return { inconsistencias, avisos };
}

export function verifyBoard(
	{ tareas, bitacora = [], decisiones = [], archivo = [], cierres = [], sesiones = null },
	run = defaultRunner(),
	now = Date.now(),
) {
	const snapshot = Array.isArray(sesiones) ? sesiones.map(normalizeSession) : null;
	const unclaimed = unclaimedWork(tareas, run);
	const branches = branchDrift(tareas, run, unclaimed.laneBranches);
	const live = tareas
		.filter((t) => t.estado !== 'comprobada' && t.estado !== 'cancelada')
		.sort((a, b) => ordenOf(a) - ordenOf(b));
	const checked = live.map((t) => checkTask(t, run));
	const filas = checked.map((r) => {
		const row = { ...r };
		delete row.ready;
		return row;
	});
	const comprobar = checked
		.filter((r) => r.ready)
		.map((r) => ({ id: r.id, evidencia: { cmd: r.cmd, salio: r.salida } }));
	return {
		filas,
		comprobar,
		prsSinTarea: unclaimed.prsSinTarea,
		ramasSinTarea: unclaimed.ramasSinTarea,
		sesionArchivada: archivedSessions(tareas, snapshot),
		sesiones: snapshot ? 'VERIFIED' : 'SIN FOTO',
		...(sessionDrift(tareas, snapshot) ?? {
			sesionesSinTarea: [],
			candadoSinSesion: [],
			nombreDistinto: [],
		}),
		...lifecycleDrift(tareas),
		ramasUnidasSinBorrar: branches.ramasUnidasSinBorrar,
		prCerradoSinUnir: branches.prCerradoSinUnir,
		cierresPendientes: staleClosings(cierres, now),
		cobertura: { ...unclaimed.cobertura, ...branches.cobertura },
		...boardIssues(tareas, bitacora, decisiones, archivo, now),
	};
}

function printText(r) {
	const w = [32, 10, 26];
	for (const f of r.filas)
		console.log(
			[f.id, f.estado, f.veredicto, f.salida]
				.map((v, i) => (i < 3 ? String(v ?? '').padEnd(w[i]) : v))
				.join(' '),
		);
	const hits = r.filas.filter((f) => f.veredicto.startsWith('CUMPLE')).length;
	const none = r.filas.filter((f) => f.veredicto === 'SIN CHEQUEO').length;
	console.log(
		`\n${r.filas.length} tareas abiertas · ${hits} cumplen su chequeo · ${none} sin chequeo`,
	);
	const section = (title, list, fmt) => {
		if (!list.length) return;
		console.log(`\n${title} (${list.length}):`);
		for (const x of list) console.log(`  ${fmt(x)}`);
	};
	section(
		'LISTAS PARA comprobada',
		r.comprobar,
		(x) => `${x.id.padEnd(32)} ${x.evidencia.salio}`,
	);
	section('PRs ABIERTOS SIN TAREA', r.prsSinTarea, (x) => `#${x.pr} ${x.rama} — ${x.titulo}`);
	section('RAMAS DE WORKTREE SIN TAREA', r.ramasSinTarea, (x) => x);
	section(
		'TAREAS CON SESIÓN ARCHIVADA',
		r.sesionArchivada,
		(x) => `${x.id.padEnd(32)} ${x.sesion} ${x.nombre}`,
	);
	const drift = (title, list, fmt) =>
		console.log(`  ${title}: ${list.length ? list.map(fmt).join(', ') : 'ninguna'}`);
	console.log('\nDESFASES (solo informa):');
	if (r.sesiones === 'SIN FOTO')
		console.log(
			'  SESIONES: no hay sesiones.json (foto de list_sessions); se omiten SESIONES SIN TAREA, CANDADO CON SESIÓN INEXISTENTE y NOMBRE DISTINTO.',
		);
	else {
		drift('SESIONES SIN TAREA', r.sesionesSinTarea, (x) => `«${x.nombre}»`);
		drift('CANDADO CON SESIÓN INEXISTENTE', r.candadoSinSesion, (x) => x.tarea);
		drift('NOMBRE DISTINTO', r.nombreDistinto, (x) => `«${x.nombre}» (${x.msg})`);
	}
	drift('TAREAS EN CURSO SIN SESIÓN', r.enCursoSinSesion, (x) => x.tarea);
	drift('UNIDAS CON CANDADO', r.unidasConCandado, (x) => `${x.tarea} (${x.carril})`);
	drift(
		'RAMAS UNIDAS SIN BORRAR',
		r.ramasUnidasSinBorrar,
		(x) => `${x.rama} (PR #${x.pr}, ${x.donde})`,
	);
	drift('PR CERRADO SIN UNIR', r.prCerradoSinUnir, (x) => `${x.rama} (PR #${x.pr}, ${x.tarea})`);
	drift(
		'ARCHIVADAS CON CIERRE PENDIENTE',
		r.cierresPendientes,
		(x) => `${x.id} (${x.pendiente.join(', ')})`,
	);
	section('AVISOS', r.avisos, (x) => `${x.id.padEnd(32)} ${x.msg}`);
	section(
		'COBERTURA NO VERIFICADA',
		Object.entries(r.cobertura).filter(([, value]) => value === 'UNVERIFIED'),
		([name]) => name,
	);
	console.log(
		r.inconsistencias.length
			? `\nINCONSISTENCIAS (${r.inconsistencias.length}):`
			: '\nSin inconsistencias de forma.',
	);
	for (const x of r.inconsistencias) console.log(`  ${x.id.padEnd(32)} ${x.msg}`);
}

function main(argv) {
	const json = argv.includes('--json');
	const sesionesArg = argv.find((a) => a.startsWith('--sesiones='))?.slice('--sesiones='.length);
	// pnpm runs scripts from the repository root; INIT_CWD keeps relative paths relative to the caller.
	const cwd = process.env.INIT_CWD || process.cwd();
	const arg = argv.find((a) => !a.startsWith('--'));
	const dir = arg ? resolve(cwd, arg) : boardDir();
	if (!existsSync(dir)) {
		console.error(
			`No hay tablero en ${dir}. Uso: pnpm board:verify [<dir>] [--json] [--sesiones=<archivo.json>]`,
		);
		process.exit(2);
	}
	const result = verifyBoard(loadExport(dir, sesionesArg && resolve(cwd, sesionesArg)));
	if (json) console.log(JSON.stringify(result, null, 2));
	else printText(result);
	if (result.inconsistencias.length) process.exitCode = 1;
	else if (
		result.filas.some((r) => r.veredicto === 'UNVERIFIED') ||
		Object.values(result.cobertura).includes('UNVERIFIED')
	)
		process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	main(process.argv.slice(2));
