import type { APIRoute } from 'astro';
import { requireHostSession } from '@/lib/rsvp-v2/auth';
import { internalError, jsonResponse, unauthorizedResponse } from '@/lib/rsvp-v2/http';
import { listHostEvents } from '@/lib/rsvp-v2/service';

export const GET: APIRoute = async ({ request }) => {
	try {
		const session = await requireHostSession(request);
		const items = await listHostEvents({
			hostUserId: session.userId,
			hostAccessToken: session.accessToken,
		});
		return jsonResponse({ items });
	} catch (error) {
		if (error instanceof Error && error.message.includes('No autorizado')) {
			return unauthorizedResponse();
		}
		return internalError(error);
	}
};
