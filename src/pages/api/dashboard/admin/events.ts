import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp-v2/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp-v2/adminRateLimit';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp-v2/csrf';
import { validateBodyOrRespond } from '@/lib/rsvp-v2/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp-v2/http';
import { listAdminEvents, createEventAdmin } from '@/lib/rsvp-v2/service';
import { CreateEventSchema } from '@/lib/schemas';

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'admin:list');
		await requireAdminStrongSession(request);
		const items = await listAdminEvents();
		return jsonResponse({ items });
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		await requireAdminRateLimit(request, 'admin:create');

		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}

		const session = await requireAdminStrongSession(request);

		const parsed = await validateBodyOrRespond(request, CreateEventSchema);
		if (parsed instanceof Response) return parsed;

		const newEvent = await createEventAdmin({
			title: parsed.title,
			slug: parsed.slug,
			eventType: parsed.eventType,
			status: parsed.status ?? 'draft',
			actorUserId: session.userId,
		});

		return jsonResponse({ item: newEvent }, 201);
	} catch (error) {
		return errorResponse(error);
	}
};
