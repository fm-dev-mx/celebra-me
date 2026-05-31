import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp/security/csrf';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	getIntakeRequestsByProjectId,
	regenerateToken,
} from '@/lib/intake/services/intake-request.service';
import { toIntakeRequestDTO } from '@/lib/dashboard/dto/intake-mapper';

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:regenerate');

		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}

		await requireAdminStrongSession(request);

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Project ID is required.');

		const requests = await getIntakeRequestsByProjectId(id, 'client');
		const existingRequest = requests[0];
		if (!existingRequest) {
			throw new ApiError(404, 'not_found', 'No intake request found for this project.');
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
