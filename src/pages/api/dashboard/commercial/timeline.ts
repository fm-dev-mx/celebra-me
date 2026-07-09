import type { APIRoute } from 'astro';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { loadCrmTimeline } from '@/lib/commercial/crm-timeline.service';

export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminStrongSession(request);

		const customerId = url.searchParams.get('customerId')?.trim();
		if (!customerId) {
			return errorResponse({ success: false, error: { code: 'bad_request', message: 'customerId is required.' } });
		}

		const entries = await loadCrmTimeline(customerId);
		return successResponse(entries);
	} catch (error) {
		return errorResponse(error);
	}
};
