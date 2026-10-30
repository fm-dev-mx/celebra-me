/**
 * T437 (d353) / T442: optional Telegram alerts for owner escalation and notices.
 * Configuration lives in ignored .agent/tmp/telegram.json or environment variables.
 * Missing configuration or transport failure never blocks the caller.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function telegramConfigPath(dir) {
	return join(dirname(dir), 'telegram.json');
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
	{ dir, config = readTelegramConfig(dir), fetch = globalThis.fetch } = {},
) {
	if (!config?.token || !config?.chatId) return { ok: false, reason: 'unconfigured' };
	try {
		const url = `https://api.telegram.org/bot${config.token}/sendMessage`;
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chat_id: config.chatId, text }),
		});
		if (!res.ok) return { ok: false, status: res.status };
		return { ok: true };
	} catch (error) {
		return { ok: false, error: error.message };
	}
}
