import { findEventById, findEventByIdService } from '@/lib/rsvp/repositories/event.repository';
import { findGuestById } from '@/lib/rsvp/repositories/guest.repository';
import { ApiError } from '@/lib/rsvp/core/errors';

export async function getEventAccessOrThrow(eventId: string, hostAccessToken: string) {
	const event = await findEventById(eventId, hostAccessToken);
	if (event) return event;

	const serviceEvent = await findEventByIdService(eventId);
	if (serviceEvent) {
		throw new ApiError(403, 'forbidden', 'Access to the requested event is denied.');
	}
	throw new ApiError(404, 'not_found', 'Event not found.');
}

export async function getGuestAccessOrThrow(guestId: string, hostAccessToken: string) {
	const existing = await findGuestById(guestId, hostAccessToken);
	if (existing) return existing;

	const serviceGuest = await findGuestById(guestId);
	if (serviceGuest) {
		throw new ApiError(403, 'forbidden', 'Access to the requested guest is denied.');
	}
	throw new ApiError(404, 'not_found', 'Guest not found.');
}
