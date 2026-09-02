import type { APIRoute } from 'astro';
import { resolveGatedLocationPayload } from '@/lib/invitation/gated-location';
import { errorResponse, getIp, successResponse } from '@/lib/rsvp/core/http';
import { sanitize } from '@/lib/rsvp/core/utils';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { ApiError } from '@/lib/rsvp/core/errors';

function withNoStore(response: Response): Response {
	response.headers.set('Cache-Control', 'no-store, private');
	return response;
}

export const GET: APIRoute = async ({ params, request, url }) => {
	try {
		const inviteId = sanitize(params.inviteId, 100);
		const eventType = sanitize(url.searchParams.get('eventType'), 40);
		const slug = sanitize(url.searchParams.get('slug'), 140);
		const allowed = await checkRateLimit({
			namespace: 'ctx',
			entityId: `location:${inviteId}`,
			ip: getIp(request),
			maxHits: 20,
			windowSec: 60,
		});
		if (!allowed) throw new ApiError(429, 'rate_limited', 'Intente de nuevo en un momento.');

		const payload = await resolveGatedLocationPayload({ inviteId, eventType, slug });
		return withNoStore(successResponse(payload));
	} catch (error) {
		return withNoStore(errorResponse(error));
	}
};
