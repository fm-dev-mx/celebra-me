import type { APIRoute } from 'astro';
import { getRoutableEventEntry } from '@/lib/content/events';
import { findEventBySlugService } from '@/lib/rsvp/repositories/event.repository';
import { ApiError } from '@/lib/rsvp/core/errors';
import { badRequest, errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { isEventType, parsePublicGuestRsvpRequest } from '@/lib/rsvp/core/rsvp-request';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { submitGuestRsvpByPublicEvent } from '@/lib/rsvp/services/rsvp-submission.service';
import { sanitize } from '@/lib/rsvp/core/utils';

function getIp(request: Request): string {
	const raw =
		request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
	return sanitize(raw.split(',')[0], 100);
}

export const POST: APIRoute = async ({ params, request }) => {
	try {
		const eventTypeParam = sanitize(params.eventType, 40);
		const slug = sanitize(params.slug, 140);
		if (!eventTypeParam || !slug) return badRequest('eventType and slug are required.');
		if (!isEventType(eventTypeParam)) return badRequest('eventType is invalid.');

		const eventType = eventTypeParam;
		const parsedRequest = await parsePublicGuestRsvpRequest(request);
		if (parsedRequest instanceof Response) return parsedRequest;

		const eventEntry = await getRoutableEventEntry(slug, eventType);
		if (!eventEntry || eventEntry.data.isDemo) {
			throw new ApiError(404, 'not_found', 'Public RSVP is not available for this event.');
		}

		const rsvpConfig = eventEntry.data.rsvp;
		if (!rsvpConfig || rsvpConfig.accessMode !== 'hybrid') {
			throw new ApiError(
				403,
				'forbidden',
				'This event only accepts personalized RSVP links.',
			);
		}

		const event = await findEventBySlugService(slug);
		if (!event || event.eventType !== eventType) {
			throw new ApiError(404, 'not_found', 'Event not found.');
		}
		if (event.status !== 'published') {
			throw new ApiError(403, 'forbidden', 'Event is not accepting public RSVP submissions.');
		}

		const ip = getIp(request);
		const allowed = await checkRateLimit({
			namespace: 'rsvp-public',
			entityId: `${slug}:${parsedRequest.phone}`,
			ip,
			maxHits: 10,
			windowSec: 60,
		});
		if (!allowed) {
			return errorResponse(new ApiError(429, 'rate_limited', 'Too many requests.'));
		}

		const result = await submitGuestRsvpByPublicEvent({
			event,
			fullName: parsedRequest.fullName,
			phone: parsedRequest.phone,
			maxAllowedAttendees: rsvpConfig.guestCap,
			payload: parsedRequest.payload,
		});

		return successResponse({ message: 'RSVP saved.', ...result });
	} catch (error) {
		return errorResponse(error);
	}
};
