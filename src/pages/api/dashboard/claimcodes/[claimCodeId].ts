import type { APIRoute } from 'astro';
import { requireAdminSession } from '@/lib/rsvp-v2/authorization';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp-v2/http';
import { disableClaimCodeAdmin, updateClaimCodeAdmin } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const PATCH: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminSession(request);
		const claimCodeId = sanitize(params.claimCodeId, 120);
		if (!claimCodeId) return badRequest('claimCodeId es obligatorio.');
		const body = (await request.json()) as {
			active?: boolean;
			expiresAt?: string | null;
			maxUses?: number;
		};
		const item = await updateClaimCodeAdmin({
			claimCodeId,
			active: typeof body.active === 'boolean' ? body.active : undefined,
			expiresAt: body.expiresAt,
			maxUses: typeof body.maxUses === 'number' ? body.maxUses : undefined,
		});
		return jsonResponse({ item });
	} catch (error) {
		return errorResponse(error);
	}
};

export const DELETE: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminSession(request);
		const claimCodeId = sanitize(params.claimCodeId, 120);
		if (!claimCodeId) return badRequest('claimCodeId es obligatorio.');
		const item = await disableClaimCodeAdmin({ claimCodeId });
		return jsonResponse({ item });
	} catch (error) {
		return errorResponse(error);
	}
};
