/**
 * Periodic tasks (d268): a task with `cada` (`<n>d`) is closed one cycle at a time. Pure functions only;
 * close-commands.mjs reschedules the task with them.
 */
/** `<n>d`, for example `7d` or `14d`; model.mjs checks the field with the same rule. */
export const CADA_RE = /^[1-9]\d*d$/;
const DAY_MS = 86_400_000;
const isoOf = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** The length of a `cada` cycle in milliseconds, or null when it is not `<n>d`. */
export const cadaMs = (cada) => (CADA_RE.test(String(cada)) ? parseInt(cada, 10) * DAY_MS : null);

/**
 * The requisitos of a periodic task's next cycle: every `fecha` moves forward by whole cycles until it is in the
 * future; a task without one gets `now + cada`. The other requisitos stay as they are.
 */
export function nextCycle(t, now = Date.now()) {
	const step = cadaMs(t.cada);
	const list = Array.isArray(t.requisitos) ? t.requisitos : [];
	if (!step) return list;
	if (!list.some((r) => r?.tipo === 'fecha'))
		return [...list, { tipo: 'fecha', ref: isoOf(now + step) }];
	// Closed before its date, the task still moves one whole cycle.
	const ahead = (ms) =>
		Number.isNaN(ms) ? now + step : ms + Math.max(1, Math.floor((now - ms) / step) + 1) * step;
	return list.map((r) => {
		if (r?.tipo !== 'fecha') return r;
		const next = { ...r, ref: isoOf(ahead(Date.parse(r.ref))) };
		delete next.ok;
		return next;
	});
}
