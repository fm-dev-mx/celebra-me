import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { assignInvitationOwnerService } from '@/lib/intake/services/invitation.service';

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		const session = await requireAdminMutationAccess(request, cookies, 'intake:assign-owner');

		const { id } = params;
		if (!id) {
			throw new ApiError(400, 'bad_request', 'Invitation ID is required.');
		}

		const invitation = await assignInvitationOwnerService(id, session.userId);

		console.info(`[assign-owner] User ${session.userId} assigned as owner of invitation ${id}`);
		return jsonResponse({ invitation });
	} catch (error) {
		if (error instanceof ApiError && error.status < 500) {
			console.warn(`[assign-owner] Expected error: ${error.code} — ${error.message}`);
		} else {
			console.error(`[assign-owner] Unexpected error:`, error);
		}
		return errorResponse(error);
	}
};
