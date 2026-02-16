import type { APIRoute } from 'astro';
import { logRsvpChannelEvent } from '@/lib/rsvp/service';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function sanitize(value: unknown, maxLen = 120): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const POST: APIRoute = async ({ request }) => {
	try {
		// Check if request body is empty
		const contentType = request.headers.get('content-type');
		if (!contentType?.includes('application/json')) {
			return new Response(
				JSON.stringify({ message: 'Content-Type must be application/json' }),
				{ status: 400, headers: JSON_HEADERS },
			);
		}

		// Try to parse JSON with error handling
		let rawText: string;
		try {
			rawText = await request.text();
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to read request body';
			return new Response(
				JSON.stringify({ message: `Failed to read request body: ${message}` }),
				{ status: 400, headers: JSON_HEADERS },
			);
		}

		// Check if body is empty
		if (!rawText.trim()) {
			return new Response(JSON.stringify({ message: 'Request body is empty' }), {
				status: 400,
				headers: JSON_HEADERS,
			});
		}

		// Parse JSON
		let raw: unknown;
		try {
			raw = JSON.parse(rawText);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Invalid JSON';
			return new Response(JSON.stringify({ message: `Invalid JSON format: ${message}` }), {
				status: 400,
				headers: JSON_HEADERS,
			});
		}

		// Ensure raw is an object
		if (typeof raw !== 'object' || raw === null) {
			return new Response(JSON.stringify({ message: 'Request body must be a JSON object' }), {
				status: 400,
				headers: JSON_HEADERS,
			});
		}

		const body = raw as Record<string, unknown>;
		const rsvpId = sanitize(body.rsvpId);
		const channel = sanitize(body.channel);
		const action = sanitize(body.action);

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
