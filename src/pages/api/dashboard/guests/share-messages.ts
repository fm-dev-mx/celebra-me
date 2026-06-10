import type { APIRoute } from 'astro';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import { updateShareMessages } from '@/lib/rsvp/services/dashboard-guests.service';
import { requireDashboardRateLimit } from '@/pages/api/dashboard/guests/dashboard-guests-lib';
import {
	DEFAULT_INVITATION_MESSAGE,
	DEFAULT_REMINDER_MESSAGE,
} from '@/lib/rsvp/services/shared/share-message-defaults';

export const POST: APIRoute = async ({ request, locals }) => {
	try {
		const session = requireDashboardSessionFromLocals(locals);
		await requireDashboardRateLimit(`share-messages:${session.userId}`, request);

		const body = await request.json();
		const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
		if (!eventId) return badRequest('eventId is required.');

		const invitation = typeof body.invitation === 'string' ? body.invitation.trim() : '';
		const reminder = typeof body.reminder === 'string' ? body.reminder.trim() : '';

		if (invitation && invitation.length > 500) {
			return badRequest('Invitation message must be 500 characters or fewer.');
		}
		if (reminder && reminder.length > 500) {
			return badRequest('Reminder message must be 500 characters or fewer.');
		}

		const result = await updateShareMessages({
			eventId,
			hostAccessToken: session.accessToken,
			shareMessages: {
				invitation: invitation || DEFAULT_INVITATION_MESSAGE,
				reminder: reminder || DEFAULT_REMINDER_MESSAGE,
			},
		});

		return jsonResponse(result);
	} catch (error) {
		return errorResponse(error);
	}
};
