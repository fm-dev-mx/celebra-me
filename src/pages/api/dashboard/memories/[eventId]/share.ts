import type { APIRoute } from 'astro';
import { requireDashboardMutationAccess } from '@/lib/rsvp/auth/authorization';
import {
	badRequest,
	errorResponse,
	jsonResponse,
	parseJsonBody,
	withPrivateCache,
} from '@/lib/rsvp/core/http';
import { requireOrganizerMemorySpace } from '@/lib/memories/server/organizer.service';
import { memoriesRequestOrigin } from '@/lib/memories/server/public-origin';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { requireEventIdParam } from '@/lib/memories/server/route-guards';
import { isMemoriesShareAction, updateMemoriesShare } from '@/lib/memories/server/share.service';

export const prerender = false;

/** `enable`, `disable` or `rotate` (revoke the current link and issue a new one). */
export const POST: APIRoute = async ({ request, locals, params, cookies }) => {
	try {
		const eventId = requireEventIdParam(params);
		const session = await requireDashboardMutationAccess(request, cookies, locals);
		await requireMemoriesRateLimit(request, 'organizer', session.userId);
		const space = await requireOrganizerMemorySpace(eventId, session);
		const body = await parseJsonBody(request);
		if (body instanceof Response) return body;
		if (!isMemoriesShareAction(body.action)) return badRequest('La acción no es válida.');
		const result = await updateMemoriesShare({
			space,
			action: body.action,
			actorId: session.userId,
			requestOrigin: memoriesRequestOrigin(request),
		});
		return withPrivateCache(jsonResponse(result));
	} catch (error) {
		return errorResponse(error);
	}
};
