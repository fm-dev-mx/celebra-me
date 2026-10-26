#!/usr/bin/env node
/**
 * `pnpm board:sync` — no-AI sync of the board with Git and GitHub. It reads the lanes (`git worktree list`), the
 * local and origin branches and the recent pull requests (`gh pr list --state all`), matches each open task to its
 * PR and writes only through `pnpm board set` (same lock, rev and shape checks as any agent):
 *
 *   - an open PR records `pr` (and `rama` when missing); a pending/in-progress task moves to «en revision»;
 *   - a merged PR moves the task to «unida»; a locked task goes through `pnpm board merged`, which also drops
 *     the lock (d170), and so does a finished task that still holds one;
 *   - a PR closed without merge, a locked task with an open PR or a branch without PR is only reported;
 *   - a lock older than --horas (default 6, or CELEBRA_BOARD_LOCK_HOURS) whose `rama` got no commit on origin
 *     since the lock was taken is flagged «posible sesión cerrada». Only a merged PR releases a lock.
 *
 * Then the hygiene (d268), on the board as those writes left it: an unlocked unida/hecha task whose check passes
 * moves to comprobada with that evidencia, `compact --antes=2d` and `prune-backups --aplicar` run, and each free,
 * clean lane f05–f12 (no lock or open task holds it, detached or on a branch whose PR merged) is detached at
 * origin/develop; the branch it left is then deleted with `git branch -d` when origin/develop already contains it.
 * A lane with changes, or on a branch without a merged PR, is only reported. The sync never archives
 * a task (d278): only the owner does, from «Finalizadas» or `pnpm board archive`.
 *
 *   node scripts/board/sync.mjs [--dry-run] [--json] [--horas=<n>]   --dry-run prints the plan and writes nothing
 *
 * Remote branches are read after `git fetch --prune origin`, so a branch deleted on GitHub no longer counts.
 *
 * Matching: the task's `pr`, else its `rama` as PR head, else the id convention (`fix/<id>`), else the one open PR
 * that names it canonically (d159: «T<n> <id>» in its title, or a «Board task: T<n> <id>» body line).
 * Closed tasks and cross-review children are never touched. The local view runs it from its «Sincronizar» button.
 */
import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORKTREE_LANES } from '../shared/worktree-lane.ts';
import { run as board } from './board.mjs';
import {
	isFinished,
	isReview,
	isStaleLock,
	normalizePr,
	STALE_LOCK_HOURS,
	taskIdFromBranch,
	taskLabel as label,
} from './model.mjs';
import { boardDir, loadBoard, withLock } from './store.mjs';
import { checkTask, defaultRunner } from './verify-board.mjs';

const TO_REVIEW = new Set(['pendiente', 'en curso', 'bloqueada']);
const PR_LIMIT = 200;
export { STALE_LOCK_HOURS };
const HOUR_MS = 3_600_000;
/** The task lanes the sync may realign; Integration is never touched. */
const FREE_LANES = new Set(WORKTREE_LANES.map((l) => l.segment).filter(Boolean));
const HYGIENE = 'pnpm board:sync';

const sh = (cmd, args, cwd) =>
	execFileSync(cmd, args, {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true,
	});

/** `git worktree list --porcelain` → [{lane, path, rama, head}] (rama is null when detached). */
export function parseWorktrees(text) {
	return String(text)
		.split(/\r?\n\r?\n/)
		.map((block) => {
			const path = block.match(/^worktree (.+)$/m)?.[1];
			const ref = block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? null;
			const head = block.match(/^HEAD (\S+)$/m)?.[1] ?? null;
			return path
				? { lane: basename(path.trim()), path: path.trim(), rama: ref, head }
				: null;
		})
		.filter(Boolean);
}

