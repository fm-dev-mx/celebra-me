/**
 * Who may write a locked task (d290): the lock's own session, or a declared coordinator once that session is
 * inactive or archived; such a coordinator write is noted in the bitácora for the lock's session.
 */
import { UsageError } from './cli.mjs';
import { buildMessageRow, isSilentLock, logRowError, sessionOf, taskLabel } from './model.mjs';
import { appendLog } from './store.mjs';

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/** d290: a lock with no heartbeat for this long counts as an inactive session the coordinator may write over. */
export const INACTIVE_LOCK_MINUTES = 30;
export const isInactiveLock = (candado, now = Date.now()) =>
	isSilentLock(candado, now, INACTIVE_LOCK_MINUTES / 60);

/** d290: why a declared coordinator may write over lock `c` (archived or inactive session), or null. */
export function overrideReason(c, flags) {
	if (!c || !flags.coordinador) return null;
	if (flags['sesion-archivada'] === true)
		return `la sesión ${c.sesion ?? 'del candado'} está archivada`;
	if (isInactiveLock(c))
		return `sin latido desde ${c.latido ?? c.desde} (más de ${INACTIVE_LOCK_MINUTES} min)`;
	return null;
}

/**
 * Refuses a write by anyone but the lock's session. d290: a declared coordinator may write over a lock whose
 * session is inactive (no heartbeat for INACTIVE_LOCK_MINUTES) or archived (--sesion-archivada, after checking
 * the session list); the reason comes back so the write can be noted. Null for an ordinary write.
 */
export function assertOwner(task, flags) {
	const c = task.candado;
	if (!c) {
		if (!flags.coordinador)
			throw new UsageError(
				'sin candado: primero claim o use --coordinador para coordinación explícita',
			);
		return null;
	}
	const override = overrideReason(c, flags);
	if (override) return override;
	const sesion = sessionOf(flags.agente, flags.sesion, process.env);
	if (c.agente !== flags.agente || !sesion || c.sesion !== sesion)
		throw new UsageError(
			flags.coordinador
				? `el candado de ${c.agente} sigue activo (latido ${c.latido ?? c.desde}): el coordinador solo escribe sobre un candado sin latido hace ${INACTIVE_LOCK_MINUTES} min o con --sesion-archivada`
				: 'el candado pertenece a otra sesión; indique --agente y --sesion coincidentes',
		);
	return null;
}

/**
 * d290: the bitácora note of a coordinator write over an inactive lock, sent to the lock's agent and session
 * so it reads it in its inbox.
 */
export function noteOverride(dir, task, motivo, corrio) {
	if (!motivo) return;
	const { agente, sesion } = task.candado;
	const en = nowIso();
	const texto = `${taskLabel(task)}: el coordinador corrió «${corrio}» sobre el candado de ${agente}: ${motivo}.`;
	const row = buildMessageRow(
		task.id,
		{ de: 'coordinador', para: agente, texto, id: `candado-${task.id}-${en}` },
		en,
	);
	if (sesion) row.mensaje.sesion = sesion;
	const why = logRowError(row);
	if (why) throw new UsageError(why);
	appendLog(dir, row);
}
