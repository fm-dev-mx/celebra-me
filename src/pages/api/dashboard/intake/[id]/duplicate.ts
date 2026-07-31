import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { DuplicateDemoSchema } from '@/lib/intake/schemas/invitation.schema';
import { rejectDashboardClientInvitationCreation } from '@/lib/intake/services/dashboard-client-creation-policy';

export const POST: APIRoute = async ({ request, params, cookies }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'intake:create');

		const invitationId = params.id;
		if (!invitationId) {
			throw new ApiError(400, 'bad_request', 'Invitation ID is required.');
		}

		const parsed = await validateBodyOrRespond(request, DuplicateDemoSchema);
		if (parsed instanceof Response) return parsed;

		void parsed;
		rejectDashboardClientInvitationCreation({ via: 'duplicate' });
	} catch (error) {
		return errorResponse(error);
	}
};
