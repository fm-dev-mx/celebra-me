import type { APIRoute } from 'astro';
import { requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import {
	listOrganizerUploaders,
	requireOrganizerMemorySpace,
} from '@/lib/memories/server/organizer.service';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { requireEventIdParam } from '@/lib/memories/server/route-guards';

export const prerender = false;

/** Guests with available files and their counts, for the host's guest filter. */
export const GET: APIRoute = async ({ request, locals, params }) => {
	try {
		const eventId = requireEventIdParam(params);
		const session = requireDashboardSessionFromLocals(locals);
		await requireMemoriesRateLimit(request, 'organizer', session.userId);
		const space = await requireOrganizerMemorySpace(eventId, session);
		return withPrivateCache(jsonResponse({ uploaders: await listOrganizerUploaders(space) }));
	} catch (error) {
		return errorResponse(error);
	}
};
