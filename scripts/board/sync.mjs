#!/usr/bin/env node
/**
 * `pnpm board:sync` — no-AI sync of the board with Git and GitHub. It reads the lanes (`git worktree list`), the
 * local and origin branches and the recent pull requests (`gh pr list --state all`), matches each open task to its
 * PR and writes only through `pnpm board set` (same lock, rev and shape checks as any agent):
 *
 *   - an open PR records `pr` (and `rama` when missing); a pending/in-progress task moves to «en revision»;
 *   - a merged PR moves the task to «unida»;
 *   - a PR closed without merge, a locked task or a branch without PR is only reported;
 *   - a lock older than --horas (default 6, or CELEBRA_BOARD_LOCK_HOURS) whose `rama` got no commit on origin
 *     since the lock was taken is flagged «posible sesión cerrada». The lock itself is never released.
 *
 *   node scripts/board/sync.mjs [--dry-run] [--json] [--horas=<n>]   --dry-run prints the plan and writes nothing
 *
 * Remote branches are read after `git fetch --prune origin`, so a branch deleted on GitHub no longer counts.
 *
 * Matching: the task's `pr`, else its `rama` as PR head, else the id convention (`fix/<id>`). Closed tasks and
 * cross-review children are never touched. The local view runs it from its «Sincronizar» button.
 */
import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as board } from './board.mjs';
import { normalizePr } from './model.mjs';
import { boardDir, loadBoard } from './store.mjs';

const CLOSED = new Set(['hecha', 'unida', 'comprobada', 'cancelada']);
const TO_REVIEW = new Set(['pendiente', 'en curso', 'bloqueada']);
const PR_LIMIT = 200;
export const STALE_LOCK_HOURS = 6;
const HOUR_MS = 3_600_000;

const label = (t) => (Number.isInteger(t.num) ? `T${t.num} ${t.id}` : t.id);
const isReview = (t) => !!t.revisionSha || (!!t.origen && t.id === `${t.origen}-revision`);
const sh = (cmd, args, cwd) =>
	execFileSync(cmd, args, {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true,
	});

/** `git worktree list --porcelain` → [{lane, path, rama}] (rama is null when detached). */
export function parseWorktrees(text) {
	return String(text)
		.split(/\r?\n\r?\n/)
		.map((block) => {
			const path = block.match(/^worktree (.+)$/m)?.[1];
			const ref = block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? null;
			return path ? { lane: basename(path.trim()), path: path.trim(), rama: ref } : null;
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
					'number,state,isDraft,headRefName,title',
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
	return {
		worktrees: parseWorktrees(sh('git', ['worktree', 'list', '--porcelain'], cwd)),
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

export function matchPr(t, prs) {
	const own = normalizePr(t.pr);
	if (typeof own === 'string' && own.startsWith('#'))
		return prs.find((p) => `#${p.number}` === own) ?? null;
	if (t.rama) return newestFor(prs, (p) => p.headRefName === t.rama);
	return newestFor(prs, (p) => p.headRefName.replace(/^[^/]+\//, '') === t.id);
}

function branchNote(t, src) {
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
		if (Number.isNaN(since) || now - since < hours * HOUR_MS) continue;
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
		if (CLOSED.has(t.estado ?? 'pendiente') || isReview(t)) continue;
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
		if (t.candado)
			omitidas.push({
				...change,
				texto: `${texto} (tiene candado de ${t.candado.agente}: lo cambia su sesión)`,
			});
		else cambios.push(change);
	}
	return { cambios, avisos, omitidas, candadosViejos: staleLocks(board, src, opts) };
}

/** Each change is one `pnpm board set` pinned to the rev the plan read; a refused write is reported, not retried. */
export async function apply(cambios, dir) {
	const out = [];
	for (const c of cambios) {
		const args = [
			'set',
			c.id,
			`--rev=${c.rev}`,
			'--coordinador',
			'--quien=board:sync',
			'--corrio=pnpm board:sync',
			`--salio=${c.salio}`,
			...Object.entries(c.set).map(([k, v]) => `${k}=${v}`),
		];
		try {
			let said = '';
			await board(args, { dir, out: (s) => (said = s) });
			out.push({ ...c, ok: true, resultado: said });
		} catch (e) {
			out.push({ ...c, ok: false, resultado: e.message });
		}
	}
	return out;
}

export async function run({
	dryRun = false,
	dir = boardDir(),
	sources = readSources,
	now = new Date(),
	hours = lockHours(),
} = {}) {
	const p = plan(loadBoard(dir), sources(), { now: now.getTime(), hours });
	const cambios = dryRun
		? p.cambios.map((c) => ({ ...c, ok: null }))
		: await apply(p.cambios, dir);
	return { prueba: dryRun, en: now.toISOString(), ...p, cambios };
}

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
			if (r.cambios.some((c) => c.ok === false)) process.exitCode = 1;
		})
		.catch((e) => {
			console.error(`board:sync: ${e.message}`);
			process.exitCode = 2;
		});
}
