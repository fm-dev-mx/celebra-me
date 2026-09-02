import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { sanitize } from '@/lib/rsvp/core/utils';
import { badRequest, errorResponse, jsonResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import {
	disableClaimCodeAdmin,
	updateClaimCodeAdmin,
} from '@/lib/rsvp/services/claim-code-admin.service';


export const PATCH: APIRoute = async ({ request, params, cookies }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'claimcodes:update');
		const claimCodeId = sanitize(params.claimCodeId, 120);
		if (!claimCodeId) return badRequest('claimCodeId is required.');
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;
		const item = await updateClaimCodeAdmin({
			claimCodeId,
			active: typeof body.active === 'boolean' ? body.active : undefined,
			expiresAt: body.expiresAt as string | null | undefined,
			maxUses: typeof body.maxUses === 'number' ? body.maxUses : undefined,
		});
		return jsonResponse({ item });
	} catch (error) {
		return errorResponse(error);
	}
};

export const DELETE: APIRoute = async ({ request, params, cookies }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'claimcodes:delete');
		const claimCodeId = sanitize(params.claimCodeId, 120);
		if (!claimCodeId) return badRequest('claimCodeId is required.');
		const item = await disableClaimCodeAdmin({ claimCodeId });
		return jsonResponse({ item });
	} catch (error) {
		return errorResponse(error);
	}
};
