/**
 * T297 (U-03): `claim`, `close` and `release` run from the task's lane also check that lane and drive its
 * git-safety session, so a code task no longer starts and ends that session by hand
 * (docs/core/git-safety-session.md). Run from Integration (the coordinator) or from an unknown folder they check
 * nothing. A test board (CELEBRA_BOARD_DIR) inspects no checkout unless CELEBRA_BOARD_CHECKOUT names one.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baselineFileName } from '../agent/git-safety.mjs';
import { detectWorktreeLane, findRepoRoot, gitInspectionEnv } from '../shared/worktree-lane.ts';
import { UsageError } from './cli.mjs';
import { READONLY_LANE, isReadOnly } from './model.mjs';

const GIT_SAFETY = join(dirname(fileURLToPath(import.meta.url)), '..', 'agent', 'git-safety.mjs');
/** What `close`/`release --git-safety=…` may declare to finish; a branch switch is finished by hand. */
const FINISH_OPS = ['commit', 'history'];

function git(cwd, args) {
	const r = spawnSync('git', args, { cwd, env: gitInspectionEnv(), encoding: 'utf8' });
	return r.status === 0 ? String(r.stdout).trim() : null;
}

/**
 * The checkout `pnpm board` runs in: `{ carril, rama, raiz }` (`rama` null when detached), or null when there is
 * none to check (a test board, or a folder outside Git).
 */
export function checkoutState(env = process.env, cwd = process.cwd()) {
	const given = env.CELEBRA_BOARD_CHECKOUT;
	if (env.CELEBRA_BOARD_DIR && !given) return null;
	const raiz = git(given ? resolve(cwd, given) : cwd, ['rev-parse', '--show-toplevel']);
	if (!raiz) return null;
	const carril = detectWorktreeLane(raiz, findRepoRoot(raiz)).id;
	return { carril, rama: git(raiz, ['symbolic-ref', '--quiet', '--short', 'HEAD']), raiz };
}

/** Only a canonical task lane (f05–f12) is checked: Integration and unknown folders are not task lanes. */
const inTaskLane = (state) =>
	Boolean(state) && state.carril !== READONLY_LANE && state.carril !== 'unknown';

/**
 * Why `claim` must not take `task` from this checkout, or null: the folder is another lane, or its branch is not
 * the task's. Read-only tasks hold no lane, so they are never checked.
 */
export function claimLaneIssue(state, task, { carril, rama }) {
	if (!inTaskLane(state) || isReadOnly(task)) return null;
	if (carril && state.carril !== carril)
		return `esta carpeta es ${state.carril}, pero ${task.id} corre en ${carril}: haga claim desde celebra-me-worktrees/${carril}`;
	if (rama && state.rama !== rama)
		return `${state.carril} está en ${state.rama ?? 'HEAD separado'}, no en ${rama}: primero git switch -c ${rama} origin/develop (o git switch ${rama})`;
	return null;
}

/** Why `close`/`release` must not run from this checkout for a task locked in another lane, or null. */
export function lockLaneIssue(state, task) {
	const carril = task.candado?.carril;
	if (!inTaskLane(state) || !carril || state.carril === carril) return null;
	return `esta carpeta es ${state.carril}, pero el candado de ${task.id} está en ${carril}`;
}

/** True when this checkout holds an open git-safety session named after `rama`. */
export function gitSafetyOpen(state, rama) {
	if (!state || !rama) return false;
	try {
		return existsSync(join(state.raiz, '.agent', 'tmp', baselineFileName(rama)));
	} catch {
		// A branch git-safety cannot name a session after has no session; `start` then says why.
		return false;
	}
}

function runGitSafety(state, args, spawn) {
	const r = spawn(process.execPath, [GIT_SAFETY, ...args], {
		cwd: state.raiz,
		env: { ...process.env, CELEBRA_GIT_SAFETY_ROOT: state.raiz },
		encoding: 'utf8',
	});
	const text = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
	const why = text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l && !/^(agent:git-safety|FAILED)/.test(l))
		.at(-1);
	return { ok: r.status === 0, why: why ?? `salió con ${r.status}` };
}

/**
 * After a claim from the task's lane: opens the git-safety session `--session=<rama>` unless one is already open.
 * Returns the line the claim prints (`ok: false` when it could not open), or null when there is nothing to do.
 */
export function startGitSafety(state, task, rama, { spawn = spawnSync } = {}) {
	if (!inTaskLane(state) || isReadOnly(task) || !rama) return null;
	const finish = `pnpm agent:git-safety:finish --session=${rama}`;
	if (gitSafetyOpen(state, rama))
		return { ok: true, line: `git-safety: la sesión ${rama} ya estaba abierta` };
	const r = runGitSafety(state, ['start', `--session=${rama}`], spawn);
	return r.ok
		? {
				ok: true,
				line: `git-safety: sesión ${rama} abierta; se cierra con close --git-safety=commit o ${finish}`,
			}
		: {
				ok: false,
				line: `git-safety: no se abrió la sesión ${rama} (el tablero sí se guardó): ${r.why}`,
			};
}

/** `--git-safety=commit[,history]` → the operations to declare; refuses anything else. */
export function finishOps(value) {
	if (value === undefined) return null;
	const ops = String(value === true ? '' : value)
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	if (!ops.length || ops.some((op) => !FINISH_OPS.includes(op)))
		throw new UsageError(
			`--git-safety debe ser ${FINISH_OPS.join('|')} (o ambas con coma); un cambio de rama se cierra a mano con pnpm agent:git-safety:finish`,
		);
	return ops;
}

/**
 * After a close or release from the task's lane: with `ops` it finishes the session `--session=<rama>` declaring
 * them; without, it reminds that the session is still open. Returns the line to print, or null.
 */
export function finishGitSafety(state, rama, ops, { spawn = spawnSync } = {}) {
	if (!inTaskLane(state) || !rama) return null;
	const open = gitSafetyOpen(state, rama);
	if (!ops)
		return open
			? {
					ok: true,
					line: `git-safety: la sesión ${rama} sigue abierta; ciérrela con --git-safety=commit o pnpm agent:git-safety:finish --session=${rama}`,
				}
			: null;
	if (!open)
		return { ok: false, line: `git-safety: no hay sesión ${rama} abierta en ${state.carril}` };
	const r = runGitSafety(
		state,
		['finish', `--session=${rama}`, `--authorized-operation=${ops.join(',')}`],
		spawn,
	);
	return r.ok
		? { ok: true, line: `git-safety: sesión ${rama} cerrada (${ops.join(',')})` }
		: {
				ok: false,
				line: `git-safety: la sesión ${rama} no cerró (el tablero sí se guardó; no repita el comando): ${r.why}`,
			};
}
