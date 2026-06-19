import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	getIntakeRequestsByInvitationId,
	revokeRequest,
} from '@/lib/intake/services/intake-request.service';
import { toIntakeRequestDTO } from '@/lib/dashboard/dto/intake-mapper';

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'intake:update');

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Invitation ID is required.');

		const requests = await getIntakeRequestsByInvitationId(id, 'client');
		const existingRequest = requests[0];
		if (!existingRequest) {
			throw new ApiError(404, 'not_found', 'No intake request found for this invitation.');
		}

		const revoked = await revokeRequest(existingRequest.id);
		return jsonResponse({ request: toIntakeRequestDTO(revoked) });
	} catch (error) {
		return errorResponse(error);
	}
};
