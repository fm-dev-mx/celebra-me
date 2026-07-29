import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { resetUserPasswordAdmin } from '@/lib/rsvp/services/user-admin.service';
import { ResetUserPasswordSchema } from '@/lib/schemas';

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(request, cookies, 'admin:users:reset_password');

		const parsed = await validateBodyOrRespond(request, ResetUserPasswordSchema);
		if (parsed instanceof Response) return parsed;

		const result = await resetUserPasswordAdmin({
			userId: parsed.userId,
			actorUserId: session.userId,
		});

		return jsonResponse(result, 200);
	} catch (error) {
		return errorResponse(error);
	}
};
