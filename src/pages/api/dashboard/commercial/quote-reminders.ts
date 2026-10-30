import type { APIRoute } from 'astro';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { QuoteReminderSchema } from '@/lib/commercial/quote-reminders';
import { loadQuoteReminders, prepareQuoteReminder } from '@/lib/commercial/quote-reminders.service';

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'commercial:quote-reminders:read');
		await requireAdminStrongSession(request);
		return successResponse(await loadQuoteReminders());
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(
			request,
			cookies,
			'commercial:quote-reminders:write',
		);
		const input = await validateBodyOrRespond(request, QuoteReminderSchema);
		if (input instanceof Response) return input;
		return successResponse(await prepareQuoteReminder(input, session.userId));
	} catch (error) {
		return errorResponse(error);
	}
};
