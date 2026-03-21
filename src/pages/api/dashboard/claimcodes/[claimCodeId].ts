import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { badRequest, errorResponse, jsonResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import {
	disableClaimCodeAdmin,
	updateClaimCodeAdmin,
} from '@/lib/rsvp/services/claim-code-admin.service';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const PATCH: APIRoute = async ({ request, params }) => {
	try {
		// Rate limiting: 30 req/min para actualizaciones
		await requireAdminRateLimit(request, 'claimcodes:update');
		await requireAdminStrongSession(request);
		const claimCodeId = sanitize(params.claimCodeId, 120);
		if (!claimCodeId) return badRequest('claimCodeId es obligatorio.');
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

export const DELETE: APIRoute = async ({ request, params }) => {
	try {
		// Rate limiting: 10 req/min para eliminaciones
		await requireAdminRateLimit(request, 'claimcodes:delete');
		await requireAdminStrongSession(request);
		const claimCodeId = sanitize(params.claimCodeId, 120);
		if (!claimCodeId) return badRequest('claimCodeId es obligatorio.');
		const item = await disableClaimCodeAdmin({ claimCodeId });
		return jsonResponse({ item });
	} catch (error) {
		return errorResponse(error);
	}
};
