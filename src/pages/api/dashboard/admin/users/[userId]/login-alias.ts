import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, forbidden, jsonResponse } from '@/lib/rsvp/core/http';
import { updateUserLoginAliasAdmin } from '@/lib/rsvp/services/user-admin.service';
import { UpdateUserLoginAliasSchema, UuidSchema } from '@/lib/schemas';

export const PATCH: APIRoute = async ({ request, params, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(
			request,
			cookies,
			'admin:users:update_login_alias',
		);

		const userIdValidation = UuidSchema.safeParse(params.userId);
		if (!userIdValidation.success) {
			return forbidden('userId debe ser un UUID válido.');
		}
		const userId = userIdValidation.data;

		const parsed = await validateBodyOrRespond(request, UpdateUserLoginAliasSchema);
		if (parsed instanceof Response) return parsed;

		const result = await updateUserLoginAliasAdmin({
			userId,
			loginAlias: parsed.loginAlias,
			actorUserId: session.userId,
		});

		return jsonResponse(result, 200);
	} catch (error) {
		return errorResponse(error);
	}
};
