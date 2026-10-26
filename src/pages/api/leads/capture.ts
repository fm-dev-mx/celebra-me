import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, getIp, parseJsonBody, successResponse } from '@/lib/rsvp/core/http';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { readHostedDeployEnvironment } from '@/lib/server/deploy-identity';
import { submitLeadCapture } from '@/lib/tracking/lead-capture.service';

export const prerender = false;

/** «Aparta su fecha»: the short form the landing and demo pages show before WhatsApp. */
export const POST: APIRoute = async ({ request }) => {
	try {
		const allowed = await checkRateLimit({
			namespace: 'tracking',
			entityId: 'lead-capture',
			ip: getIp(request),
			maxHits: 10,
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

		const payload = await parseJsonBody(request);
		if (payload instanceof Response) return payload;

		const result = await submitLeadCapture({
			request,
			deployEnvironment: readHostedDeployEnvironment(),
			payload,
		});

		// A dropped bot submission answers like a stored one.
		return successResponse({ leadCode: result.leadCode }, 201);
	} catch (error) {
		return errorResponse(error);
	}
};
