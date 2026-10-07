import type { APIRoute } from 'astro';
import { requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import { errorResponse } from '@/lib/rsvp/core/http';
import { requireOrganizerMemorySpace } from '@/lib/memories/server/organizer.service';
import { memoriesRequestOrigin } from '@/lib/memories/server/public-origin';
import { buildMemoriesQrDownloadResponse } from '@/lib/memories/server/qr-download';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { requireEventIdParam } from '@/lib/memories/server/route-guards';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, params }) => {
	try {
		const eventId = requireEventIdParam(params);
		const session = requireDashboardSessionFromLocals(locals);
		await requireMemoriesRateLimit(request, 'organizer', session.userId);
		const space = await requireOrganizerMemorySpace(eventId, session);
		return await buildMemoriesQrDownloadResponse(space, memoriesRequestOrigin(request));
	} catch (error) {
		return errorResponse(error);
	}
};
