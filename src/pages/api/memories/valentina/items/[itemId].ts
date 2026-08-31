import type { APIRoute } from 'astro';
import {
	badRequest,
	errorResponse,
	jsonResponse,
	parseJsonBody,
	withPrivateCache,
} from '@/lib/rsvp/core/http';
import {
	completeGuestMemoryItem,
	deleteGuestMemoryItem,
	getGuestMemorySessionFromRequest,
	updateGuestMemoryCaption,
	getMediaObjectForPrivateRetrieval,
} from '@/lib/memories/valentina-memories.service';
import { recordValentinaMemoryAccess } from '@/lib/memories/valentina-memories-audit';
import { requireValentinaMemoryRateLimit } from '@/lib/memories/valentina-memories-rate-limit';
import { retrieveValentinaMemoryObject } from '@/lib/memories/valentina-memories-retrieval';

export const prerender = false;

async function requireSession(request: Request) {
	const session = await getGuestMemorySessionFromRequest(request);
	if (!session) throw new Response(null, { status: 401 });
	return session;
}

export const PATCH: APIRoute = async ({ request, params }) => {
	try {
		if (!params.itemId) return badRequest('No se especificó el recuerdo.');
		const session = await requireSession(request);
		await requireValentinaMemoryRateLimit(request, 'mutate', session.id);
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const item = await updateGuestMemoryCaption({
			session,
			mediaItemId: params.itemId,
			caption: bodyResult.caption,
		});
		return withPrivateCache(jsonResponse({ item }));
	} catch (error) {
		return error instanceof Response ? error : errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, params }) => {
	try {
		if (!params.itemId) return badRequest('No se especificó el recuerdo.');
		const session = await requireSession(request);
		await requireValentinaMemoryRateLimit(request, 'mutate', session.id);
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		if (bodyResult.action !== 'complete')
			return badRequest('La acción de recuerdo no es válida.');
		const item = await completeGuestMemoryItem({ session, mediaItemId: params.itemId });
		return withPrivateCache(jsonResponse({ item }));
	} catch (error) {
		return error instanceof Response ? error : errorResponse(error);
	}
};

export const DELETE: APIRoute = async ({ request, params }) => {
	try {
		if (!params.itemId) return badRequest('No se especificó el recuerdo.');
		const session = await requireSession(request);
		await requireValentinaMemoryRateLimit(request, 'mutate', session.id);
		await deleteGuestMemoryItem({ session, mediaItemId: params.itemId });
		return withPrivateCache(jsonResponse({ success: true }));
	} catch (error) {
		return error instanceof Response ? error : errorResponse(error);
	}
};

export const GET: APIRoute = async ({ request, params }) => {
	try {
		if (!params.itemId) return badRequest('No se especificó el recuerdo.');
		const session = await requireSession(request);
		await requireValentinaMemoryRateLimit(request, 'read', session.id);
		const object = await getMediaObjectForPrivateRetrieval(params.itemId, session.id);
		const response = await retrieveValentinaMemoryObject({
			...object,
			mode: 'inline',
			range: request.headers.get('range'),
		});
		if (!response.ok) return new Response(null, { status: response.status });
		await recordValentinaMemoryAccess({
			mediaItemId: params.itemId,
			actorType: 'guest',
			mode: 'inline',
		});
		return response;
	} catch (error) {
		return error instanceof Response ? error : errorResponse(error);
	}
};
