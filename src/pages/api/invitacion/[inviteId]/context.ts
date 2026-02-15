import type { APIRoute } from 'astro';
import { badRequest, jsonResponse } from '@/lib/rsvp-v2/http';
import { checkRateLimit } from '@/lib/rsvp-v2/rateLimit';
import { getInvitationContextByInviteId } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 100): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function getIp(request: Request): string {
	return sanitize(
		request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
		100,
	);
}

export const GET: APIRoute = async ({ params, request }) => {
	try {
		const inviteId = sanitize(params.inviteId, 100);
		if (!inviteId) return badRequest('inviteId es obligatorio.');

		const ip = getIp(request);
		if (!checkRateLimit(`ctx:${inviteId}:${ip}`, 40, 60_000)) {
			return jsonResponse({ message: 'Demasiadas solicitudes.' }, 429);
		}

		const context = await getInvitationContextByInviteId(inviteId);
		return jsonResponse(context);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Error interno del servidor.';
		const status =
			message.includes('no encontrada') || message.includes('no encontrado') ? 404 : 500;
		return jsonResponse({ message }, status);
	}
};
