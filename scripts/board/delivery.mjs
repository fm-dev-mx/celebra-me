/**
 * d249 (T205): the owner already pasted a task's prompt into an agent's chat. «Copiar prompt» in the view and
 * `pnpm board entregada <id> --agente=<a>` write `entregada {agente, desde}`; the task then leaves «Le toca a
 * usted» while it waits for a claim, comes back after DELIVERY_STALE_MINUTES without one, and `claim` clears the
 * mark. Pure functions only: model.mjs, next.mjs and the view (as /delivery.mjs) share them.
 */
export const DELIVERY_STALE_MINUTES = 30;
const MINUTE_MS = 60_000;
const TZ = 'America/Mazatlan';

/**
 * `{agente, desde, minutos, vencida}` while an unlocked, unstarted task holds the mark, else null. `vencida` is
 * true once DELIVERY_STALE_MINUTES passed without a claim.
 */
export function delivery(t, now = Date.now()) {
	const e = t?.entregada;
	const since = Date.parse(e?.desde ?? '');
	if (!e || t.candado || (t.estado ?? 'pendiente') !== 'pendiente' || Number.isNaN(since))
		return null;
	const minutos = Math.max(0, Math.floor((now - since) / MINUTE_MS));
	return {
		agente: e.agente,
		desde: e.desde,
		minutos,
		vencida: minutos >= DELIVERY_STALE_MINUTES,
	};
}

/** Delivered less than DELIVERY_STALE_MINUTES ago: an agent has the prompt, the owner has nothing to do yet. */
export const awaitingClaim = (t, now) => delivery(t, now)?.vencida === false;

/** `t` without its mark, as `claim` saves it. */
export function undelivered(t) {
	const out = { ...t };
	delete out.entregada;
	return out;
}

/** «14:35», in the owner's time zone like the view. */
export const deliveryHour = (iso) =>
	new Date(iso).toLocaleTimeString('es-MX', {
		timeZone: TZ,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});

const waited = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);

/**
 * What the card, the sheet, `list` and `show` say about the mark: «Entregada a Codex · 14:35 · esperando que la
 * tome», after the wait «Entregada hace 30 min y nadie la tomó»; '' without a mark. `nombre(agente)` names the
 * agent.
 */
export function deliveryText(t, now = Date.now(), nombre = (a) => a) {
	const d = delivery(t, now);
	if (!d) return '';
	return d.vencida
		? `Entregada hace ${waited(d.minutos)} y nadie la tomó`
		: `Entregada a ${nombre(d.agente)} · ${deliveryHour(d.desde)} · esperando que la tome`;
}
