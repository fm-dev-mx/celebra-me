import type { APIRoute } from 'astro';
import { PRIVATE_CACHE_CONTROL } from '@/lib/http/private-cache-path';
import { isLocalProcess } from '@/lib/server/deploy-identity';
import {
	clearIgnoreTrackingCookie,
	setIgnoreTrackingCookie,
} from '@/lib/tracking/internal-exclusion';

export const prerender = false;

/**
 * Dedicated SSR route to mark or clear the owner's device for internal traffic exclusion.
 * Visiting `/interno` sets the `cm_ignore_tracking` cookie and redirects to `/`.
 * Visiting `/interno?salir=1` (or `?interno=0`) clears the cookie and redirects to `/`.
 */
export const ALL: APIRoute = ({ request, cookies, url }) => {
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return new Response(null, {
			status: 405,
			headers: {
				Allow: 'GET, HEAD',
				'Cache-Control': PRIVATE_CACHE_CONTROL,
			},
		});
	}

	const isExit = url.searchParams.get('salir') === '1' || url.searchParams.get('interno') === '0';
	if (isExit) {
		clearIgnoreTrackingCookie(cookies);
	} else {
		setIgnoreTrackingCookie(cookies, isLocalProcess());
	}

	return new Response(null, {
		status: 302,
		headers: {
			Location: '/',
			'Cache-Control': PRIVATE_CACHE_CONTROL,
		},
	});
};

export const GET: APIRoute = ALL;
export const HEAD: APIRoute = ALL;
