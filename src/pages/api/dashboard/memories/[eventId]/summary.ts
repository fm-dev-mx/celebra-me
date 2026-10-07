import type { APIRoute } from 'astro';
import { requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { requireOrganizerMemorySpace } from '@/lib/memories/server/organizer.service';
import { memoriesRequestOrigin } from '@/lib/memories/server/public-origin';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { requireEventIdParam } from '@/lib/memories/server/route-guards';
import { getMemorySpaceHostSummary } from '@/lib/memories/server/usage.service';

export const prerender = false;

/** Host progress for one owned space: totals and remaining capacity, no limits. */
export const GET: APIRoute = async ({ request, locals, params }) => {
	try {
		const eventId = requireEventIdParam(params);
		const session = requireDashboardSessionFromLocals(locals);
		await requireMemoriesRateLimit(request, 'organizer', session.userId);
		const space = await requireOrganizerMemorySpace(eventId, session);
		const summary = await getMemorySpaceHostSummary(
			space,
			new Date(),
			memoriesRequestOrigin(request),
		);
		return withPrivateCache(jsonResponse({ summary }));
	} catch (error) {
		return errorResponse(error);
	}
};
