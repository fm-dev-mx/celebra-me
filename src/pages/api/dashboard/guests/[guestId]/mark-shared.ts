import type { APIRoute } from 'astro';
import { getSessionContextFromRequest } from '@/lib/rsvp-v2/auth';
import { ApiError } from '@/lib/rsvp-v2/errors';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp-v2/http';
import { checkRateLimit } from '@/lib/rsvp-v2/rateLimitProvider';
import { markGuestShared } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function getIp(request: Request): string {
	const raw =
		request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
	return sanitize(raw.split(',')[0], 100);
}

export const POST: APIRoute = async ({ params, request, url }) => {
	try {
		const session = await getSessionContextFromRequest(request);
		if (!session) {
			throw new ApiError(401, 'unauthorized', 'No autorizado.');
		}
		const allowed = await checkRateLimit({
			namespace: 'dashboard',
			entityId: `share:${session.userId}`,
			ip: getIp(request),
			maxHits: 30,
			windowSec: 60,
		});
		if (!allowed) {
			throw new ApiError(429, 'rate_limited', 'Demasiadas solicitudes.');
		}

		const guestId = sanitize(params.guestId, 120);
		if (!guestId) return badRequest('guestId es obligatorio.');

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
