import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { canChangeUserRole } from '@/lib/rsvp/security/admin-protection';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, forbidden, jsonResponse } from '@/lib/rsvp/core/http';
import { changeUserRoleAdmin } from '@/lib/rsvp/services/user-admin.service';
import { UpdateUserRoleSchema, UuidSchema } from '@/lib/schemas';

export const PATCH: APIRoute = async ({ request, params, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(request, cookies, 'admin:role');

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
