import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/admin-rate-limit';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp/csrf';
import { validateBodyOrRespond } from '@/lib/rsvp/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/http';
import { listAdminEvents, createEventAdmin } from '@/lib/rsvp/service';
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
