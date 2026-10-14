import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { getDemoEngagement } from '@/lib/tracking/demo-engagement.server';

export const prerender = false;

/** Demo design retention for administrators: anonymous session aggregates per demo. */
export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminRateLimit(request, 'engagement:demos');
		await requireAdminStrongSession(request);
		const demos = await getDemoEngagement({
			period: url.searchParams.get('period'),
			eventType: url.searchParams.get('eventType'),
			sort: url.searchParams.get('sort'),
		});
		return withPrivateCache(jsonResponse({ demos }));
	} catch (error) {
		return errorResponse(error);
	}
};
