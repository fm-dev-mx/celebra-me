import type { APIRoute } from 'astro';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import { updateShareMessages } from '@/lib/rsvp/services/dashboard-guests.service';
import { requireDashboardRateLimit } from '@/pages/api/dashboard/guests/dashboard-guests-lib';
import { reminderSettingsSchema } from '@/lib/schemas/content/shared.schema';
import type { ReminderSettings } from '@/lib/rsvp/services/shared/share-message-defaults';

function parseReminderSettings(raw: unknown): ReminderSettings | null | 'invalid' {
	if (raw === undefined || raw === null) return null;
	const result = reminderSettingsSchema.safeParse(raw);
	if (!result.success) return 'invalid';
	return result.data;
}

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
			return badRequest('El mensaje de invitación no puede superar los 500 caracteres.');
		}
		if (reminder && reminder.length > 500) {
			return badRequest('El mensaje de recordatorio no puede superar los 500 caracteres.');
		}

		const parsed = parseReminderSettings(body.reminderSettings);
		if (parsed === 'invalid') {
			return badRequest('Configuración de recordatorios no válida.');
		}

		const result = await updateShareMessages({
			eventId,
			hostAccessToken: session.accessToken,
			shareMessages: { invitation, reminder },
			reminderSettings: parsed,
		});

		return jsonResponse(result);
	} catch (error) {
		return errorResponse(error);
	}
};
