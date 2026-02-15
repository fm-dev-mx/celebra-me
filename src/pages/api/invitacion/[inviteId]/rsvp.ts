import type { APIRoute } from 'astro';
import { badRequest, jsonResponse } from '@/lib/rsvp-v2/http';
import { checkRateLimit } from '@/lib/rsvp-v2/rateLimit';
import { submitGuestRsvpByInviteId } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 500): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function getIp(request: Request): string {
	return sanitize(
		request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
		100,
	);
}

export const POST: APIRoute = async ({ params, request }) => {
	try {
		const inviteId = sanitize(params.inviteId, 100);
		if (!inviteId) return badRequest('inviteId es obligatorio.');

		const ip = getIp(request);
		if (!checkRateLimit(`rsvp:${inviteId}:${ip}`, 20, 60_000)) {
			return jsonResponse({ message: 'Demasiadas solicitudes.' }, 429);
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
		const message = error instanceof Error ? error.message : 'Error interno del servidor.';
		const status =
			message.includes('invalido') ||
			message.includes('limite') ||
			message.includes('requiere')
				? 400
				: message.includes('no encontrada')
					? 404
					: 500;
		return jsonResponse({ message }, status);
	}
};
