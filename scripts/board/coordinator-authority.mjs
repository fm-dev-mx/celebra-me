/**
 * T478: `--coordinador` is a privilege, not a label. Every command that passes it names its real writer with
 * `--quien`, and only the Claude coordinator or the owner may use it; a Codex or Gemini master may only plan
 * the lane of its own agent's tasks. The bitácora and the trace then record that writer, never «coordinador».
 */
import { UsageError } from './cli.mjs';
import { quienOf } from './model.mjs';

/** Writers that hold the coordinator privilege on every command. */
export const COORDINATOR_WRITERS = ['claude', 'dueno'];
/** Masters that may use `plan --coordinador` on their own agent's tasks only. */
export const LANE_PLANNERS = ['codex', 'gemini'];

/** Why `cmd` with these flags may not use `--coordinador`, or null; `task` is the planned task (plan only). */
export function coordinatorIssue(cmd, flags, task) {
	if (!flags.coordinador) return null;
	const quien =
		typeof flags.quien === 'string' && flags.quien
			? quienOf({ quien: flags.quien })
			: undefined;
	if (!quien)
		return `--coordinador requiere --quien=${COORDINATOR_WRITERS.join('|')} con el actor real (T478)`;
	if (COORDINATOR_WRITERS.includes(quien)) return null;
	if (LANE_PLANNERS.includes(quien) && cmd === 'plan') {
		if (task?.agente === quien) return null;
		return `${quien} solo planea el carril de tareas de ${quien}; ${task?.id ?? 'esta tarea'} es de ${task?.agente ?? 'ningún agente'}`;
	}
	return `--coordinador solo lo usan el coordinador de Claude o el dueño (--quien=${COORDINATOR_WRITERS.join('|')}), no ${quien}${LANE_PLANNERS.includes(quien) ? `; ${quien} solo planea el carril de sus propias tareas` : ''}`;
}

/** Throws the refusal of `coordinatorIssue`; `loadTask` reads the task only when a master plans. */
export function assertCoordinator(cmd, flags, loadTask) {
	const quien = typeof flags.quien === 'string' ? quienOf({ quien: flags.quien }) : undefined;
	const task =
		flags.coordinador && cmd === 'plan' && LANE_PLANNERS.includes(quien)
			? loadTask()
			: undefined;
	const why = coordinatorIssue(cmd, flags, task);
	if (why) throw new UsageError(why);
}
