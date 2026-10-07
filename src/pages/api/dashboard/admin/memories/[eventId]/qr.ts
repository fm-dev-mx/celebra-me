import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse } from '@/lib/rsvp/core/http';
import { memoriesRequestOrigin } from '@/lib/memories/server/public-origin';
import { buildMemoriesQrDownloadResponse } from '@/lib/memories/server/qr-download';
import { requireEventIdParam } from '@/lib/memories/server/route-guards';
import { requireMemorySpaceByEventId } from '@/lib/memories/server/space.service';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
	try {
		const eventId = requireEventIdParam(params);
		await requireAdminRateLimit(request, 'memories:qr');
		await requireAdminStrongSession(request);
		const space = await requireMemorySpaceByEventId(eventId);
		return await buildMemoriesQrDownloadResponse(space, memoriesRequestOrigin(request));
	} catch (error) {
		return errorResponse(error);
	}
};
