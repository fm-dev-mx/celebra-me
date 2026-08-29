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
	reserveGuestMemoryItem,
} from '@/lib/memories/valentina-memories.service';
import { requireValentinaMemoryRateLimit } from '@/lib/memories/valentina-memories-rate-limit';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	try {
		const session = await getGuestMemorySessionFromRequest(request);
		if (!session) return new Response(null, { status: 401 });
		await requireValentinaMemoryRateLimit(request, 'read', session.id);
		return withPrivateCache(jsonResponse({ items: await listGuestMemoryItems(session) }));
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		const session = await getGuestMemorySessionFromRequest(request);
		if (!session) return new Response(null, { status: 401 });
		await requireValentinaMemoryRateLimit(request, 'register', session.id);
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		if (bodyResult.action !== 'reserve')
			return badRequest('La acción de recuerdo no es válida.');
		const reservation = await reserveGuestMemoryItem({
			session,
			mimeType: bodyResult.mimeType,
			sizeBytes: bodyResult.sizeBytes,
			checksumSha256: bodyResult.checksumSha256,
			durationSeconds: bodyResult.durationSeconds,
			clientRequestId: bodyResult.clientRequestId,
		});
		return withPrivateCache(jsonResponse(reservation, 201));
	} catch (error) {
		return errorResponse(error);
	}
};
