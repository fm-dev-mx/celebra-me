import type { APIRoute } from 'astro';
import { logRsvpChannelEvent } from '@/lib/rsvp/service';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function sanitize(value: unknown, maxLen = 120): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const POST: APIRoute = async ({ request }) => {
	try {
		const raw = await request.json();
		const rsvpId = sanitize(raw.rsvpId);
		const channel = sanitize(raw.channel);
		const action = sanitize(raw.action);

		if (
			!rsvpId ||
			channel !== 'whatsapp' ||
			(action !== 'clicked' && action !== 'cta_rendered')
		) {
			return new Response(JSON.stringify({ message: 'Payload inválido.' }), {
				status: 400,
				headers: JSON_HEADERS,
			});
		}

		await logRsvpChannelEvent({
			rsvpId,
			channel: 'whatsapp',
			action,
		});

		return new Response(JSON.stringify({ message: 'Canal registrado.' }), {
			status: 200,
			headers: JSON_HEADERS,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Error interno del servidor.';
		const status = message.includes('no encontrado') ? 404 : 500;
		return new Response(JSON.stringify({ message }), {
			status,
			headers: JSON_HEADERS,
		});
	}
};
