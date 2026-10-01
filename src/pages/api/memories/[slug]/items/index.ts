import type { APIRoute } from 'astro';
import {
	badRequest,
	errorResponse,
	jsonResponse,
	parseJsonBody,
	withPrivateCache,
} from '@/lib/rsvp/core/http';
import {
	listGuestMemoryItems,
	reserveGuestMemoryItem,
} from '@/lib/memories/server/guest-media.service';
import { requireGuestContext } from '@/lib/memories/server/route-guards';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
	try {
		const { space, session } = await requireGuestContext(request, params, 'read');
		return withPrivateCache(jsonResponse(await listGuestMemoryItems(space, session)));
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, params }) => {
	try {
		const { space, session } = await requireGuestContext(request, params, 'register');
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		if (bodyResult.action !== 'reserve')
			return badRequest('La acción de recuerdo no es válida.');
		const reservation = await reserveGuestMemoryItem({
			space,
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
