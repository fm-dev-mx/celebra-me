import type { APIRoute } from 'astro';
import {
	badRequest,
	errorResponse,
	jsonResponse,
	parseJsonBody,
	withPrivateCache,
} from '@/lib/rsvp/core/http';
import { recordMemoriesAccess } from '@/lib/memories/server/audit';
import {
	completeGuestMemoryItem,
	deleteGuestMemoryItem,
	getMediaObjectForRetrieval,
	updateGuestMemoryCaption,
} from '@/lib/memories/server/guest-media.service';
import { requireGuestContext, requireItemId } from '@/lib/memories/server/route-guards';
import { retrieveMemoriesObject } from '@/lib/memories/server/worker-gateway';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params }) => {
	try {
		const mediaItemId = requireItemId(params);
		const { space, session } = await requireGuestContext(request, params, 'mutate');
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const item = await updateGuestMemoryCaption({
			space,
			session,
			mediaItemId,
			caption: bodyResult.caption,
		});
		return withPrivateCache(jsonResponse({ item }));
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, params }) => {
	try {
		const mediaItemId = requireItemId(params);
		const { space, session } = await requireGuestContext(request, params, 'mutate');
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		if (bodyResult.action !== 'complete')
			return badRequest('La acción de recuerdo no es válida.');
		const item = await completeGuestMemoryItem({ space, session, mediaItemId });
		return withPrivateCache(jsonResponse({ item }));
	} catch (error) {
		return errorResponse(error);
	}
};

export const DELETE: APIRoute = async ({ request, params }) => {
	try {
		const mediaItemId = requireItemId(params);
		const { space, session } = await requireGuestContext(request, params, 'mutate');
		await deleteGuestMemoryItem({ space, session, mediaItemId });
		return withPrivateCache(jsonResponse({ success: true }));
	} catch (error) {
		return errorResponse(error);
	}
};

export const GET: APIRoute = async ({ request, params, url }) => {
	try {
		const mediaItemId = requireItemId(params);
		const { space, session } = await requireGuestContext(request, params, 'read');
		const object = await getMediaObjectForRetrieval(space, mediaItemId, session.id, {
			variant: url.searchParams.get('variant') === 'thumb' ? 'thumb' : 'original',
		});
		const response = await retrieveMemoriesObject({
			...object,
			mode: 'inline',
			range: request.headers.get('range'),
		});
		if (!response.ok) return new Response(null, { status: 404 });
		await recordMemoriesAccess({
			eventId: space.eventId,
			mediaItemId,
			actorType: 'guest',
			mode: 'inline',
		});
		return response;
	} catch (error) {
		return errorResponse(error);
	}
};
