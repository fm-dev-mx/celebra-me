import { findEventByInvitationPublic } from '@/lib/rsvp/repositories/event.repository';
import {
	findGuestByInviteIdPublic,
	findGuestByShortIdPublic,
} from '@/lib/rsvp/repositories/guest.repository';
import type {
	AttendanceStatus,
	EventRecord,
	GuestInvitationRecord,
} from '@/interfaces/rsvp/domain.interface';
import { ApiError } from '@/lib/rsvp/core/errors';
import { sanitize } from '@/lib/rsvp/core/utils';

function toInvitationContext(
	invitation: GuestInvitationRecord,
	event: EventRecord,
): {
	inviteId: string;
	eventSlug: string;
	eventType: EventRecord['eventType'];
	eventTitle: string;
	guest: {
		fullName: string;
		maxAllowedAttendees: number;
		attendanceStatus: AttendanceStatus;
		attendeeCount: number;
		guestMessage: string;
	};
} {
	return {
		inviteId: invitation.inviteId,
		eventSlug: event.slug,
		eventType: event.eventType,
		eventTitle: event.title,
		guest: {
			fullName: invitation.fullName,
			maxAllowedAttendees: invitation.maxAllowedAttendees,
			attendanceStatus: invitation.attendanceStatus,
			attendeeCount: invitation.attendeeCount,
			guestMessage: invitation.guestMessage,
		},
	};
}

export async function getInvitationContextByInviteId(inviteId: string): Promise<{
	inviteId: string;
	eventSlug: string;
	eventType: EventRecord['eventType'];
	eventTitle: string;
	guest: {
		fullName: string;
		maxAllowedAttendees: number;
		attendanceStatus: AttendanceStatus;
		attendeeCount: number;
		guestMessage: string;
	};
}> {
	const safeInviteId = sanitize(inviteId, 64);
	if (!safeInviteId) throw new ApiError(400, 'bad_request', 'inviteId is invalid.');

	const invitation = await findGuestByInviteIdPublic(safeInviteId);
	if (!invitation) throw new ApiError(404, 'not_found', 'Invitation not found.');

	const event = await findEventByInvitationPublic(invitation.eventId);
	if (!event) throw new ApiError(404, 'not_found', 'Event not found.');

	return toInvitationContext(invitation, event);
}

export async function getInvitationContextByShortId(shortId: string): Promise<{
	inviteId: string;
	eventSlug: string;
	eventType: EventRecord['eventType'];
	eventTitle: string;
	guest: {
		fullName: string;
		maxAllowedAttendees: number;
		attendanceStatus: AttendanceStatus;
		attendeeCount: number;
		guestMessage: string;
	};
}> {
	const safeShortId = sanitize(shortId, 12);
	if (!safeShortId) throw new ApiError(400, 'bad_request', 'short_id is invalid.');

	const invitation = await findGuestByShortIdPublic(safeShortId);
	if (!invitation) throw new ApiError(404, 'not_found', 'Invitation not found.');

	const event = await findEventByInvitationPublic(invitation.eventId);
	if (!event) throw new ApiError(404, 'not_found', 'Event not found.');

	return toInvitationContext(invitation, event);
}
