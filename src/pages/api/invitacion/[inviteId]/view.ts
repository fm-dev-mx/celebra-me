import type { APIRoute } from 'astro';
import { badRequest, jsonResponse } from '@/lib/rsvp-v2/http';
import { checkRateLimit } from '@/lib/rsvp-v2/rateLimit';
import { trackInvitationView } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 200): string {
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
		if (!checkRateLimit(`view:${inviteId}:${ip}`, 60, 60_000)) {
			return jsonResponse({ message: 'Demasiadas solicitudes.' }, 429);
		}

		await trackInvitationView(inviteId);
		return jsonResponse({ message: 'Vista registrada.' });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Error interno del servidor.';
		const status = message.includes('no encontrada') ? 404 : 500;
		return jsonResponse({ message }, status);
	}
};
