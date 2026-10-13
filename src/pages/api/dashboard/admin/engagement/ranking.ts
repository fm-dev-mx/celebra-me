import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { getEngagementRanking } from '@/lib/rsvp/engagement/engagement-ranking.service';

export const prerender = false;

/**
 * Administrator ranking over permanent engagement snapshots. Admin strong session only; the
 * report carries aggregates per invitation and design, never guest data.
 */
export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminRateLimit(request, 'engagement:ranking');
		await requireAdminStrongSession(request);
		const ranking = await getEngagementRanking({
			eventType: url.searchParams.get('eventType') ?? '',
			groupKey: url.searchParams.get('groupBy') ?? undefined,
			metric: url.searchParams.get('metric') ?? undefined,
		});
		return withPrivateCache(jsonResponse({ ranking }));
	} catch (error) {
		return errorResponse(error);
	}
};
