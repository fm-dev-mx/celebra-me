import type { APIRoute } from 'astro';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { ChatLeadSchema, LeadStageUpdateSchema } from '@/lib/commercial/lead-record';
import {
	createChatLead,
	searchLeadRecords,
	updateLeadStage,
} from '@/lib/commercial/lead-record.service';

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'commercial:lead-records:read');
		await requireAdminStrongSession(request);
		const query = new URL(request.url).searchParams.get('q') ?? '';
		return successResponse(await searchLeadRecords(query.slice(0, 80)));
	} catch (error) {
		return errorResponse(error);
	}
};

/** Chat route: creates a lead from a WhatsApp chat that opened with a per-ad code. */
export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'commercial:lead-records:write');
		const input = await validateBodyOrRespond(request, ChatLeadSchema);
		if (input instanceof Response) return input;
		return successResponse(await createChatLead(input), 201);
	} catch (error) {
		return errorResponse(error);
	}
};

/** Moves a lead to another stage. */
export const PATCH: APIRoute = async ({ request, cookies }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'commercial:lead-records:write');
		const input = await validateBodyOrRespond(request, LeadStageUpdateSchema);
		if (input instanceof Response) return input;
		return successResponse(await updateLeadStage(input));
	} catch (error) {
		return errorResponse(error);
	}
};
