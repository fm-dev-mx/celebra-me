import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { badRequest, errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { parseInviteGuestRsvpRequest } from '@/lib/rsvp/core/rsvp-request';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { submitGuestRsvpByInviteId } from '@/lib/rsvp/services/rsvp-submission.service';
import { sanitize } from '@/lib/rsvp/core/utils';

function getIp(request: Request): string {
	const raw =
		request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
	return sanitize(raw.split(',')[0], 100);
}

export const POST: APIRoute = async ({ params, request }) => {
	try {
		const inviteId = sanitize(params.inviteId, 100);
		if (!inviteId) return badRequest('inviteId is required.');

		const payload = await parseInviteGuestRsvpRequest(request);
		if (payload instanceof Response) return payload;

		const ip = getIp(request);
		const allowed = await checkRateLimit({
			namespace: 'rsvp',
			entityId: inviteId,
			ip,
			maxHits: 20,
			windowSec: 60,
		});
		if (!allowed) {
			return errorResponse(new ApiError(429, 'rate_limited', 'Too many requests.'));
		}

		const result = await submitGuestRsvpByInviteId(inviteId, payload);
		return successResponse({ message: 'RSVP saved.', ...result });
	} catch (error) {
		return errorResponse(error);
	}
};
