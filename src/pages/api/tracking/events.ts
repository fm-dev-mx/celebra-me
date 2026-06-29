import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, getIp, parseJsonBody, successResponse } from '@/lib/rsvp/core/http';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { ingestTrackingEvent } from '@/lib/tracking/ingestion.service';

export const POST: APIRoute = async ({ request }) => {
	try {
		const allowed = await checkRateLimit({
			namespace: 'tracking',
			entityId: 'events',
			ip: getIp(request),
			maxHits: 120,
			windowSec: 60,
		});

		if (!allowed) {
			return errorResponse(new ApiError(429, 'rate_limited', 'Too many tracking events.'));
		}

		const payload = await parseJsonBody(request);
		if (payload instanceof Response) return payload;

		const result = await ingestTrackingEvent({
			request,
			vercelEnv: process.env.VERCEL_ENV,
			payload,
		});

		return successResponse(result, result.accepted ? 201 : 202);
	} catch (error) {
		return errorResponse(error);
	}
};
