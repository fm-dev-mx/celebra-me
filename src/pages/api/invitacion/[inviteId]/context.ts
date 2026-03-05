import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/errors';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp/http';
import { checkRateLimit } from '@/lib/rsvp/rate-limit-provider';
import { getInvitationContextByInviteId } from '@/lib/rsvp/service';

function sanitize(value: unknown, maxLen = 100): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function getIp(request: Request): string {
	const raw =
		request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
	return sanitize(raw.split(',')[0], 100);
}

export const GET: APIRoute = async ({ params, request }) => {
	try {
		const inviteId = sanitize(params.inviteId, 100);
		if (!inviteId) return badRequest('inviteId es obligatorio.');

		const ip = getIp(request);
		const allowed = await checkRateLimit({
			namespace: 'ctx',
			entityId: inviteId,
			ip,
			maxHits: 60,
			windowSec: 60,
		});
		if (!allowed) {
			return errorResponse(new ApiError(429, 'rate_limited', 'Demasiadas solicitudes.'));
		}

		const context = await getInvitationContextByInviteId(inviteId);
		return jsonResponse(context);
	} catch (error) {
		return errorResponse(error);
	}
};
