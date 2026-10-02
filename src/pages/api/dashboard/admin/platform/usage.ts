import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { getPlatformUsageReport } from '@/lib/platform/server/platform-usage.service';

export const prerender = false;

/** Aggregated provider usage, separate from any list so pages never wait on it. */
export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'platform:usage');
		await requireAdminStrongSession(request);
		return withPrivateCache(jsonResponse({ usage: await getPlatformUsageReport() }));
	} catch (error) {
		return errorResponse(error);
	}
};
