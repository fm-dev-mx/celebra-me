import type { APIRoute } from 'astro';
import { badRequest, errorResponse, jsonResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import { sanitize } from '@/lib/rsvp/core/utils';
import { requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import { toggleGuestBrandingRemoval } from '@/lib/rsvp/services/dashboard-guests.service';
import { requireDashboardRateLimit } from '@/pages/api/dashboard/guests/dashboard-guests-lib';

export const POST: APIRoute = async ({ params, request, url, locals }) => {
	try {
		const session = requireDashboardSessionFromLocals(locals);
		await requireDashboardRateLimit(`toggle-branding:${session.userId}`, request);

		const guestId = sanitize(params.guestId, 120);
		if (!guestId) return badRequest('guestId is required.');

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;

		if (typeof body.hideCelebraMeBranding !== 'boolean') {
			return badRequest('hideCelebraMeBranding must be a boolean.');
		}

		const result = await toggleGuestBrandingRemoval({
			guestId,
			hostAccessToken: session.accessToken,
			origin: url.origin,
			actorUserId: session.userId,
			isSuperAdmin: session.isSuperAdmin,
			hideCelebraMeBranding: body.hideCelebraMeBranding,
		});

		return jsonResponse(result);
	} catch (error) {
		return errorResponse(error);
	}
};
