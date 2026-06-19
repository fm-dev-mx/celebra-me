import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, forbidden, jsonResponse } from '@/lib/rsvp/core/http';
import { updateUserEventMembershipAdmin } from '@/lib/rsvp/services/user-admin.service';
import { UpdateUserEventMembershipSchema, UuidSchema } from '@/lib/schemas';

export const PATCH: APIRoute = async ({ request, params, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(request, cookies, 'admin:user-membership');

		const userIdValidation = UuidSchema.safeParse(params.userId);
		if (!userIdValidation.success) {
			return forbidden('userId debe ser un UUID válido.');
		}

		const parsed = await validateBodyOrRespond(request, UpdateUserEventMembershipSchema);
		if (parsed instanceof Response) return parsed;

		const item = await updateUserEventMembershipAdmin({
			userId: userIdValidation.data,
			eventId: parsed.eventId,
			action: parsed.action,
			membershipRole: parsed.membershipRole,
			actorUserId: session.userId,
		});
		return jsonResponse({ item });
	} catch (error) {
		return errorResponse(error);
	}
};
