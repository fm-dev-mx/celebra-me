// Owner notifications. Messages carry counts and, per row, only the task number and its public
// `aviso`; task titles, prompts and inbox texts never leave the machine.

import type { ResumenBandeja } from '../core/inbox.ts';

export interface Notificador {
	enviar(texto: string): Promise<void>;
}

const ETIQUETAS = { decidir: 'decidir', aprobar: 'aprobar', hacer: 'hacer fuera' } as const;

function plural(n: number, uno: string, varios: string): string {
	return `${n} ${n === 1 ? uno : varios}`;
}

/** Returns an empty string when there is nothing to report. */
export function mensajeBandeja(proyecto: string, resumen: ResumenBandeja): string {
	const partes = [
		resumen.decidir ? plural(resumen.decidir, 'decisión', 'decisiones') : '',
		resumen.aprobar ? plural(resumen.aprobar, 'aprobación', 'aprobaciones') : '',
		resumen.hacer ? plural(resumen.hacer, 'pendiente fuera', 'pendientes fuera') : '',
	].filter(Boolean);
	if (partes.length === 0) return '';
	const filas = resumen.filas.map(
		(fila) => `T${fila.num} ${fila.aviso} (${ETIQUETAS[fila.tipo]})`,
	);
	return [`${proyecto}: ${partes.join(', ')}`, ...filas].join('\n');
}

export class Telegram implements Notificador {
	private readonly token: string;
	private readonly chat: string;

	constructor(token: string, chat: string) {
		if (!/^\d+:[\w-]+$/.test(token)) throw new Error('Invalid Telegram bot token');
		if (!/^-?\d+$/.test(chat)) throw new Error('Invalid Telegram chat id');
		this.token = token;
		this.chat = chat;
	}

	/** Reads credentials from the environment variables named in the config. */
	static desdeEntorno(nombres: { tokenEnv: string; chatEnv: string }): Telegram | undefined {
		const token = process.env[nombres.tokenEnv];
		const chat = process.env[nombres.chatEnv];
		return token && chat ? new Telegram(token, chat) : undefined;
	}

	async enviar(texto: string): Promise<void> {
		if (!texto) return;
		const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				chat_id: this.chat,
				text: texto,
				disable_web_page_preview: true,
			}),
			signal: AbortSignal.timeout(15_000),
		});
		if (!res.ok) throw new Error(`Telegram answered ${res.status}`);
	}
}
