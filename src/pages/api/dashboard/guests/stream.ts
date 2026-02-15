import type { APIRoute } from 'astro';
import { requireHostSession } from '@/lib/rsvp-v2/auth';
import { ApiError } from '@/lib/rsvp-v2/errors';
import { badRequest, errorResponse } from '@/lib/rsvp-v2/http';
import { listDashboardGuests } from '@/lib/rsvp-v2/service';
import { subscribeGuestStreamEvent, type DashboardGuestStreamEvent } from '@/lib/rsvp-v2/stream';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function encodeSse(event: DashboardGuestStreamEvent): string {
	return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export const GET: APIRoute = async ({ request, url }) => {
	try {
		const session = await requireHostSession(request);
		const eventId = sanitize(url.searchParams.get('eventId'), 120);
		if (!eventId) return badRequest('eventId es obligatorio.');

		// Ownership guard before opening long-lived stream.
		await listDashboardGuests({
			eventId,
			status: 'all',
			search: '',
			hostAccessToken: session.accessToken,
			origin: url.origin,
		});

		let unsubscribe: (() => void) | null = null;
		let heartbeatId: ReturnType<typeof setInterval> | null = null;

		const stream = new ReadableStream({
			start(controller) {
				const push = (event: DashboardGuestStreamEvent) => {
					controller.enqueue(new TextEncoder().encode(encodeSse(event)));
				};

				unsubscribe = subscribeGuestStreamEvent(eventId, push);
				// initial hello
				push({
					type: 'heartbeat',
					eventId,
					updatedAt: new Date().toISOString(),
				});

				heartbeatId = setInterval(() => {
					push({
						type: 'heartbeat',
						eventId,
						updatedAt: new Date().toISOString(),
					});
				}, 15000);
			},
			cancel() {
				if (heartbeatId) clearInterval(heartbeatId);
				if (unsubscribe) unsubscribe();
			},
		});

		request.signal.addEventListener('abort', () => {
			if (heartbeatId) clearInterval(heartbeatId);
			if (unsubscribe) unsubscribe();
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream; charset=utf-8',
				'Cache-Control': 'no-cache, no-transform',
				Connection: 'keep-alive',
			},
		});
	} catch (error) {
		if (
			error instanceof ApiError &&
			(error.code === 'forbidden' || error.code === 'not_found')
		) {
			return errorResponse(error);
		}
		return errorResponse(error);
	}
};
