import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { errorResponse, jsonResponse, parseJsonBody, withPrivateCache } from '@/lib/rsvp/core/http';
import { updateMemorySpaceAdmin } from '@/lib/memories/server/admin.service';
import { requireEventIdParam } from '@/lib/memories/server/route-guards';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params, cookies }) => {
	try {
		const eventId = requireEventIdParam(params);
		const session = await requireAdminMutationAccess(request, cookies, 'memories:update');
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const item = await updateMemorySpaceAdmin(eventId, bodyResult, session.userId);
		return withPrivateCache(jsonResponse({ item }));
	} catch (error) {
		return errorResponse(error);
	}
};
