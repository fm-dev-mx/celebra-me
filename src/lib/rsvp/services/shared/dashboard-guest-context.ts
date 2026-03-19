import { findEventById } from '@/lib/rsvp/repositories/event.repository';
import { findEventByIdService } from '@/lib/rsvp/repositories/event.repository';
import { findGuestById, findGuestByIdService } from '@/lib/rsvp/repositories/guest.repository';
import { ApiError } from '@/lib/rsvp/core/errors';
import { getSharingTemplateForSlug } from '@/lib/rsvp/services/shared/invitation-helpers';

export async function getEventAccessOrThrow(eventId: string, hostAccessToken: string) {
	const event = await findEventById(eventId, hostAccessToken);
	if (event) return event;

	const serviceEvent = await findEventByIdService(eventId);
	if (serviceEvent) {
		throw new ApiError(403, 'forbidden', 'Sin acceso al evento solicitado.');
	}
	throw new ApiError(404, 'not_found', 'Evento no encontrado.');
}

export async function getGuestAccessOrThrow(guestId: string, hostAccessToken: string) {
	const existing = await findGuestById(guestId, hostAccessToken);
	if (existing) return existing;

	const serviceGuest = await findGuestByIdService(guestId);
	if (serviceGuest) {
		throw new ApiError(403, 'forbidden', 'Sin acceso al invitado solicitado.');
	}
	throw new ApiError(404, 'not_found', 'Invitado no encontrado.');
}

export async function getEventPresentationData(eventId: string, hostAccessToken: string) {
	const event = await findEventById(eventId, hostAccessToken);
	if (!event) return {};

	return {
		eventTitle: event.title,
		eventType: event.eventType,
		eventSlug: event.slug,
		template: await getSharingTemplateForSlug(event.slug, event.eventType),
	};
}
