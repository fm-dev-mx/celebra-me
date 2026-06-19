import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	getIntakeRequestsByInvitationId,
	regenerateToken,
} from '@/lib/intake/services/intake-request.service';
import { toIntakeRequestDTO } from '@/lib/dashboard/dto/intake-mapper';

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'intake:regenerate');

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Invitation ID is required.');

		const requests = await getIntakeRequestsByInvitationId(id, 'client');
		const existingRequest = requests[0];
		if (!existingRequest) {
			throw new ApiError(404, 'not_found', 'No intake request found for this invitation.');
		}

		const result = await regenerateToken(existingRequest.id);

		return jsonResponse({
			request: toIntakeRequestDTO(result.request),
			rawToken: result.rawToken,
		});
	} catch (error) {
		return errorResponse(error);
	}
};