/** Everything the plan needs from Git and GitHub; read-only. */
export function readSources(cwd = process.cwd()) {
	const refs = (prefix) =>
		sh('git', ['for-each-ref', '--format=%(refname:short)', prefix], cwd)
			.split(/\r?\n/)
			.filter(Boolean);
	let fetchError = null;
	try {
		sh('git', ['fetch', '--prune', '--quiet', 'origin'], cwd);
	} catch (e) {
		fetchError = String(e.stderr ?? e.message).trim();
	}
	// Tip commit date of each origin branch: the evidence that a locked task's session is still pushing.
	const remoteDates = Object.fromEntries(
		sh(
			'git',
			[
				'for-each-ref',
				'--format=%(refname:short)%09%(committerdate:iso-strict)',
				'refs/remotes/origin',
			],
			cwd,
		)
			.split(/\r?\n/)
			.filter(Boolean)
			.map((line) => {
				const [ref, date] = line.split('\t');
				return [ref.replace(/^origin\//, ''), date];
			})
			.filter(([ref]) => ref !== 'HEAD' && ref !== 'origin'),
	);
	let prs;
	try {
		prs = JSON.parse(
			sh(
				'gh',
				[
					'pr',
					'list',
					'--state',
					'all',
					'--limit',
					String(PR_LIMIT),
					'--json',
					'number,state,isDraft,headRefName,title,body',
				],
				cwd,
			),
		);
	} catch (e) {
		throw new Error(
			`gh pr list falló; compruebe «gh auth status»: ${String(e.stderr ?? e.message).trim()}`,
			{ cause: e },
		);
	}
	// A task lane counts as clean only when `git status` answers and lists nothing (untracked files included).
	const clean = (path) => {
		try {
			return sh('git', ['status', '--porcelain'], path).trim() === '';
		} catch {
			return null;
		}
	};
	// Without origin/develop no lane is realigned.
	let develop;
	try {
		develop = sh('git', ['rev-parse', 'refs/remotes/origin/develop'], cwd).trim();
	} catch {
		develop = null;
	}
	return {
		worktrees: parseWorktrees(sh('git', ['worktree', 'list', '--porcelain'], cwd)).map((w) =>
			FREE_LANES.has(w.lane) ? { ...w, limpio: clean(w.path) } : w,
		),
		develop,
		local: refs('refs/heads'),
		remote: Object.keys(remoteDates),
		remoteDates,
		fetchError,
		prs,
	};
}

/** The newest PR of a branch, an open one first. */
function newestFor(prs, test) {
	const found = prs.filter(test);
	return (
		found
			.filter((p) => p.state === 'OPEN')
			.sort((a, b) => b.number - a.number)
			.concat(
				found.filter((p) => p.state !== 'OPEN').sort((a, b) => b.number - a.number),
			)[0] ?? null
	);
}

const escapeRe = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * d159: a PR names a task canonically with «T<n> <id>» in its title, or with a «Board task: T<n> <id>» body line.
 * Any other mention in the body, such as a prerequisite or a follow-up list, does not count.
 */
export function namesTask(p, t) {
	if (!t.num || !t.id) return false;
	const ref = `T${t.num} ${escapeRe(t.id)}(?![\\w-])`;
	if (new RegExp(`(?<![\\w-])${ref}`).test(p.title ?? '')) return true;
	return new RegExp(`^\\s*(?:[-*]\\s+)?Board task:\\s*${ref}`, 'im').test(p.body ?? '');
}

/** The only open PR that names the task (d159); none when two do. */
function byReference(prs, t) {
	const found = prs.filter((p) => p.state === 'OPEN' && namesTask(p, t));
	return found.length === 1 ? found[0] : null;
}

export function matchPr(t, prs) {
	const own = normalizePr(t.pr);
	if (typeof own === 'string' && own.startsWith('#'))
		return prs.find((p) => `#${p.number}` === own) ?? null;
	// d268: a periodic task's earlier cycles keep their PRs (`prsPrevios`), and it never matches by id, so a
	// merged PR of a past cycle cannot finish the next one.
	const past = new Set(Array.isArray(t.prsPrevios) ? t.prsPrevios : []);
	const live = prs.filter((p) => !past.has(`#${p.number}`));
	// A declared branch is the match: a PR whose title names the task from another head is only reported
	// (branchNote), since anyone can write that title.
	if (t.rama) return newestFor(live, (p) => p.headRefName === t.rama);
	if (t.cada) return null;
	return newestFor(live, (p) => taskIdFromBranch(p.headRefName) === t.id) ?? byReference(live, t);
}

function branchNote(t, src) {
	const named = byReference(src.prs, t);
	if (named)
		return `rama ${t.rama} sin PR, pero el PR #${named.number} (rama ${named.headRefName}) nombra la tarea: corrija rama o pr`;
	const wt = src.worktrees.find((w) => w.rama === t.rama);
	if (wt) return `rama ${t.rama} en el carril ${wt.lane}, sin PR`;
	if (src.remote.includes(t.rama)) return `rama ${t.rama} en origin, sin PR`;
	if (src.local.includes(t.rama)) return `rama ${t.rama} solo local, sin PR`;
	return `rama ${t.rama} no existe`;
}

/**
 * Locks older than `hours` with no commit on origin since they were taken: «posible sesión cerrada». Only a
 * flag: the owning session, or the coordinator with authority, releases a lock.
 */
export function staleLocks(board, src, { now = Date.now(), hours = STALE_LOCK_HOURS } = {}) {
	const out = [];
	for (const t of (board.tareas ?? []).slice().sort((a, b) => (a.num ?? 0) - (b.num ?? 0))) {
		const since = Date.parse(t.candado?.desde ?? '');
		if (Number.isNaN(since) || !isStaleLock(t.candado, now, hours)) continue;
		const rama = t.candado.rama ?? t.rama;
		const tip = Date.parse(src.remoteDates?.[rama] ?? '');
		if (!Number.isNaN(tip) && tip > since) continue;
		const why = !rama
			? 'sin rama'
			: Number.isNaN(tip)
				? `rama ${rama} no está en origin`
				: `sin commits nuevos en origin/${rama}`;
		out.push({
			id: t.id,
			desde: t.candado.desde,
			texto: `${label(t)}: posible sesión cerrada — candado de ${t.candado.agente} desde hace ${Math.floor((now - since) / HOUR_MS)} h, ${why}`,
		});
	}
	return out;
}

/** The write a task's PR calls for (`set` may be empty), or `{ aviso }` for a PR closed without merge. */
function prChange(t, p) {
	const pr = `#${p.number}`;
	if (p.state === 'CLOSED') return { aviso: `${label(t)}: PR ${pr} cerrado sin unir` };
	const set = {};
	if (normalizePr(t.pr) !== pr) set.pr = pr;
	if (!t.rama && p.headRefName) set.rama = p.headRefName;
	let texto = `${label(t)} → PR ${pr} abierto`;
	if (p.state === 'MERGED') {
		set.estado = 'unida';
		texto = `${label(t)} → PR ${pr} unido: pasa a unida`;
	} else if (p.isDraft) texto = `${label(t)} → PR ${pr} en borrador`;
	else if (TO_REVIEW.has(t.estado ?? 'pendiente')) {
		set.estado = 'en revision';
		texto = `${label(t)} → PR ${pr} abierto: pasa a en revision`;
	}
	if (set.rama) texto += ` · rama ${set.rama}`;
	return { id: t.id, rev: t.rev, set, texto, salio: `PR ${pr} ${p.state}` };
}

/**
 * Pure plan: `cambios` are writes (`set` holds the fields), `avisos` are facts the sync never writes,
 * `omitidas` are changes a lock keeps for its owning session and `candadosViejos` are flagged stale locks.
 */
export function plan(board, src, opts = {}) {
	const cambios = [];
	const avisos = src.fetchError
		? [{ id: '', texto: `git fetch falló; las ramas pueden estar viejas: ${src.fetchError}` }]
		: [];
	const omitidas = [];
	for (const t of (board.tareas ?? []).slice().sort((a, b) => (a.num ?? 0) - (b.num ?? 0))) {
		if (isReview(t)) continue;
		if (isFinished(t)) {
			// d170: a finished task whose PR merged must not keep its lock.
			const p = t.candado && t.estado !== 'cancelada' ? matchPr(t, src.prs) : null;
			if (p?.state === 'MERGED')
				cambios.push(mergedRelease(t, p, `${label(t)} → PR #${p.number} unido`));
			continue;
		}
		const p = matchPr(t, src.prs);
		if (!p) {
			if (t.pr) avisos.push({ id: t.id, texto: `${label(t)}: ${t.pr} no aparece en GitHub` });
			else if (t.rama) avisos.push({ id: t.id, texto: `${label(t)}: ${branchNote(t, src)}` });
			continue;
		}
		const change = prChange(t, p);
		if (change.aviso) {
			avisos.push({ id: t.id, texto: change.aviso });
			continue;
		}
		if (!Object.keys(change.set).length) continue;
		const { texto } = change;
		if (t.candado && p.state === 'MERGED') cambios.push(mergedRelease(t, p, texto));
		else if (t.candado)
			omitidas.push({
				...change,
				texto: `${texto} (tiene candado de ${t.candado.agente}: lo cambia su sesión)`,
			});
		else cambios.push(change);
	}
	const freed = new Set(cambios.filter((c) => c.cmd === 'merged').map((c) => c.id));
	const candadosViejos = staleLocks(board, src, opts).filter((c) => !freed.has(c.id));
	return { cambios, avisos, omitidas, candadosViejos };
}

/** A merged PR on a locked task: `pnpm board merged` moves it to unida and drops the lock (d170). */
function mergedRelease(t, p, texto) {
	return {
		id: t.id,
		rev: t.rev,
		cmd: 'merged',
		pr: `#${p.number}`,
		set: {},
		texto: `${texto} · suelta el candado de ${t.candado.agente} (d170)`,
		salio: `PR #${p.number} MERGED`,
	};
}

/**
 * Each change is one `pnpm board set` (or `merged`) pinned to the rev the plan read; a refused write is reported,
 * not retried. `prState` answers `merged` with the PR state the sync already listed.
 */
export async function apply(cambios, dir, { prState } = {}) {
	const out = [];
	for (const c of cambios) {
		const common = [`--rev=${c.rev}`, '--coordinador', '--corrio=pnpm board:sync'];
		const args =
			c.cmd === 'merged'
				? ['merged', c.id, ...common, `--pr=${c.pr}`]
				: [
						'set',
						c.id,
						...common,
						`--salio=${c.salio}`,
						...Object.entries(c.set).map(([k, v]) => `${k}=${v}`),
					];
		try {
			let said = '';
			await board(args, { dir, out: (s) => (said = s), prState });
			out.push({ ...c, ok: true, resultado: said });
		} catch (e) {
			out.push({ ...c, ok: false, resultado: e.message });
		}
	}
	return out;
}

const byNum = (board) => (board.tareas ?? []).slice().sort((a, b) => (a.num ?? 0) - (b.num ?? 0));

/**
 * d268: unlocked unida/hecha tasks whose check passes, with the evidencia `set` records. `run` answers a check
 * command; review rounds are never touched.
 */
export function toVerify(board, run) {
	const out = [];
	for (const t of byNum(board)) {
		if (t.archivada || t.candado || isReview(t) || !['unida', 'hecha'].includes(t.estado))
			continue;
		const r = checkTask(t, run, board);
		if (!r.ready) continue;
		out.push({
			id: t.id,
			rev: t.rev,
			set: {
				estado: 'comprobada',
				evidencia: JSON.stringify({ cmd: r.cmd, salio: r.salida }),
			},
			salio: r.salida,
			texto: `${label(t)} → cumple su chequeo: pasa a comprobada`,
		});
	}
	return out;
}

/**
 * d268: free, clean task lanes to detach at origin/develop. A lane is free when no lock and no open task holds
 * it, and it is detached or on a branch whose newest PR merged; `avisos` names free lanes left as they are.
 */
/** A lane is held by any lock on it, or by an open task's `carril`. */
const laneHeld = (tareas, lane) =>
	tareas.some((t) => t.candado?.carril === lane || (!isFinished(t) && t.carril === lane));

export function lanePlan(board, src) {
	const alinear = [];
	const avisos = [];
	const develop = src.develop;
	if (!develop) return { alinear, avisos };
	const tareas = board.tareas ?? [];
	for (const w of src.worktrees ?? []) {
		if (!FREE_LANES.has(w.lane) || (!w.rama && w.head === develop)) continue;
		if (laneHeld(tareas, w.lane)) continue;
		const where = w.rama ? `la rama ${w.rama}` : String(w.head).slice(0, 7);
		const aviso = (why) =>
			avisos.push({ id: '', texto: `carril ${w.lane} libre ${why}: no se alinea` });
		if (w.limpio !== true) {
			if (w.limpio === false) aviso(`con cambios sin confirmar en ${where}`);
			continue;
		}
		const p = w.rama ? newestFor(src.prs ?? [], (x) => x.headRefName === w.rama) : null;
		if (w.rama && p?.state !== 'MERGED') {
			aviso(`en ${where} sin PR unido`);
			continue;
		}
		alinear.push({
			lane: w.lane,
			path: w.path,
			rama: w.rama,
			head: w.head,
			texto: `carril ${w.lane} libre: de ${where} a origin/develop (${develop.slice(0, 7)})${w.rama ? `; borra la rama local ${w.rama} si ya está en origin/develop` : ''}`,
		});
	}
	return { alinear, avisos };
}

/** `gh pr view <n> --json state` answered from the PR list the sync already read; anything else runs. */
export function syncRunner(prs, fallback = defaultRunner()) {
	return (cmd) => {
		const n = /^gh pr view (\d+) --json state$/.exec(cmd)?.[1];
		const p = n && prs.find((x) => String(x.number) === n);
		return p
			? { ok: true, output: JSON.stringify({ state: p.state }), error: '' }
			: fallback(cmd);
	};
}

/** One hygiene write (`set` to comprobada) through `pnpm board`; a refused one is reported. */
async function applyOne(c, dir) {
	const args = [
		'set',
		c.id,
		`--rev=${c.rev}`,
		'--coordinador',
		`--corrio=${HYGIENE}`,
		`--salio=${c.salio}`,
		...Object.entries(c.set).map(([k, v]) => `${k}=${v}`),
	];
	try {
		let said = '';
		await board(args, { dir, out: (s) => (said = s) });
		return { ...c, ok: true, resultado: said };
	} catch (e) {
		return { ...c, ok: false, resultado: e.message };
	}
}

/** `compact --antes=2d` and `prune-backups --aplicar` (a dry run only lists), as their JSON results. */
async function storeUpkeep(dir, dryRun) {
	const json = async (args) => {
		let said = '';
		await board([...args, '--json'], { dir, out: (s) => (said = s) });
		return JSON.parse(said);
	};
	const compact = await json(['compact', '--antes=2d', ...(dryRun ? ['--dry-run'] : [])]);
	const prune = await json(['prune-backups', ...(dryRun ? [] : ['--aplicar'])]);
	return { resumidas: compact.tareas.map((x) => x.linea), respaldos: prune.sobran.length };
}

/**
 * Why a planned lane may no longer be switched, read again right before the switch: a lock or open task took it,
 * its branch or HEAD moved, or it has changes. Null when it is still the lane the plan saw.
 */
function laneDrift(l, board, git) {
	if (laneHeld(board.tareas ?? [], l.lane)) return `carril ${l.lane} tomado después del plan`;
	const out = (args) => String(git(args, l.path) ?? '').trim();
	if ((out(['branch', '--show-current']) || null) !== (l.rama ?? null))
		return `carril ${l.lane} cambió de rama desde el plan`;
	if (out(['rev-parse', 'HEAD']) !== l.head)
		return `carril ${l.lane} cambió de HEAD desde el plan`;
	if (out(['status', '--porcelain'])) return `carril ${l.lane} tiene cambios sin confirmar`;
	return null;
}

/**
 * d268: the local branch a lane just left, deleted with `git branch -d` only when origin/develop contains it. A
 * branch still checked out elsewhere, or not merged, stays and is reported; the switch itself already happened.
 */
function pruneBranch(l, develop, git) {
	if (!l.rama) return {};
	try {
		git(['merge-base', '--is-ancestor', `refs/heads/${l.rama}`, develop], l.path);
	} catch (e) {
		// Exit 1 is git's «not an ancestor»; anything else (a missing ref, a broken repo) says what failed.
		const why =
			e.status === 1
				? 'no está en origin/develop'
				: `no se comprobó: ${
						String(e.stderr ?? e.message)
							.trim()
							.split(/\r?\n/)[0]
					}`;
		return { podada: false, resultado: `rama ${l.rama} ${why}: se queda` };
	}
	try {
		git(['branch', '-d', '--quiet', '--', l.rama], l.path);
		return { podada: true };
	} catch (e) {
		const why = String(e.stderr ?? e.message)
			.trim()
			.split(/\r?\n/)[0];
		return { podada: false, resultado: `rama ${l.rama} no se borró: ${why}` };
	}
}

/**
 * Detach each planned lane at origin/develop. Each one is checked again and switched inside the board's store
 * lock, so a claim cannot take it in between; any drift fails closed and is reported, not retried.
 */
function alignLanes(alinear, develop, git, dir) {
	return alinear.map((l) => {
		try {
			const drift = withLock(dir, () => {
				const why = laneDrift(l, loadBoard(dir), git);
				if (!why) git(['switch', '--detach', '--quiet', develop], l.path);
				return why;
			});
			return drift
				? { ...l, ok: false, resultado: `${drift}: no se alinea` }
				: { ...l, ok: true, ...pruneBranch(l, develop, git) };
		} catch (e) {
			return { ...l, ok: false, resultado: String(e.stderr ?? e.message).trim() };
		}
	});
}

/** d268, narrowed by d278 (never archives): the hygiene after the PR writes; a dry run plans every step on the board as it is and writes nothing. */
export async function hygiene(
	dir,
	src,
	{ dryRun = false, runner, git = (args, cwd) => sh('git', args, cwd) } = {},
) {
	const run = syncRunner(src.prs ?? [], runner);
	const each = async (list) => {
		const out = [];
		for (const c of list) out.push(dryRun ? { ...c, ok: null } : await applyOne(c, dir));
		return out;
	};
	const comprobadas = await each(toVerify(loadBoard(dir), run));
	const almacen = await storeUpkeep(dir, dryRun);
	const lanes = lanePlan(loadBoard(dir), src);
	const carriles = dryRun
		? lanes.alinear.map((l) => ({ ...l, ok: null }))
		: alignLanes(lanes.alinear, src.develop, git, dir);
	return { comprobadas, almacen, carriles, avisosCarril: lanes.avisos };
}

export async function run({
	dryRun = false,
	dir = boardDir(),
	sources = readSources,
	now = new Date(),
	hours = lockHours(),
	runner,
	git,
} = {}) {
	const src = sources();
	const p = plan(loadBoard(dir), src, { now: now.getTime(), hours });
	const prState = (pr) => src.prs.find((x) => `#${x.number}` === pr)?.state ?? '';
	const cambios = dryRun
		? p.cambios.map((c) => ({ ...c, ok: null }))
		: await apply(p.cambios, dir, { prState });
	const higiene = await hygiene(dir, src, { dryRun, runner, git });
	return { prueba: dryRun, en: now.toISOString(), ...p, cambios, higiene };
}

/** Every write the run attempted, PR changes and hygiene alike: `ok: false` means it was refused. */
export const writes = (r) => [
	...r.cambios,
	...(r.higiene?.comprobadas ?? []),
	...(r.higiene?.carriles ?? []),
];

/** Human summary, one line per change, then avisos and locked tasks. */
export function summary(r) {
	const lines = [];
	const head = r.prueba ? '[prueba] ' : '';
	for (const c of r.cambios)
		lines.push(
			`${head}${c.ok === false ? `NO SE ESCRIBIÓ ${c.texto}: ${c.resultado}` : c.texto}`,
		);
	if (!r.cambios.length) lines.push(`${head}Sin cambios: el tablero ya coincide con GitHub.`);
	for (const o of r.omitidas) lines.push(`Omitida: ${o.texto}`);
	for (const a of r.avisos) lines.push(`Aviso: ${a.texto}`);
	for (const c of r.candadosViejos ?? []) lines.push(`Candado: ${c.texto}`);
	const h = r.higiene;
	if (!h) return lines;
	const item = (c) =>
		`${head}${c.ok === false ? `NO SE ESCRIBIÓ ${c.texto}: ${c.resultado}` : c.texto}`;
	for (const c of h.comprobadas) lines.push(`Higiene: ${item(c)}`);
	const { resumidas, respaldos } = h.almacen;
	if (resumidas.length)
		lines.push(
			`Higiene: ${head}${resumidas.length} archivadas ${r.prueba ? 'se resumirían' : 'resumidas'} (compact --antes=2d)`,
		);
	if (respaldos)
		lines.push(
			`Higiene: ${head}${respaldos} respaldos ${r.prueba ? 'sobran' : 'quitados'} (prune-backups)`,
		);
	for (const c of h.carriles)
		lines.push(`Carril: ${item(c)}${c.ok && c.podada === false ? ` (${c.resultado})` : ''}`);
	for (const a of h.avisosCarril) lines.push(`Aviso: ${a.texto}`);
	return lines;
}

/** Stale-lock threshold: --horas=<n>, else CELEBRA_BOARD_LOCK_HOURS, else 6. */
export function lockHours(argv = process.argv, env = process.env) {
	const raw =
		argv.find((a) => a.startsWith('--horas='))?.slice(8) ?? env.CELEBRA_BOARD_LOCK_HOURS;
	const n = Number(raw);
	return raw !== undefined && raw !== '' && Number.isFinite(n) && n > 0 ? n : STALE_LOCK_HOURS;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const json = process.argv.includes('--json');
	run({ dryRun: process.argv.includes('--dry-run') })
		.then((r) => {
			console.log(json ? JSON.stringify(r, null, 2) : summary(r).join('\n'));
			if (writes(r).some((c) => c.ok === false)) process.exitCode = 1;
		})
		.catch((e) => {
			console.error(`board:sync: ${e.message}`);
			process.exitCode = 2;
		});
}
