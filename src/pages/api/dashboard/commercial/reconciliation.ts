import type { APIRoute } from 'astro';
import { z } from 'zod';
import { findCommercialIdentityCandidates } from '@/lib/commercial/reconciliation.service';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { validateQueryOrRespond } from '@/lib/rsvp/core/validation';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';

const CommercialReconciliationQuerySchema = z.object({
	leadCode: z.string().trim().max(40).optional(),
	phone: z.string().trim().max(60).optional(),
	email: z.email().optional(),
	name: z.string().trim().max(160).optional(),
	eventType: z.string().trim().max(80).optional(),
	packageInterest: z.string().trim().max(80).optional(),
});

export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminRateLimit(request, 'commercial:reconciliation');
		await requireAdminStrongSession(request);

		const parsed = validateQueryOrRespond(
			url.searchParams,
			CommercialReconciliationQuerySchema,
		);
		if (parsed instanceof Response) return parsed;

		const candidates = await findCommercialIdentityCandidates({
			leadCode: parsed.leadCode,
			phone: parsed.phone,
			email: parsed.email,
			name: parsed.name,
			eventType: parsed.eventType,
			packageInterest: parsed.packageInterest,
		});

		return successResponse(candidates);
	} catch (error) {
		return errorResponse(error);
	}
};
