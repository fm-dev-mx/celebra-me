/**
 * T437 (d353): the watcher tells the owner on Telegram when something new lands in «Le toca a usted».
 * One message per pass groups every item that arrived since the last minute; each item alerts once while it
 * stays listed and re-arms after it leaves. An empty list sends nothing. Without configuration the watcher
 * keeps working, records the items as seen (no flood once configured) and says so once in its log.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { publicAviso } from './owner-text.mjs';
import { ownerInbox } from './next.mjs';
import { readTelegramConfig, sendTelegramAlert } from './telegram.mjs';

export const BOARD_URL = 'http://127.0.0.1:4320';
const MAX_LINES = 8;
const BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 30 * 60_000;
/** Telegram rejected the token or chat itself: retrying cannot succeed until the config changes. */
const PERMANENT = new Set([400, 401, 403, 404]);

/** Short one-way digest that tells config changes apart without storing the token. */
const configDigest = (config) =>
	createHash('sha256')
		.update(
			`${config.token}
${config.chatId}`,
		)
		.digest('hex')
		.slice(0, 12);

/** Records why a send failed and when the next attempt may run; returns the log line. */
function recordFailure(owner, result, config, now) {
	const status = result?.status;
	if (PERMANENT.has(status)) {
		owner.rechazada = configDigest(config);
		delete owner.reintento;
		return `Telegram rechazó la configuración (estado ${status}); no se reintentará hasta cambiar el token o el chat (pnpm board:telegram:token / pnpm board:telegram:chat).`;
	}
	const intentos = (owner.reintento?.intentos ?? 0) + 1;
	const wait =
		status === 429 && result.retryAfter
			? result.retryAfter * 1000
			: Math.min(BACKOFF_MS * 2 ** (intentos - 1), MAX_BACKOFF_MS);
	owner.reintento = { intentos, hasta: new Date(now + wait).toISOString() };
	const why = status ? `estado ${status}` : (result?.error ?? 'sin respuesta');
	return `Aviso por Telegram no enviado (${why}); se reintentará en ${Math.ceil(wait / 60_000)} min.`;
}

/** True while a permanent rejection of this exact config or a back-off window is in force. */
function sendBlocked(owner, config, now) {
	if (owner.rechazada && owner.rechazada === configDigest(config)) return true;
	return Boolean(owner.reintento && now < Date.parse(owner.reintento.hasta));
}

export const watchLogPath = (dir) => join(dirname(dir), 'board-master-watch.log');

/** Append one dated line to the watcher log; it never contains the token or chat id. */
export function appendWatchLog(dir, line, now = Date.now()) {
	const file = watchLogPath(dir);
	mkdirSync(dirname(file), { recursive: true });
	appendFileSync(file, `${new Date(now).toISOString()} ${line}\n`);
}

const KINDS = [
	['decidir', 'decisión', 'decisiones'],
	['aprobar', 'aprobación', 'aprobaciones'],
	['hacer', 'por hacer', 'por hacer'],
];

/**
 * T489: Telegram leaves the board, so it carries only the count per type and «T<n> <aviso>» for the tasks with a
 * public `aviso` (no client name, no amount); never a row's text.
 */
export function ownerAlertText(rows) {
	const counts = KINDS.flatMap(([tipo, one, many]) => {
		const n = rows.filter((r) => r.tipo === tipo).length;
		return n ? [`${n} ${n === 1 ? one : many}`] : [];
	});
	const avisos = [
		...new Set(
			rows.flatMap((r) => {
				const aviso = publicAviso(r.t);
				return aviso && r.t.num ? [`T${r.t.num} ${aviso}`] : [];
			}),
		),
	];
	const shown = avisos.slice(0, MAX_LINES).map((x) => `- ${x}`);
	const more = avisos.length > MAX_LINES ? [`- y ${avisos.length - MAX_LINES} más`] : [];
	return [`Celebra-me: ${counts.join(', ')}.`, ...shown, ...more, `Tablero: ${BOARD_URL}`].join(
		'\n',
	);
}

/**
 * Returns the rows sent (or that would be sent in dry-run); mutates `state.owner` only when it changes.
 * A permanent rejection (400/401/403/404) stops sending until the token or chat changes; 429 honours
 * `retry_after`; other failures back off from 1 min, doubling up to 30 min.
 */
export async function checkOwnerAlerts({
	dir,
	board,
	state,
	now = Date.now(),
	dryRun = false,
	out = console.log,
	log = (line) => appendWatchLog(dir, line, now),
	config = readTelegramConfig(dir),
	sendTelegram = sendTelegramAlert,
} = {}) {
	const rows = [
		...new Map(
			ownerInbox(board, { now })
				.filter((r) => r.clave)
				.map((r) => [r.clave, r]),
		).values(),
	];
	const previous = state.owner?.alertadas ?? [];
	const listed = new Set(rows.map((r) => r.clave));
	const kept = previous.filter((k) => listed.has(k));
	const fresh = rows.filter((r) => !kept.includes(r.clave));
	if (dryRun) {
		if (fresh.length) out(`[prueba] telegram: ${ownerAlertText(fresh)}`);
		return fresh;
	}
	const owner = { ...state.owner, alertadas: kept };
	const changed = kept.length !== previous.length;
	if (!fresh.length) {
		if (changed) state.owner = owner;
		return [];
	}
	if (!config) {
		if (!owner.sinConfig) {
			log(
				'Telegram sin configurar: los avisos al dueño no se envían (pnpm board:telegram:token).',
			);
			owner.sinConfig = new Date(now).toISOString();
		}
		owner.alertadas = [...kept, ...fresh.map((r) => r.clave)];
		state.owner = owner;
		return [];
	}
	delete owner.sinConfig;
	if (sendBlocked(owner, config, now)) {
		if (changed) state.owner = owner;
		return [];
	}
	delete owner.rechazada;
	const result = await sendTelegram(ownerAlertText(fresh), { dir, config });
	if (!result?.ok) {
		log(recordFailure(owner, result, config, now));
		state.owner = owner;
		return [];
	}
	delete owner.reintento;
	owner.alertadas = [...kept, ...fresh.map((r) => r.clave)];
	state.owner = owner;
	return fresh;
}
