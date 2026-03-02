import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/adminRateLimit';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp/csrf';
import { canChangeUserRole } from '@/lib/rsvp/adminProtection';
import { validateBodyOrRespond } from '@/lib/rsvp/validation';
import { errorResponse, forbidden, jsonResponse } from '@/lib/rsvp/http';
import { changeUserRoleAdmin } from '@/lib/rsvp/service';
import { UpdateUserRoleSchema, UuidSchema } from '@/lib/schemas';

export const PATCH: APIRoute = async ({ request, params, cookies }) => {
	try {
		await requireAdminRateLimit(request, 'admin:role');

		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}

		const session = await requireAdminStrongSession(request);

		const userIdValidation = UuidSchema.safeParse(params.userId);
		if (!userIdValidation.success) {
			return forbidden('userId debe ser un UUID válido.');
		}
		const userId = userIdValidation.data;

		const parsed = await validateBodyOrRespond(request, UpdateUserRoleSchema);
		if (parsed instanceof Response) return parsed;

		const canChange = await canChangeUserRole(userId, parsed.role);
		if (!canChange.allowed) {
			return forbidden(canChange.reason || 'No se puede cambiar el rol de este usuario');
		}

		const item = await changeUserRoleAdmin({
			userId,
			role: parsed.role,
			actorUserId: session.userId,
		});
		return jsonResponse({ item });
	} catch (error) {
		return errorResponse(error);
	}
};
