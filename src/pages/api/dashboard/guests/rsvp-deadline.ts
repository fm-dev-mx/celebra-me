import type { APIRoute } from 'astro';
import { badRequest, errorResponse, jsonResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import { requireDashboardMutationAccess } from '@/lib/rsvp/auth/authorization';
import { requireDashboardRateLimit } from '@/lib/rsvp/core/dashboard-guests-lib';
import { getEventAccessOrThrow } from '@/lib/rsvp/services/shared/dashboard-guest-context';
import { updateRsvpDeadline } from '@/lib/rsvp/services/rsvp-deadline.service';

/**
 * Host update of the event RSVP deadline. Body: `{ eventId, deadline: 'YYYY-MM-DD' | null,
 * confirmPast? }`. 400 when the date is after the event; 409 `deadline_in_past` when the
 * date is already over and `confirmPast` is not true.
 */
export const POST: APIRoute = async ({ request, locals, cookies }) => {
	try {
		const session = await requireDashboardMutationAccess(request, cookies, locals);
		await requireDashboardRateLimit(`rsvp-deadline:${session.userId}`, request);

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;
		const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
		if (!eventId) return badRequest('eventId is required.');
		if (!('deadline' in body)) return badRequest('deadline is required.');

		const event = await getEventAccessOrThrow(eventId, session.accessToken);
		const window = await updateRsvpDeadline({
			event,
			deadline: body.deadline,
			confirmPast: body.confirmPast === true,
		});
		return jsonResponse(window);
	} catch (error) {
		return errorResponse(error);
	}
};
