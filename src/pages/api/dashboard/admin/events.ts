import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { listAllEventsService } from '@/lib/rsvp/repositories/event.repository';

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'admin:list');
		await requireAdminStrongSession(request);
		const items = await listAllEventsService();
		const mapped = items.map((e) => ({
			id: e.id,
			title: e.title,
			slug: e.slug,
			eventType: e.eventType,
			status: e.status,
			ownerUserId: e.ownerUserId,
			createdAt: e.createdAt,
			updatedAt: e.updatedAt,
		}));
		return jsonResponse({ items: mapped });
	} catch (error) {
		return errorResponse(error);
	}
};
