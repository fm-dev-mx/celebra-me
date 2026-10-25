import type { APIRoute } from 'astro';
import { z } from 'zod';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, getIp, parseJsonBody, successResponse } from '@/lib/rsvp/core/http';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { CONSENT_DECIDED_AT_PATTERN } from '@/lib/tracking/consent-policy';
import { withdrawVisitorMarketingConsent } from '@/lib/tracking/repository';

/**
 * Marketing consent withdrawal. It needs no analytics or marketing consent: it only ever
 * removes consent, so the server stops sending this visitor's queued conversions to Meta.
 */
const ConsentWithdrawalSchema = z
	.object({
		visitorId: z.string().trim().min(6).max(120),
		analytics: z.boolean(),
		decidedAt: z.string().regex(CONSENT_DECIDED_AT_PATTERN),
	})
	.strict();

export const POST: APIRoute = async ({ request }) => {
	try {
		const allowed = await checkRateLimit({
			namespace: 'tracking',
			entityId: 'consent',
			ip: getIp(request),
			maxHits: 20,
			windowSec: 60,
		});

		if (!allowed) {
			return errorResponse(new ApiError(429, 'rate_limited', 'Too many consent updates.'));
		}

		const body = await parseJsonBody(request);
		if (body instanceof Response) return body;

		const parsed = ConsentWithdrawalSchema.safeParse(body);
		if (!parsed.success) {
			throw new ApiError(400, 'bad_request', 'Invalid consent withdrawal.');
		}

		await withdrawVisitorMarketingConsent(parsed.data);
		return successResponse({ withdrawn: true });
	} catch (error) {
		return errorResponse(error);
	}
};
