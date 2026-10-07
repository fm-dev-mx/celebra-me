import type { APIRoute } from 'astro';
import {
	badRequest,
	errorResponse,
	jsonResponse,
	parseJsonBody,
	withPrivateCache,
} from '@/lib/rsvp/core/http';
import { requireGuestContext, requireItemId } from '@/lib/memories/server/route-guards';
import {
	confirmGuestThumbnail,
	reserveGuestThumbnail,
} from '@/lib/memories/server/thumbnail.service';

export const prerender = false;

/** `reserve` returns a PUT capability for the WebP preview; `confirm` records it once stored. */
export const POST: APIRoute = async ({ request, params }) => {
	try {
		const mediaItemId = requireItemId(params);
		const { space, session } = await requireGuestContext(request, params, 'thumbnail');
		const body = await parseJsonBody(request);
		if (body instanceof Response) return body;
		if (body.action === 'reserve') {
			const result = await reserveGuestThumbnail({
				space,
				session,
				mediaItemId,
				sizeBytes: body.sizeBytes,
				checksumSha256: body.checksumSha256,
			});
			return withPrivateCache(jsonResponse(result));
		}
		if (body.action === 'confirm') {
			return withPrivateCache(
				jsonResponse(await confirmGuestThumbnail({ space, session, mediaItemId })),
			);
		}
		return badRequest('La acción no es válida.');
	} catch (error) {
		return errorResponse(error);
	}
};
