import type { APIRoute } from 'astro';
import { requireHostSession } from '@/lib/rsvp-v2/auth';
import { badRequest, internalError, jsonResponse, unauthorizedResponse } from '@/lib/rsvp-v2/http';
import { markGuestShared } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const POST: APIRoute = async ({ params, request, url }) => {
	try {
		const session = await requireHostSession(request);
		const guestId = sanitize(params.guestId, 120);
		if (!guestId) return badRequest('guestId es obligatorio.');

		const item = await markGuestShared({
			guestId,
			hostAccessToken: session.accessToken,
			origin: url.origin,
		});

		return jsonResponse({ item });
	} catch (error) {
		if (error instanceof Error && error.message.includes('No autorizado')) {
			return unauthorizedResponse();
		}
		return internalError(error);
	}
};
