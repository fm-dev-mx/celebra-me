import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp-v2/authorization';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp-v2/http';
import { updateEventAdmin } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const PATCH: APIRoute = async ({ params, request }) => {
	try {
		const session = await requireAdminStrongSession(request);

		const eventId = sanitize(params.eventId, 120);
		if (!eventId) return badRequest('eventId es obligatorio.');

		const body = (await request.json()) as {
			title?: string;
			slug?: string;
			eventType?: string;
			status?: string;
		};

		const title = body.title !== undefined ? sanitize(body.title, 140) : undefined;
		const slug = body.slug !== undefined ? sanitize(body.slug, 120) : undefined;
		const eventType =
			body.eventType !== undefined
				? (sanitize(body.eventType, 20) as 'xv' | 'boda' | 'bautizo' | 'cumple' | undefined)
				: undefined;
		const status =
			body.status !== undefined
				? (sanitize(body.status, 20) as 'draft' | 'published' | 'archived' | undefined)
				: undefined;

		if (eventType && !['xv', 'boda', 'bautizo', 'cumple'].includes(eventType)) {
			return badRequest('eventType debe ser uno de: xv, boda, bautizo, cumple');
		}

		if (status && !['draft', 'published', 'archived'].includes(status)) {
			return badRequest('status debe ser uno de: draft, published, archived');
		}

		const updatedEvent = await updateEventAdmin({
			eventId,
			title,
			slug,
			eventType,
			status,
			actorUserId: session.userId,
		});

		return jsonResponse({ item: updatedEvent });
	} catch (error) {
		return errorResponse(error);
	}
};
