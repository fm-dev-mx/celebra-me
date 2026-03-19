import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { updateEventAdmin } from '@/lib/rsvp/services/event-admin.service';
import { UpdateEventSchema, UuidSchema } from '@/lib/schemas';

export const PATCH: APIRoute = async ({ params, request }) => {
	try {
		await requireAdminRateLimit(request, 'admin:update');
		const session = await requireAdminStrongSession(request);

		const eventIdValidation = UuidSchema.safeParse(params.eventId);
		if (!eventIdValidation.success) {
			return badRequest('eventId debe ser un UUID válido.');
		}
		const eventId = eventIdValidation.data;

		const parsed = await validateBodyOrRespond(request, UpdateEventSchema);
		if (parsed instanceof Response) return parsed;

		const updatedEvent = await updateEventAdmin({
			eventId,
			title: parsed.title,
			slug: parsed.slug,
			eventType: parsed.eventType,
			status: parsed.status,
			actorUserId: session.userId,
		});

		return jsonResponse({ item: updatedEvent });
	} catch (error) {
		return errorResponse(error);
	}
};
