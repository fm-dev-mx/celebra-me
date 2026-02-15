import type { APIRoute } from 'astro';
import { requireAdminSession } from '@/lib/rsvp-v2/authorization';
import { errorResponse, jsonResponse } from '@/lib/rsvp-v2/http';
import { listAdminEvents } from '@/lib/rsvp-v2/service';

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminSession(request);
		const items = await listAdminEvents();
		return jsonResponse({ items });
	} catch (error) {
		return errorResponse(error);
	}
};
