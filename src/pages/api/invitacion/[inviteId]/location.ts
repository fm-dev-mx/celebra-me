import type { APIRoute } from 'astro';
import { resolveGatedLocationPayload } from '@/lib/invitation/gated-location';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { sanitize } from '@/lib/rsvp/core/utils';

export const GET: APIRoute = async ({ params, url }) => {
	try {
		const inviteId = sanitize(params.inviteId, 100);
		const eventType = sanitize(url.searchParams.get('eventType'), 40);
		const slug = sanitize(url.searchParams.get('slug'), 140);

		const payload = await resolveGatedLocationPayload({ inviteId, eventType, slug });
		return successResponse(payload);
	} catch (error) {
		return errorResponse(error);
	}
};
