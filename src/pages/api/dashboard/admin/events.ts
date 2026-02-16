import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp-v2/authorization';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp-v2/http';
import { listAdminEvents, createEventAdmin } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminStrongSession(request);
		const items = await listAdminEvents();
		return jsonResponse({ items });
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		const session = await requireAdminStrongSession(request);

		const body = (await request.json()) as {
			title?: string;
			slug?: string;
			eventType?: string;
			status?: string;
		};

		const title = sanitize(body.title, 140);
		const slug = sanitize(body.slug, 120);
		const eventType = sanitize(body.eventType, 20) as 'xv' | 'boda' | 'bautizo' | 'cumple' | '';
		const status = sanitize(body.status, 20) as 'draft' | 'published' | 'archived' | '';

		if (!title || !slug || !eventType) {
			return badRequest('title, slug y eventType son obligatorios.');
		}

		if (!['xv', 'boda', 'bautizo', 'cumple'].includes(eventType)) {
			return badRequest('eventType debe ser uno de: xv, boda, bautizo, cumple');
		}

		const validStatus =
			status && ['draft', 'published', 'archived'].includes(status) ? status : 'draft';

		const newEvent = await createEventAdmin({
			title,
			slug,
			eventType: eventType as 'xv' | 'boda' | 'bautizo' | 'cumple',
			status: validStatus,
			actorUserId: session.userId,
		});

		return jsonResponse({ item: newEvent }, 201);
	} catch (error) {
		return errorResponse(error);
	}
};
