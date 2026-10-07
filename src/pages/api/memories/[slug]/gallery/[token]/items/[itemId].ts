import type { APIRoute } from 'astro';
import { errorResponse } from '@/lib/rsvp/core/http';
import { getMediaObjectForRetrieval } from '@/lib/memories/server/guest-media.service';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { requireItemId } from '@/lib/memories/server/route-guards';
import { requireSharedGallerySpace } from '@/lib/memories/server/share.service';
import { retrieveMemoriesObject } from '@/lib/memories/server/worker-gateway';

export const prerender = false;

/** Thumbnails stay in the visitor's browser for a day to spare transfer on revisits. */
const THUMBNAIL_CACHE_CONTROL = 'private, max-age=86400';

/**
 * `variant=thumb` streams the WebP preview (or the original when none exists);
 * `download=1` asks the browser to save the original instead of showing it.
 */
export const GET: APIRoute = async ({ request, params, url }) => {
	try {
		await requireMemoriesRateLimit(request, 'gallery');
		const mediaItemId = requireItemId(params);
		const space = await requireSharedGallerySpace(params.slug, params.token);
		const thumb = url.searchParams.get('variant') === 'thumb';
		const object = await getMediaObjectForRetrieval(space, mediaItemId, undefined, {
			variant: thumb ? 'thumb' : 'original',
			excludeHidden: true,
		});
		const response = await retrieveMemoriesObject({
			...object,
			mode: url.searchParams.get('download') === '1' ? 'attachment' : 'inline',
			range: request.headers.get('range'),
		});
		if (!response.ok) return new Response(null, { status: 404 });
		if (!thumb) return response;
		const headers = new Headers(response.headers);
		headers.set('Cache-Control', THUMBNAIL_CACHE_CONTROL);
		return new Response(response.body, { status: response.status, headers });
	} catch (error) {
		return errorResponse(error);
	}
};
