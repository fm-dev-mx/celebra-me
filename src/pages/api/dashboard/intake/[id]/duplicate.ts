import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { DuplicateDemoSchema } from '@/lib/intake/schemas/invitation.schema';
import { duplicateInvitationFromDemo } from '@/lib/intake/services/invitation.service';
import { toInvitationDTO } from '@/lib/dashboard/dto/intake-mapper';

export const POST: APIRoute = async ({ request, params, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(request, cookies, 'intake:create');

		const invitationId = params.id;
		if (!invitationId) {
			throw new ApiError(400, 'bad_request', 'Invitation ID is required.');
		}

		const parsed = await validateBodyOrRespond(request, DuplicateDemoSchema);
		if (parsed instanceof Response) return parsed;

		const invitation = await duplicateInvitationFromDemo(invitationId, {
			...parsed,
			createdBy: session.userId,
		});

		return jsonResponse({ item: toInvitationDTO(invitation) }, 201);
	} catch (error) {
		return errorResponse(error);
	}
};
