import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { loadCrmTimeline } from '@/lib/commercial/crm-timeline.service';

export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminStrongSession(request);

		const customerId = url.searchParams.get('customerId')?.trim();
		if (!customerId) {
			return errorResponse(new ApiError(400, 'bad_request', 'customerId is required.'));
		}

		const entries = await loadCrmTimeline(customerId);
		return successResponse(entries);
	} catch (error) {
		return errorResponse(error);
	}
};
