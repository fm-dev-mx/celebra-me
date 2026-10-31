/**
 * T382: `plan` only puts a task in a lane whose folder is ready for it. The Git state comes from live.mjs
 * (readLanes); CELEBRA_BOARD_LIVE_FIXTURE replaces it in hermetic tests, as it does for readLive.
 */
import { readFileSync } from 'node:fs';
import { WORKTREE_LANES } from '../shared/worktree-lane.ts';
import { readOnlyLaneError } from './claim-commands.mjs';
import { UsageError } from './cli.mjs';
import { readLanes } from './live.mjs';
import { EXTERNAL_LANE, isReadOnly, laneAllowed as laneAllowedIn, laneHolder } from './model.mjs';

const laneAllowed = (carril, task) => laneAllowedIn(carril, task, WORKTREE_LANES);

/** d177: only a declared coordinator plans a lane, and only a canonical one. */
export function assertPlan(task, carril, flags) {
	if (!flags.coordinador)
		throw new UsageError('el carril planeado lo asigna el coordinador: use --coordinador');
	if (isReadOnly(task)) throw new UsageError(readOnlyLaneError(task, 'carril planeado'));
	if (!laneAllowed(carril, task))
		throw new UsageError(
			`carril ${carril} no es canónico (f05-f12; integration solo para coordinador)`,
		);
}

/** Each lane's `{id, rama, limpio}` or `{id, error}`. */
export async function readLaneGit(dir) {
	const fixture = process.env.CELEBRA_BOARD_LIVE_FIXTURE;
	if (fixture) return JSON.parse(readFileSync(fixture, 'utf8')).carriles ?? [];
	return readLanes(dir);
}

/**
 * Throws unless `carril` is idle (detached and clean), Integration on a clean develop, or already on the
 * task's branch. An unreadable lane never blocks. The refusal names the idle, unlocked lanes `t` may use.
 */
export function assertLaneReady(carril, t, git, board) {
	if (carril === EXTERNAL_LANE) return;
	const idle = (g) => !g.error && g.rama === null && g.limpio;
	const own = git.find((g) => g.id === carril);
	if (!own || own.error || idle(own)) return;
	if (carril === 'integration' && own.rama === 'develop' && own.limpio) return;
	if (t.rama && own.rama === t.rama) return;
	const free = git
		.filter(
			(g) =>
				g.id !== carril &&
				idle(g) &&
				laneAllowed(g.id, t) &&
				!laneHolder(g.id, board, t.id),
		)
		.map((g) => g.id);
	throw new UsageError(
		`${carril} está en ${own.rama ? `la rama ${own.rama}` : 'HEAD separado'}${own.limpio ? '' : ' con cambios sin commit'}; carriles libres: ${free.join(', ') || 'ninguno'}`,
	);
}
