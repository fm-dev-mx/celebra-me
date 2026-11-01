import type { APIRoute } from 'astro';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { LeadAdCodeSchema } from '@/lib/commercial/lead-record';
import { listAdCodes, upsertAdCode } from '@/lib/commercial/lead-record.service';

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'commercial:lead-records:read');
		await requireAdminStrongSession(request);
		return successResponse(await listAdCodes());
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'commercial:lead-ad-codes:write');
		const input = await validateBodyOrRespond(request, LeadAdCodeSchema);
		if (input instanceof Response) return input;
		return successResponse(await upsertAdCode(input));
	} catch (error) {
		return errorResponse(error);
	}
};
