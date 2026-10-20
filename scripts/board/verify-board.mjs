#!/usr/bin/env node
/**
 * Read-only verifier for the «Seguimiento Celebra-me» coordinator board (rules: .agent/rules/board.md).
 *
 * Usage: pnpm board:verify <dir> [--json] [--sesiones=<file.json>]
 *   <dir> holds the ArtifactData export: tareas/*.json, and optionally bitacora/*.json and decisiones/*.json.
 *   --sesiones: JSON list of Claude sessions [{ id, nombre?, rama?, archivada? | estado? }]; defaults to
 *   <dir>/sesiones.json when present.
 *
 * Every open, «unida» or «hecha» task is checked. A task's own `chequeo: { cmd, espera }` wins; otherwise the
 * implicit check is `gh pr view <pr> --json state` → MERGED, or `git ls-remote origin <rama>` → the ref exists.
 * It also lists open PRs and worktree branches without a task, tasks whose session is archived, and tasks
 * ready to move to «comprobada». Commands run from the repository root through cmd.exe on Windows, so ^ and %
 * are refused in cmd. CELEBRA_BOARD_COMMAND_FIXTURE (a JSON map cmd → output) answers commands in tests.
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const ALLOWED = [
	/^git (ls-remote|log|rev-parse|show|cat-file|branch --list|merge-base|grep|worktree list)( |$)/,
	/^git -C [^ ]+ (worktree list|status --porcelain|branch --list)( |$)/,
	/^gh (pr view|pr checks|pr list|run list|run view|api repos\/[^ ]+\/(pulls|commits|actions)[^ ]*) ?/,
	/^curl -s(I|S)? /,
];
const FORBIDDEN =
	/[;&|<>`$\\^%]|--apply|\bpush\b|\bdelete\b|\s-X\b|--method|\s-[fF]\s|--field|--input/;
const SAFE_BRANCH = /^[A-Za-z0-9._/-]{1,200}$/;
const BASE_BRANCHES = new Set(['develop', 'main', 'master']);

const ESPERAS = ['usted', 'sesion', 'rutina', 'fecha', 'tarea', ''];
const SCOPES = ['produccion', 'migracion', 'release'];

/** Task id rule: the branch name without its type prefix (`fix/olivia-gallery` → `olivia-gallery`). */
export const taskIdFromBranch = (branch) => String(branch ?? '').replace(/^[^/]+\//, '');

/** PR number from 398, "#398" or a pull URL; null when the field holds none. */
export function prNumber(pr) {
	const m = String(pr ?? '').match(/(\d+)\s*$/);
	return m ? Number(m[1]) : null;
}

export function isAllowedCommand(cmd) {
	return ALLOWED.some((r) => r.test(cmd)) && !FORBIDDEN.test(cmd);
}

/** The check a task runs: its own `chequeo`, else the implicit one derived from `pr` or `rama`. */
export function checkFor(t) {
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
			espera: `refs/heads/${t.rama}$`,
			implicito: true,
		};
	return null;
}

