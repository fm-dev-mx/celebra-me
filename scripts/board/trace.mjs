/**
 * Who added a task and who last followed it up (T172): `agregadaPor` is stamped when a task is created, and
 * `seguimientoPor` on the follow-up writes (`set`, `plan`, `move`, `close`, `merged`). The view and `show` read
 * them through `traceOf` in format.mjs, which falls back to the bitácora for tasks saved before T172.
 */
import { AGENT_REGISTRY, QUIEN, quienOf } from './model.mjs';

/**
 * The writer recorded in the trace: a real agent (`claude|codex|gemini`) from --quien or --agente wins, also
 * combined with --coordinador; else --quien (`dueno`, `coordinador`) or the coordinator flag.
 */
export function traceActor({ quien, agente, coordinador } = {}) {
	const named = typeof quien === 'string' && quien ? quienOf({ quien }) : undefined;
	const agent = [named, agente].find(
		(a) => typeof a === 'string' && Object.hasOwn(AGENT_REGISTRY, a),
	);
	if (agent) return agent;
	if (QUIEN.includes(named)) return named;
	return coordinador ? 'coordinador' : undefined;
}

/** `after` with its trace: `agregadaPor` on creation, `seguimientoPor` when `who.seguimiento` marks a follow-up. */
export function withTrace(before, after, who = {}) {
	const actor = traceActor(who);
	if (!actor) return after;
	if (!before) return after.agregadaPor ? after : { ...after, agregadaPor: actor };
	return who.seguimiento ? { ...after, seguimientoPor: actor } : after;
}
