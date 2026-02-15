import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp-v2/errors';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp-v2/http';
import { checkRateLimit } from '@/lib/rsvp-v2/rateLimitProvider';
import { submitGuestRsvpByInviteId } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 500): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function getIp(request: Request): string {
	const raw =
		request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
	return sanitize(raw.split(',')[0], 100);
}

export const POST: APIRoute = async ({ params, request }) => {
	try {
		const inviteId = sanitize(params.inviteId, 100);
		if (!inviteId) return badRequest('inviteId es obligatorio.');

		const ip = getIp(request);
		const allowed = await checkRateLimit({
			namespace: 'rsvp',
			entityId: inviteId,
			ip,
			maxHits: 20,
			windowSec: 60,
		});
		if (!allowed) {
			return errorResponse(new ApiError(429, 'rate_limited', 'Demasiadas solicitudes.'));
		}

		const body = (await request.json()) as {
			attendanceStatus?: string;
			attendeeCount?: number;
			guestMessage?: string;
		};

		const attendanceStatus =
			body.attendanceStatus === 'confirmed' || body.attendanceStatus === 'declined'
				? body.attendanceStatus
				: null;
		if (!attendanceStatus) return badRequest('attendanceStatus invalido.');

		const attendeeCount = typeof body.attendeeCount === 'number' ? body.attendeeCount : 0;
		const guestMessage = sanitize(body.guestMessage, 500);

		const result = await submitGuestRsvpByInviteId(inviteId, {
			attendanceStatus,
			attendeeCount,
			guestMessage,
		});
		return jsonResponse({ message: 'RSVP guardado.', ...result });
	} catch (error) {
		return errorResponse(error);
	}
};
