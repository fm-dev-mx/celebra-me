/**
 * T437 (d353) / T442: optional Telegram alerts for owner escalation and notices.
 * Configuration lives in ignored .agent/tmp/telegram.json or environment variables.
 * Missing configuration or transport failure never blocks the caller.
 * The token and chat id are never printed or logged; setup commands report only outcomes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { boardDir } from './store.mjs';

const API = 'https://api.telegram.org/bot';
const TOKEN_PATTERN = /^\d{5,}:[A-Za-z0-9_-]{30,}$/;
export const TEST_TEXT = 'Prueba de Celebra-me';
/** A hung connection must not stall the one-minute watcher pass. */
export const TIMEOUT_MS = 10_000;

export function telegramConfigPath(dir) {
	return join(dirname(dir), 'telegram.json');
}

/** Raw ignored file contents ({} when missing or unreadable). */
export function readTelegramFile(dir) {
	try {
		return JSON.parse(readFileSync(telegramConfigPath(dir), 'utf8')) ?? {};
	} catch {
		return {};
	}
}

/** Merge fields into the ignored config file, readable only by the owner where the OS allows it. */
export function writeTelegramFile(dir, fields) {
	const file = telegramConfigPath(dir);
	mkdirSync(dirname(file), { recursive: true });
	const data = { ...readTelegramFile(dir), ...fields };
	writeFileSync(file, `${JSON.stringify(data, null, '\t')}\n`, { mode: 0o600 });
}

export function readTelegramConfig(dir) {
	if (dir) {
		const file = telegramConfigPath(dir);
		if (existsSync(file)) {
			try {
				const data = JSON.parse(readFileSync(file, 'utf8'));
				if (data.token && (data.chatId || data.chat_id))
					return { token: data.token, chatId: data.chatId || data.chat_id };
			} catch {
				return null;
			}
		}
	}
	const token = process.env.TELEGRAM_BOT_TOKEN;
	const chatId = process.env.TELEGRAM_CHAT_ID;
	if (token && chatId) return { token, chatId };
	return null;
}

export async function sendTelegramAlert(
	text,
	{
		dir,
		config = readTelegramConfig(dir),
		fetch = globalThis.fetch,
		timeoutMs = TIMEOUT_MS,
	} = {},
) {
	if (!config?.token || !config?.chatId) return { ok: false, reason: 'unconfigured' };
	try {
		const url = `${API}${config.token}/sendMessage`;
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chat_id: config.chatId, text }),
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (res.ok) return { ok: true };
		const body = await res.json().catch(() => null);
		const retryAfter = Number(body?.parameters?.retry_after);
		return { ok: false, status: res.status, ...(retryAfter > 0 ? { retryAfter } : {}) };
	} catch (error) {
		// Only the error name: transport messages may echo the request URL, which holds the token.
		return {
			ok: false,
			error: error?.name === 'TimeoutError' ? 'timeout' : (error?.name ?? 'error'),
		};
	}
}

/** Read a line without echoing it, so the token never lands in a terminal transcript. */
export function promptHidden(question, { input = process.stdin, output = process.stdout } = {}) {
	return new Promise((done) => {
		const muted = new Writable({ write: (_chunk, _enc, cb) => cb() });
		const rl = createInterface({ input, output: muted, terminal: Boolean(input.isTTY) });
		output.write(question);
		rl.question('', (answer) => {
			rl.close();
			output.write('\n');
			done(answer.trim());
		});
	});
}

export async function saveToken(dir, { prompt = promptHidden, out = console.log } = {}) {
	const token = await prompt('Pegue el token del bot (no se mostrará) y presione Enter: ');
	if (!TOKEN_PATTERN.test(token)) {
		out(
			'Ese texto no parece un token de BotFather (forma 123456789:ABC...). No se guardó nada.',
		);
		return false;
	}
	writeTelegramFile(dir, { token });
	out('Token guardado. Siguiente: escriba «hola» a su bot y corra pnpm board:telegram:chat');
	return true;
}

/** Latest private chat that wrote to the bot, preferring a «hola». */
export function chatFromUpdates(updates) {
	const chats = (updates ?? [])
		.map((u) => u.message ?? u.edited_message)
		.filter((m) => m?.chat?.type === 'private');
	const hola = chats.filter((m) => /hola/i.test(m.text ?? ''));
	return (hola.at(-1) ?? chats.at(-1))?.chat.id ?? null;
}

export async function discoverChat(
	dir,
	{ fetch = globalThis.fetch, out = console.log, timeoutMs = TIMEOUT_MS } = {},
) {
	const { token } = readTelegramFile(dir);
	if (!token) {
		out('Falta el token. Corra primero pnpm board:telegram:token');
		return false;
	}
	let body;
	try {
		const res = await fetch(`${API}${token}/getUpdates`, {
			signal: AbortSignal.timeout(timeoutMs),
		});
		body = await res.json();
		if (!res.ok || !body?.ok) throw new Error(`estado ${res.status}`);
	} catch {
		out('Telegram no respondió o rechazó el token. Revise el token y vuelva a intentar.');
		return false;
	}
	const chatId = chatFromUpdates(body.result);
	if (chatId === null) {
		out(
			'No encontré su mensaje. Escriba «hola» a su bot en Telegram y vuelva a correr este comando.',
		);
		return false;
	}
	writeTelegramFile(dir, { chatId: String(chatId) });
	out('Chat encontrado y guardado. Siguiente: pnpm board:telegram:test');
	return true;
}

export async function sendTest(dir, { fetch = globalThis.fetch, out = console.log } = {}) {
	const result = await sendTelegramAlert(TEST_TEXT, { dir, fetch });
	if (result.ok) out(`Enviado: «${TEST_TEXT}». Revise Telegram.`);
	else if (result.reason === 'unconfigured')
		out(
			'Falta configuración. Corra pnpm board:telegram:token y luego pnpm board:telegram:chat',
		);
	else out(`Telegram no aceptó el mensaje${result.status ? ` (estado ${result.status})` : ''}.`);
	return result.ok;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const command = process.argv[2];
	const run = { token: saveToken, chat: discoverChat, test: sendTest }[command];
	if (!run) {
		console.error('Uso: node scripts/board/telegram.mjs token|chat|test');
		process.exitCode = 2;
	} else {
		run(boardDir())
			.then((ok) => {
				if (!ok) process.exitCode = 1;
			})
			.catch(() => {
				console.error('board:telegram: falló sin enviar datos sensibles al registro');
				process.exitCode = 1;
			});
	}
}
