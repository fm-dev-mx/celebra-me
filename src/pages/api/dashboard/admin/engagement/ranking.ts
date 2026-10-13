import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { getEngagementRanking } from '@/lib/rsvp/engagement/engagement-ranking.service';

export const prerender = false;

/**
 * Administrator ranking over every published client invitation. Admin strong session only; the
 * report carries aggregates per invitation and design, never guest data.
 */
export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminRateLimit(request, 'engagement:ranking');
		await requireAdminStrongSession(request);
		const params = url.searchParams;
		const ranking = await getEngagementRanking({
			eventType: params.get('eventType'),
			groupKey: params.get('groupBy'),
			metric: params.get('metric'),
			eventStatus: params.get('eventStatus'),
			activity: params.get('activity'),
			fontFamily: params.get('font'),
			music: params.get('music'),
			confirmationMode: params.get('confirmation'),
			includeDisabled: params.get('includeDisabled'),
		});
		return withPrivateCache(jsonResponse({ ranking }));
	} catch (error) {
		return errorResponse(error);
	}
};
