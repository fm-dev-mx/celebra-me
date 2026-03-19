import type { APIRoute } from 'astro';
import { requireHostSession } from '@/lib/rsvp/auth/auth';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { listHostEvents } from '@/lib/rsvp/services/event-admin.service';
import type { DashboardEventListResponse } from '@/lib/rsvp/core/types';

export const GET: APIRoute = async ({ request }) => {
	try {
		const session = await requireHostSession(request);
		const events = await listHostEvents({
			hostUserId: session.userId,
			hostAccessToken: session.accessToken,
		});
		const payload: DashboardEventListResponse = {
			items: events.map((event) => ({
				id: event.id,
				title: event.title,
				slug: event.slug,
				eventType: event.eventType,
				status: event.status,
			})),
		};
		return jsonResponse(payload);
	} catch (error) {
		return errorResponse(error);
	}
};