function defaultRunner() {
	const fixture = process.env.CELEBRA_BOARD_COMMAND_FIXTURE;
	if (fixture) {
		const answers = JSON.parse(readFileSync(fixture, 'utf8'));
		return (cmd) => answers[cmd] ?? '';
	}
	return (cmd) => {
		try {
			return execSync(cmd, {
				encoding: 'utf8',
				cwd: repoRoot,
				timeout: 60_000,
				stdio: ['ignore', 'pipe', 'pipe'],
			});
		} catch (e) {
			return String(e.stdout || '') + String(e.stderr || '');
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

const isClosed = (t) => ['hecha', 'comprobada', 'cancelada'].includes(t?.estado);
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
	const out = run(c.cmd);
	const ok = expectationMet(c.espera, out);
	const ready = ok && (t.estado === 'unida' || t.estado === 'hecha');
	let veredicto = 'NO CUMPLE';
	if (ok) veredicto = ready ? 'CUMPLE → comprobada' : 'CUMPLE (¿ya está unida?)';
	const salida = out.trim().split('\n')[0]?.slice(0, 90) ?? '';
	return { ...row, veredicto, salida, cmd: c.cmd, implicito: c.implicito, ready };
}

function unclaimedWork(tareas, run) {
	const openPrs = parseJson(
		run('gh pr list --state open --json number,headRefName,title --limit 100'),
		[],
	);
	const prsSinTarea = (Array.isArray(openPrs) ? openPrs : [])
		.filter((p) => !tareas.some((t) => claims(t, { branch: p.headRefName, pr: p.number })))
		.map((p) => ({ pr: p.number, rama: p.headRefName, titulo: p.title }));
	const ramasSinTarea = worktreeBranches(run('git worktree list --porcelain'))
		.filter((b) => !BASE_BRANCHES.has(b) && !tareas.some((t) => claims(t, { branch: b })))
		.filter((b) => !prsSinTarea.some((p) => p.rama === b));
	return { prsSinTarea, ramasSinTarea };
}

function archivedSessions(tareas, sesiones) {
	if (!Array.isArray(sesiones)) return [];
	const archived = (s) =>
		s.archivada === true || s.estado === 'archivada' || s.state === 'archived';
	const found = [];
	for (const t of tareas.filter((x) => !isClosed(x) && x.estado !== 'unida')) {
		const s = sesiones.find(
			(x) =>
				(t.sesion?.id && x.id === t.sesion.id) || (x.rama && claims(t, { branch: x.rama })),
		);
		if (s && archived(s))
			found.push({ id: t.id, sesion: s.id, nombre: s.nombre ?? t.sesion?.nombre ?? '' });
	}
	return found;
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

function depIssues(t, byId) {
	const out = [];
	for (const d of t.deps ?? []) {
		if (!byId[d]) out.push(`dep inexistente: ${d}`);
		// d038: si su dep sigue abierta, el prompt debe frenar en el prerrequisito.
		else if (
			!isClosed(byId[d]) &&
			t.prompt &&
			!t.prompt.includes('Comprueba primero el prerrequisito')
		)
			out.push(`tiene prompt sin freno y espera a ${d}`);
	}
	return out;
}

function ustedOk(usted) {
	// usted is plain text or a list of steps [{t, cmd?, cmds?, url?, ir?}] (diseño d4).
	if (Array.isArray(usted))
		return usted.length > 0 && usted.every((s) => String(s?.t ?? '').trim());
	return !!String(usted ?? '').trim();
}

function shapeIssues(t) {
	const out = [];
	if (!t.titulo?.trim()) out.push('falta titulo');
	if (t.toca !== undefined && !(Array.isArray(t.toca) && t.toca.every((s) => SCOPES.includes(s))))
		out.push(`toca debe ser lista de ${SCOPES.join('/')}`);
	if (!ESPERAS.includes(t.espera ?? '')) out.push(`espera desconocida: ${t.espera}`);
	// d046: every prompt asks all owner decisions in one round at the start.
	if (t.prompt && !t.prompt.includes('\nDECISIONES\n'))
		out.push('prompt sin sección DECISIONES (d046)');
	if (t.espera === 'usted' && !ustedOk(t.usted))
		out.push('espera a usted pero no dice qué hacer (campo usted)');
	return out;
}

/** Dates, rev and log freshness. */
function dateIssues(t, lastLog) {
	const out = [];
	for (const k of ['desde', 'hasta'])
		if (t[k] && Number.isNaN(Date.parse(t[k]))) out.push(`${k} no es fecha`);
	if (!Number.isInteger(t.rev) || t.rev < 1) out.push('rev debe ser un entero desde 1');
	if (Number.isNaN(Date.parse(t.actualizado ?? ''))) out.push('actualizado no es fecha');
	const last = lastLog[t.id];
	if (last && Date.parse(last) > Date.parse(t.actualizado ?? 0) + 60_000)
		out.push(`bitácora de ${last} más nueva que actualizado: suba rev`);
	return out;
}

function boardIssues(tareas, bitacora, decisiones) {
	const byId = Object.fromEntries(tareas.map((t) => [t.id, t]));
	const lastLog = lastLogByTask(bitacora);
	const inconsistencias = [];
	const avisos = [];
	for (const t of tareas) {
		const msgs = closingIssues(t);
		if (!isClosed(t))
			msgs.push(...shapeIssues(t), ...dateIssues(t, lastLog), ...depIssues(t, byId));
		for (const msg of msgs) inconsistencias.push({ id: t.id, msg });
		if (t.rama && t.id !== taskIdFromBranch(t.rama))
			avisos.push({
				id: t.id,
				msg: `id distinto de la rama sin prefijo (${taskIdFromBranch(t.rama)})`,
			});
	}
	const decIds = new Set(decisiones.map((d) => d.id));
	for (const d of decisiones) {
		if (typeof d.vigente !== 'boolean')
			avisos.push({ id: d.id, msg: 'decisión sin vigente: true|false' });
		if (d.reemplaza && !decIds.has(d.reemplaza))
			inconsistencias.push({
				id: d.id,
				msg: `reemplaza a una decisión inexistente: ${d.reemplaza}`,
			});
	}
	return { inconsistencias, avisos };
}

export function verifyBoard(
	{ tareas, bitacora = [], decisiones = [], sesiones = null },
	run = defaultRunner(),
) {
	const live = tareas
		.filter((t) => t.estado !== 'comprobada' && t.estado !== 'cancelada')
		.sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
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
		...unclaimedWork(tareas, run),
		sesionArchivada: archivedSessions(tareas, sesiones),
		...boardIssues(tareas, bitacora, decisiones),
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
	section('AVISOS', r.avisos, (x) => `${x.id.padEnd(32)} ${x.msg}`);
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
	const dir = argv.find((a) => !a.startsWith('--'));
	if (!dir) {
		console.error(
			'Uso: pnpm board:verify <dir con tareas/*.json> [--json] [--sesiones=<archivo.json>]',
		);
		process.exit(2);
	}
	// pnpm runs scripts from the repository root; INIT_CWD keeps relative paths relative to the caller.
	const cwd = process.env.INIT_CWD || process.cwd();
	const result = verifyBoard(
		loadExport(resolve(cwd, dir), sesionesArg && resolve(cwd, sesionesArg)),
	);
	if (json) console.log(JSON.stringify(result, null, 2));
	else printText(result);
	if (result.inconsistencias.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	main(process.argv.slice(2));
