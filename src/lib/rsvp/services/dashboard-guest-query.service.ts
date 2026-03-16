import {
	findEventById,
	findEventByIdService,
	findEventsForHost,
	findGuestsByEvent,
	findMembershipByEventForHost,
} from '@/lib/rsvp/repository';
import type { AttendanceStatus, DashboardGuestListResponse, EventRecord } from '@/lib/rsvp/types';
import { ApiError } from '@/lib/rsvp/errors';
import { toGuestDto } from '@/lib/rsvp/services/shared/guest-dto';
import { getSharingTemplateForSlug } from '@/lib/rsvp/services/shared/invitation-helpers';
import { sanitize } from '@/lib/rsvp/utils';

function buildDashboardTotals(items: DashboardGuestListResponse['items']) {
	const pendingItems = items.filter((item) => item.attendanceStatus === 'pending');
	const confirmedItems = items.filter((item) => item.attendanceStatus === 'confirmed');
	const declinedItems = items.filter((item) => item.attendanceStatus === 'declined');

	return {
		totalInvitations: items.length,
		totalPeople: items.reduce((acc, item) => acc + (item.maxAllowedAttendees || 0), 0),
		pendingInvitations: pendingItems.length,
		pendingPeople: pendingItems.reduce((acc, item) => acc + (item.maxAllowedAttendees || 0), 0),
		confirmedInvitations: confirmedItems.length,
		confirmedPeople: confirmedItems.reduce((acc, item) => acc + (item.attendeeCount || 0), 0),
		declinedInvitations: declinedItems.length,
		declinedPeople: declinedItems.reduce(
			(acc, item) => acc + (item.maxAllowedAttendees || 0),
			0,
		),
		viewed: items.filter((item) => !!item.firstViewedAt).length,
	};
}

export async function listDashboardGuests(input: {
	eventId: string;
	status?: AttendanceStatus | 'all' | 'viewed';
	search?: string;
	hostAccessToken: string;
	origin: string;
}): Promise<DashboardGuestListResponse> {
	const event = await findEventById(input.eventId, input.hostAccessToken);
	if (!event) {
		const membership = await findMembershipByEventForHost(input.eventId, input.hostAccessToken);
		if (membership) {
			const guests = await findGuestsByEvent(
				{
					eventId: membership.eventId,
					status: input.status ?? 'all',
					search: sanitize(input.search, 120),
				},
				input.hostAccessToken,
			);
			const items = guests.map((guest) => toGuestDto(guest, input.origin));
			return {
				eventId: membership.eventId,
				items,
				totals: buildDashboardTotals(items),
				updatedAt: new Date().toISOString(),
			};
		}

		const serviceEvent = await findEventByIdService(input.eventId);
		if (serviceEvent) {
			throw new ApiError(403, 'forbidden', 'Sin acceso al evento solicitado.');
		}
		throw new ApiError(404, 'not_found', 'Evento no encontrado.');
	}

	const guests = await findGuestsByEvent(
		{
			eventId: event.id,
			status: input.status ?? 'all',
			search: sanitize(input.search, 120),
		},
		input.hostAccessToken,
	);

	const template = await getSharingTemplateForSlug(event.slug, event.eventType);
	const items = guests.map((guest) =>
		toGuestDto(guest, input.origin, event.title, event.eventType, event.slug, template),
	);

	return {
		eventId: event.id,
		items,
		totals: buildDashboardTotals(items),
		updatedAt: new Date().toISOString(),
	};
}

export async function listHostEvents(input: {
	hostUserId: string;
	hostAccessToken: string;
}): Promise<EventRecord[]> {
	void input.hostUserId;
	return findEventsForHost(input.hostAccessToken);
}
