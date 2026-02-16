import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp-v2/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp-v2/adminRateLimit';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp-v2/http';
import { changeUserRoleAdmin } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 120): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const PATCH: APIRoute = async ({ request, params }) => {
	try {
		// Rate limiting: 5 req/min para cambios de rol (muy restrictivo)
		await requireAdminRateLimit(request, 'admin:role');
		const session = await requireAdminStrongSession(request);
		const userId = sanitize(params.userId);
		if (!userId) return badRequest('userId es obligatorio.');
		const body = (await request.json()) as { role?: string };
		const role = body.role === 'super_admin' ? 'super_admin' : 'host_client';
		const item = await changeUserRoleAdmin({
			userId,
			role,
			actorUserId: session.userId,
		});
		return jsonResponse({ item });
	} catch (error) {
		return errorResponse(error);
	}
};
