import type { APIRoute } from 'astro';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { sanitize } from '@/lib/rsvp/core/utils';
import { requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import { markGuestShared } from '@/lib/rsvp/services/dashboard-guests.service';
import { requireDashboardRateLimit } from '@/pages/api/dashboard/guests/dashboard-guests-lib';

export const POST: APIRoute = async ({ params, request, url, locals }) => {
	try {
		const session = requireDashboardSessionFromLocals(locals);
		await requireDashboardRateLimit(`share:${session.userId}`, request);

		const guestId = sanitize(params.guestId, 120);
		if (!guestId) return badRequest('guestId is required.');

		const result = await markGuestShared({
			guestId,
			hostAccessToken: session.accessToken,
			origin: url.origin,
			actorUserId: session.userId,
			isSuperAdmin: session.isSuperAdmin,
		});

		return jsonResponse(result);
	} catch (error) {
		return errorResponse(error);
	}
};
