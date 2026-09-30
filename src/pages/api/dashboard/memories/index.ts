import type { APIRoute } from 'astro';
import { requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { listOrganizerMemorySpaces } from '@/lib/memories/server/organizer.service';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { toMemorySpaceSummary } from '@/lib/memories/server/space.service';

export const prerender = false;

/** Spaces the signed-in host owns, for the organizer event selector. */
export const GET: APIRoute = async ({ request, locals }) => {
	try {
		const session = requireDashboardSessionFromLocals(locals);
		await requireMemoriesRateLimit(request, 'organizer', session.userId);
		const spaces = await listOrganizerMemorySpaces(session);
		return withPrivateCache(
			jsonResponse({
				items: spaces.map((space) => ({
					eventId: space.eventId,
					...toMemorySpaceSummary(space),
				})),
			}),
		);
	} catch (error) {
		return errorResponse(error);
	}
};
