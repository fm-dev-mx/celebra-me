import { findEventByInvitationPublic, findEventBySlugService } from '@/lib/rsvp/repositories/event.repository';
import { findGuestByInviteIdPublic, findGuestByShortIdPublic } from '@/lib/rsvp/repositories/guest.repository';
import type { AttendanceStatus, EventRecord, GuestInvitationRecord } from '@/lib/rsvp/core/types';
import { ApiError } from '@/lib/rsvp/core/errors';
import { buildInviteUrl, isUuid } from '@/lib/rsvp/services/shared/invitation-helpers';
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
	if (!safeInviteId) throw new ApiError(400, 'bad_request', 'inviteId invalido.');

	const invitation = await findGuestByInviteIdPublic(safeInviteId);
	if (!invitation) throw new ApiError(404, 'not_found', 'Invitacion no encontrada.');

	const event = await findEventByInvitationPublic(invitation.eventId);
	if (!event) throw new ApiError(404, 'not_found', 'Evento no encontrado.');

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
	if (!safeShortId) throw new ApiError(400, 'bad_request', 'short_id invalido.');

	const invitation = await findGuestByShortIdPublic(safeShortId);
	if (!invitation) throw new ApiError(404, 'not_found', 'Invitacion no encontrada.');

	const event = await findEventByInvitationPublic(invitation.eventId);
	if (!event) throw new ApiError(404, 'not_found', 'Evento no encontrado.');

	return toInvitationContext(invitation, event);
}

export async function resolveLegacyTokenToCanonicalUrl(input: {
	eventSlug: string;
	token: string;
	origin: string;
}): Promise<string | null> {
	const safeEventSlug = sanitize(input.eventSlug, 120);
	const safeToken = sanitize(input.token, 2048);

	const event = await findEventBySlugService(safeEventSlug);
	if (!event) return null;
	if (!safeToken) return null;

	let v2Guest: GuestInvitationRecord | null = null;
	if (isUuid(safeToken)) {
		v2Guest = await findGuestByInviteIdPublic(safeToken);
	} else if (safeToken.length <= 12) {
		v2Guest = await findGuestByShortIdPublic(safeToken);
	}

	if (!v2Guest) return null;
	return buildInviteUrl(input.origin, v2Guest.inviteId);
}
