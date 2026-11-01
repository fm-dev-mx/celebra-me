import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { loadCrmTimeline } from '@/lib/commercial/crm-timeline.service';
import { loadQuoteReminderTimeline } from '@/lib/commercial/quote-reminders.service';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { z } from 'zod';

export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminRateLimit(request, 'commercial:quote-reminders:read');
		await requireAdminStrongSession(request);
		const leadId = url.searchParams.get('leadId');
		if (leadId) {
			if (!z.uuid().safeParse(leadId).success)
				throw new ApiError(
					400,
					'bad_request',
					'El identificador del prospecto no es válido.',
				);
			return successResponse(await loadQuoteReminderTimeline({ leadId }));
		}

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
