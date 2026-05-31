import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp/security/csrf';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { DuplicateDemoSchema } from '@/lib/intake/schemas/invitation.schema';
import { duplicateInvitationFromDemo } from '@/lib/intake/services/invitation.service';
import { toInvitationDTO } from '@/lib/dashboard/dto/intake-mapper';

export const POST: APIRoute = async ({ request, params, cookies }) => {
	try {
		await requireAdminRateLimit(request, 'intake:create');
		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}
		const session = await requireAdminStrongSession(request);

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
