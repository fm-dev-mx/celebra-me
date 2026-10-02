import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { getCloudflarePlatformUsage } from '@/lib/memories/server/cloudflare-usage';

export const prerender = false;

/** Account-wide Cloudflare usage, separate from the list so the page never waits on it. */
export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'memories:usage');
		await requireAdminStrongSession(request);
		return withPrivateCache(jsonResponse({ usage: await getCloudflarePlatformUsage() }));
	} catch (error) {
		return errorResponse(error);
	}
};
