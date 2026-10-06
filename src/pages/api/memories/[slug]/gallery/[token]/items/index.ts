import type { APIRoute } from 'astro';
import { badRequest, errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import {
	listSharedGalleryItems,
	requireSharedGallerySpace,
} from '@/lib/memories/server/share.service';

export const prerender = false;

/** One page of the shared gallery: visible, available files with the uploader's name. */
export const GET: APIRoute = async ({ request, params, url }) => {
	try {
		await requireMemoriesRateLimit(request, 'gallery');
		const space = await requireSharedGallerySpace(params.slug, params.token);
		const rawPage = url.searchParams.get('page') ?? '0';
		if (!/^\d{1,4}$/.test(rawPage)) return badRequest('La página no es válida.');
		return withPrivateCache(jsonResponse(await listSharedGalleryItems(space, Number(rawPage))));
	} catch (error) {
		return errorResponse(error);
	}
};
