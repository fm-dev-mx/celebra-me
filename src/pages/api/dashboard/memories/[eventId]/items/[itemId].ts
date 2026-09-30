import type { APIRoute } from 'astro';
import {
	requireDashboardMutationAccess,
	requireDashboardSessionFromLocals,
} from '@/lib/rsvp/auth/authorization';
import { errorResponse, jsonResponse, parseJsonBody, withPrivateCache } from '@/lib/rsvp/core/http';
import { recordMemoriesAccess } from '@/lib/memories/server/audit';
import { getMediaObjectForRetrieval } from '@/lib/memories/server/guest-media.service';
import {
	requireOrganizerMemorySpace,
	updateOrganizerMemoryItem,
} from '@/lib/memories/server/organizer.service';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { requireEventIdParam, requireItemId } from '@/lib/memories/server/route-guards';
import { retrieveMemoriesObject } from '@/lib/memories/server/worker-gateway';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, locals, params, cookies }) => {
	try {
		const eventId = requireEventIdParam(params);
		const mediaItemId = requireItemId(params);
		const session = await requireDashboardMutationAccess(request, cookies, locals);
		await requireMemoriesRateLimit(request, 'organizer', session.userId);
		const space = await requireOrganizerMemorySpace(eventId, session);
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const item = await updateOrganizerMemoryItem({
			space,
			mediaItemId,
			caption: bodyResult.caption,
			status: bodyResult.status,
			actorId: session.userId,
		});
		return withPrivateCache(jsonResponse({ item }));
	} catch (error) {
		return errorResponse(error);
	}
};

export const GET: APIRoute = async ({ request, locals, params }) => {
	try {
		const eventId = requireEventIdParam(params);
		const mediaItemId = requireItemId(params);
		const session = requireDashboardSessionFromLocals(locals);
		await requireMemoriesRateLimit(request, 'organizer', session.userId);
		const space = await requireOrganizerMemorySpace(eventId, session);
		const mode =
			new URL(request.url).searchParams.get('mode') === 'preview' ? 'inline' : 'attachment';
		const object = await getMediaObjectForRetrieval(space, mediaItemId);
		const response = await retrieveMemoriesObject({
			...object,
			mode,
			range: request.headers.get('range'),
		});
		if (!response.ok) return new Response(null, { status: 404 });
		await recordMemoriesAccess({
			eventId: space.eventId,
			mediaItemId,
			actorType: 'organizer',
			actorId: session.userId,
			mode,
		});
		return response;
	} catch (error) {
		return errorResponse(error);
	}
};

export const DELETE: APIRoute = async ({ request, locals, params, cookies }) => {
	try {
		const eventId = requireEventIdParam(params);
		const mediaItemId = requireItemId(params);
		const session = await requireDashboardMutationAccess(request, cookies, locals);
		await requireMemoriesRateLimit(request, 'organizer', session.userId);
		const space = await requireOrganizerMemorySpace(eventId, session);
		await updateOrganizerMemoryItem({
			space,
			mediaItemId,
			status: 'deleted',
			actorId: session.userId,
		});
		return withPrivateCache(jsonResponse({ success: true }));
	} catch (error) {
		return errorResponse(error);
	}
};
