import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { buildMemorySpaceDiagnostics } from '@/lib/memories/server/diagnostics.service';
import { memoriesRequestOrigin } from '@/lib/memories/server/public-origin';
import { requireEventIdParam } from '@/lib/memories/server/route-guards';
import { requireMemorySpaceByEventId } from '@/lib/memories/server/space.service';

export const prerender = false;

/** Counts and cause codes only; `?live=1` also runs the read-only reachability checks. */
export const GET: APIRoute = async ({ request, params, url }) => {
	try {
		const eventId = requireEventIdParam(params);
		await requireAdminRateLimit(request, 'memories:diagnostics');
		await requireAdminStrongSession(request);
		const space = await requireMemorySpaceByEventId(eventId);
		const diagnostics = await buildMemorySpaceDiagnostics(space, {
			live: url.searchParams.get('live') === '1',
			requestOrigin: memoriesRequestOrigin(request),
		});
		return withPrivateCache(jsonResponse({ diagnostics }));
	} catch (error) {
		return errorResponse(error);
	}
};
