/**
 * T437 (d353): the watcher tells the owner on Telegram when something new lands in «Le toca a usted».
 * One message per pass groups every item that arrived since the last minute; each item alerts once while it
 * stays listed and re-arms after it leaves. An empty list sends nothing. Without configuration the watcher
 * keeps working, records the items as seen (no flood once configured) and says so once in its log.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { nextSections } from './next.mjs';
import { readTelegramConfig, sendTelegramAlert } from './telegram.mjs';

export const BOARD_URL = 'http://127.0.0.1:4320';
const MAX_LINES = 8;

export const watchLogPath = (dir) => join(dirname(dir), 'board-master-watch.log');

/** Append one dated line to the watcher log; it never contains the token or chat id. */
export function appendWatchLog(dir, line, now = Date.now()) {
	const file = watchLogPath(dir);
	mkdirSync(dirname(file), { recursive: true });
	appendFileSync(file, `${new Date(now).toISOString()} ${line}\n`);
}

export function ownerAlertText(rows) {
	const tail = `Tablero: ${BOARD_URL}`;
	if (rows.length === 1) return `${rows[0].texto.replace(/\.$/, '')}. ${tail}`;
	const shown = rows.slice(0, MAX_LINES).map((r) => `- ${r.texto}`);
	const more = rows.length > MAX_LINES ? [`- y ${rows.length - MAX_LINES} más`] : [];
	return [`Le toca a usted (${rows.length} nuevas):`, ...shown, ...more, tail].join('\n');
}

/** Returns the rows sent (or that would be sent in dry-run); mutates `state.owner` only when it changes. */
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
			nextSections(board, { now })
				.usted.filter((r) => r.clave)
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
	const result = await sendTelegram(ownerAlertText(fresh), { dir, config });
	if (!result?.ok) {
		log(
			`Aviso por Telegram no enviado${result?.status ? ` (estado ${result.status})` : ''}; se reintentará.`,
		);
		state.owner = owner;
		return [];
	}
	owner.alertadas = [...kept, ...fresh.map((r) => r.clave)];
	state.owner = owner;
	return fresh;
}
