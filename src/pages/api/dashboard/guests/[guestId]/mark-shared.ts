import type { APIRoute } from 'astro';
import { getSessionContextFromRequest } from '@/lib/rsvp/auth/auth';
import { ApiError } from '@/lib/rsvp/core/errors';
import { badRequest, errorResponse, getIp, jsonResponse } from '@/lib/rsvp/core/http';
import { sanitize } from '@/lib/rsvp/core/utils';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { markGuestShared } from '@/lib/rsvp/services/dashboard-guests.service';

export const POST: APIRoute = async ({ params, request, url }) => {
	try {
		const session = await getSessionContextFromRequest(request);
		if (!session) {
			throw new ApiError(
				401,
				'unauthorized',
				'No tienes autorización para realizar esta acción.',
			);
		}
		const allowed = await checkRateLimit({
			namespace: 'dashboard',
			entityId: `share:${session.userId}`,
			ip: getIp(request),
			maxHits: 30,
			windowSec: 60,
		});
		if (!allowed) {
			throw new ApiError(429, 'rate_limited', 'Too many requests.');
		}

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
