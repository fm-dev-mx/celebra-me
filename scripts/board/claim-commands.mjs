/**
 * `pnpm board claim` (rules: .agent/rules/board.md): takes a task's lock, its lane and branch, and (T297) from the
 * task's lane checks that lane and opens its git-safety session. board.mjs passes the task helpers it owns.
 */
import { WORKTREE_LANES } from '../shared/worktree-lane.ts';
import { UsageError, say } from './cli.mjs';
import { undelivered } from './delivery.mjs';
import { checkoutState, claimLaneIssue, lockLaneIssue, startGitSafety } from './lane-session.mjs';
import {
	EXTERNAL_LANE,
	READONLY_LANE,
	claimable,
	isReadOnly,
	isReview,
	laneAllowed as laneAllowedIn,
	lockSessionIssue,
	sessionOf,
} from './model.mjs';
import { claimTitleIssue } from './next.mjs';
import { loadBoard, withLock } from './store.mjs';

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const need = (v, msg) => {
	if (!v || v === true) throw new UsageError(msg);
	return v;
};

const laneAllowed = (carril, task) => laneAllowedIn(carril, task, WORKTREE_LANES);

/** Read-only tasks always run in READONLY_LANE, so they never take a lane of their own. */
export const readOnlyLaneError = (task, what) =>
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
	if (
		carril &&
		carril !== EXTERNAL_LANE &&
		board.tareas.some((t) => t.id !== before.id && t.candado?.carril === carril)
	)
		throw new UsageError(`el carril ${carril} tiene otra tarea con candado`);
	return { rama, carril };
}

/**
 * T297: `say` plus the git-safety line of a claim or release run from the task's lane; a session that could not
 * open or close makes the command exit 1, though the board write stands.
 */
export function sayClaim(flags, out, t, text, gitSafety) {
	if (gitSafety && !gitSafety.ok) process.exitCode = 1;
	const data = gitSafety ? { ...t, gitSafety } : t;
	say(flags, out, data, gitSafety ? `${text}\n${gitSafety.line}` : text);
}

/** Why `agente` may not take `before` at all: another lock, another agent, not ready or an owner gate. */
function claimRefusal(before, { agente, sesion, flags }, board) {
	const lock = before.candado;
	if (lock && (lock.agente !== agente || lock.sesion !== sesion))
		return `${before.id} ya la tiene ${lock.agente} desde ${lock.desde}`;
	if (lock) return null;
	if (before.agente && before.agente !== 'cualquiera' && before.agente !== agente)
		return `${before.id} es de ${before.agente}: pídale al coordinador un «move»`;
	if (!claimable(before, agente, board) || (before.actor === 'coordinador' && !flags.coordinador))
		return `${before.id} no está lista para ${agente} o requiere acción del dueño`;
	return null;
}

/** The new lock, lane, branch and estado a claim writes. */
function claimed(before, { agente, sesion, flags }, { rama, carril }) {
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
	return {
		// d249: a claim ends the wait the delivery mark announced.
		...undelivered(before),
		candado,
		...(carril ? { carril } : {}),
		...(rama ? { rama } : {}),
		...(started ? { estado: 'en curso' } : {}),
	};
}

export function claimCommands({ getTask, saveTask }) {
	return {
		claim({ pos, flags }, dir, out) {
			const agente = need(flags.agente, 'falta --agente');
			const sesion = sessionOf(agente, flags.sesion, process.env);
			const issue = lockSessionIssue(agente, sesion);
			if (issue) throw new UsageError(issue);
			const who = { agente, sesion, flags };
			const checkout = checkoutState();
			return withLock(dir, () => {
				const before = getTask(dir, need(pos[0], 'falta <id>'));
				const board = loadBoard(dir);
				const refusal = claimRefusal(before, who, board);
				if (refusal) throw new UsageError(refusal);
				// T297: a repeated claim from the lane reopens a git-safety session closed in between.
				if (before.candado) {
					const heldIssue = lockLaneIssue(checkout, before);
					if (heldIssue) throw new UsageError(heldIssue);
					const gitSafety = startGitSafety(checkout, before, before.candado.rama);
					return sayClaim(
						flags,
						out,
						before,
						`${before.id} ya pertenece a esta sesión`,
						gitSafety,
					);
				}
				const location = claimLocation(before, flags, board);
				const laneIssue = claimLaneIssue(checkout, before, location);
				if (laneIssue) throw new UsageError(laneIssue);
				const titleIssue = claimTitleIssue(before, flags.titulo, location.carril);
				if (titleIssue) throw new UsageError(titleIssue);
				const t = saveTask(dir, before, claimed(before, who, location), {
					quien: flags.quien,
					agente,
					corrio: 'pnpm board claim',
				});
				const gitSafety = startGitSafety(checkout, t, location.rama);
				sayClaim(flags, out, t, `${t.id} es de ${agente} (rev ${t.rev})`, gitSafety);
			});
		},
	};
}
