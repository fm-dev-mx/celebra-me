import type { APIRoute } from 'astro';
import { getRsvpContext } from '@/lib/rsvp/service';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function sanitize(value: unknown, maxLen = 256): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const eventSlug = sanitize(url.searchParams.get('eventSlug'), 120);
		const token = sanitize(url.searchParams.get('token'), 2048);

		if (!eventSlug) {
			return new Response(JSON.stringify({ message: 'eventSlug es obligatorio.' }), {
				status: 400,
				headers: JSON_HEADERS,
			});
		}

		const context = await getRsvpContext(eventSlug, token || undefined);
		return new Response(JSON.stringify(context), {
			status: 200,
			headers: JSON_HEADERS,
		});
	} catch (error) {
		console.error('RSVP context error:', error);
		return new Response(JSON.stringify({ message: 'Error interno del servidor.' }), {
			status: 500,
			headers: JSON_HEADERS,
		});
	}
};
