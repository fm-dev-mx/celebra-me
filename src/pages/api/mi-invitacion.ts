import type { APIRoute } from 'astro';
import { z } from 'zod';
import { loadInvitationDataForm, saveInvitationDataForm } from '@/lib/invitation-data/service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, getIp, parseJsonBody, successResponse } from '@/lib/rsvp/core/http';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { resolveAfterResponseContext } from '@/lib/server/platform-request';

export const prerender = false;

// The answers object is capped at 32 KB in the database; leave room for the envelope.
const MAX_BODY_BYTES = 48 * 1024;

const RequestSchema = z.object({
	token: z.string().max(64),
	action: z.enum(['load', 'save', 'submit']),
	answers: z.unknown().optional(),
});

/**
 * «Datos de su invitación»: loads, autosaves and submits the private form behind
 * `/mi-invitacion/<token>`. The token travels in the body so it stays out of request logs.
 */
export const POST: APIRoute = async ({ request, locals }) => {
	try {
		const allowed = await checkRateLimit({
			namespace: 'tracking',
			entityId: 'invitation-data',
			ip: getIp(request),
			maxHits: 120,
			windowSec: 60,
		});
		if (!allowed) {
			return errorResponse(
				new ApiError(
					429,
					'rate_limited',
					'Recibimos muchas solicitudes. Intente de nuevo en un minuto.',
				),
			);
		}

		const payload = await parseJsonBody(request, MAX_BODY_BYTES);
		if (payload instanceof Response) return payload;
		const parsed = RequestSchema.safeParse(payload);
		if (!parsed.success) {
			return errorResponse(new ApiError(400, 'bad_request', 'Solicitud no válida.'));
		}

		const { token, action, answers } = parsed.data;
		if (action === 'load') {
			return successResponse(await loadInvitationDataForm({ token }));
		}
		const state = await saveInvitationDataForm(
			{ token, answers: answers ?? {}, submit: action === 'submit' },
			{ after: resolveAfterResponseContext(locals) },
		);
		return successResponse(state);
	} catch (error) {
		return errorResponse(error);
	}
};
