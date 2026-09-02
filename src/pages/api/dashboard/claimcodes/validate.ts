import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { sanitize } from '@/lib/rsvp/core/utils';
import { badRequest, errorResponse, jsonResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import { validateClaimCodeAdmin } from '@/lib/rsvp/services/claim-code-admin.service';


export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'claimcodes:validate');
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;
		const claimCode = sanitize(body.claimCode as string);
		if (!claimCode) return badRequest('claimCode is required.');
		const item = await validateClaimCodeAdmin({ claimCode });
		return jsonResponse({ item });
	} catch (error) {
		return errorResponse(error);
	}
};
