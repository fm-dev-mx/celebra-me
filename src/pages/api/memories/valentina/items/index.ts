import type { APIRoute } from 'astro';
import {
	badRequest,
	errorResponse,
	jsonResponse,
	parseJsonBody,
	withPrivateCache,
} from '@/lib/rsvp/core/http';
import {
	getGuestMemorySessionFromRequest,
	listGuestMemoryItems,
	registerGuestMemoryItem,
	requireValentinaMemoryRateLimit,
} from '@/lib/memories/valentina-memories.service';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireValentinaMemoryRateLimit(request, 'read');
		const session = await getGuestMemorySessionFromRequest(request);
		if (!session) return new Response(null, { status: 401 });
		return withPrivateCache(jsonResponse({ items: await listGuestMemoryItems(session) }));
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		await requireValentinaMemoryRateLimit(request, 'register');
		const session = await getGuestMemorySessionFromRequest(request);
		if (!session) return new Response(null, { status: 401 });
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		if (bodyResult.action !== 'register')
			return badRequest('La acción de recuerdo no es válida.');
		const item = await registerGuestMemoryItem({
			session,
			objectKey: bodyResult.objectKey,
			mimeType: bodyResult.mimeType,
			sizeBytes: bodyResult.sizeBytes,
			durationSeconds: bodyResult.durationSeconds,
		});
		return withPrivateCache(jsonResponse({ item }, 201));
	} catch (error) {
		return errorResponse(error);
	}
};
