import type { APIRoute } from 'astro';
import { isAuthorizedBasicAuth, unauthorizedJsonResponse } from '@/lib/rsvp/adminAuth';
import { getRsvpInvitationContext } from '@/lib/rsvp/service';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function sanitize(value: unknown, maxLen = 120): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const GET: APIRoute = async ({ url, request }) => {
	try {
		if (!isAuthorizedBasicAuth(request.headers.get('authorization'))) {
			return unauthorizedJsonResponse();
		}

		const eventSlug = sanitize(url.searchParams.get('eventSlug'));
		if (!eventSlug) {
			return new Response(JSON.stringify({ message: 'eventSlug es obligatorio.' }), {
				status: 400,
				headers: JSON_HEADERS,
			});
		}

		const context = await getRsvpInvitationContext(eventSlug, url.origin);
		return new Response(JSON.stringify(context), {
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
