/**
 * d249 (T205) `pnpm board entregada <id> --agente=<a>`: the owner (or a dispatcher) pasted the task's prompt into
 * that agent's chat. The view's «Copiar prompt» writes the same mark through `viewDeliverer`. See delivery.mjs.
 */
import { UsageError, say } from './cli.mjs';
import { DELIVERY_STALE_MINUTES } from './delivery.mjs';
import { AGENTES, needsOwner, stage } from './model.mjs';
import { loadBoard, withLock } from './store.mjs';

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const need = (v, msg) => {
	if (!v || v === true) throw new UsageError(msg);
	return v;
};

export function deliveryCommands({ getTask, saveTask }) {
	/** Marks a ready, unlocked task as delivered to `agente` now; a second mark moves the time. */
	function setDelivered(dir, id, agente, { quien, corrio } = {}) {
		if (!AGENTES.includes(agente))
			throw new UsageError(`agente desconocido: ${agente}; use ${AGENTES.join('|')}`);
		return withLock(dir, () => {
			const before = getTask(dir, need(id, 'falta <id>'));
			if (before.candado)
				throw new UsageError(`${before.id} ya la tomó ${before.candado.agente}`);
			if (needsOwner(before))
				throw new UsageError(`${before.id} la hace usted: no se entrega a un agente`);
			if (stage(before, loadBoard(dir)) !== 'lista')
				throw new UsageError(`${before.id} no está lista: solo se entrega una tarea lista`);
			const entregada = { agente, desde: nowIso() };
			return saveTask(dir, before, { ...before, entregada }, { quien, corrio });
		});
	}

	return {
		setDelivered,
		/** The view server's `deliver` option: a refused write comes back as `{ error }` for a 409. */
		viewDeliverer: (dir) => (id, agente, opts) => {
			try {
				return { task: setDelivered(dir, id, agente, opts) };
			} catch (e) {
				if (e instanceof UsageError) return { error: e.message };
				throw e;
			}
		},
		commands: {
			entregada({ pos, flags }, dir, out) {
				const agente = need(flags.agente, `falta --agente=${AGENTES.join('|')}`);
				const t = setDelivered(dir, pos[0], agente, {
					quien: flags.quien,
					corrio: 'pnpm board entregada',
				});
				say(
					flags,
					out,
					t,
					`${t.id} entregada a ${agente} (rev ${t.rev}): vuelve a «Le toca a usted» si en ${DELIVERY_STALE_MINUTES} min nadie la toma`,
				);
			},
		},
	};
}
