import {
	findEventByInvitationPublic,
	findEventBySlugService,
} from '@/lib/rsvp/repositories/event.repository';
import {
	findGuestByEventAndCodePublic,
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
	/** The event sells the per-guest branding removal add-on. */
	brandingRemovalEnabled: boolean;
	guest: {
		fullName: string;
		maxAllowedAttendees: number;
		attendanceStatus: AttendanceStatus;
		attendeeCount: number;
		guestComment: string;
		hideCelebraMeBranding: boolean;
	};
} {
	return {
		inviteId: invitation.inviteId,
		eventSlug: event.slug,
		eventType: event.eventType,
		brandingRemovalEnabled: event.brandingRemovalGuestLimit > 0,
		eventTitle: event.title,
		guest: {
			fullName: invitation.fullName,
			maxAllowedAttendees: invitation.maxAllowedAttendees,
			attendanceStatus: invitation.attendanceStatus,
			attendeeCount: invitation.attendeeCount,
			guestComment: invitation.guestComment,
			hideCelebraMeBranding: invitation.hideCelebraMeBranding ?? false,
		},
	};
}

export async function getInvitationContextByInviteId(inviteId: string): Promise<{
	inviteId: string;
	eventSlug: string;
	eventType: EventRecord['eventType'];
	eventTitle: string;
	/** The event sells the per-guest branding removal add-on. */
	brandingRemovalEnabled: boolean;
	guest: {
		fullName: string;
		maxAllowedAttendees: number;
		attendanceStatus: AttendanceStatus;
		attendeeCount: number;
		guestComment: string;
		hideCelebraMeBranding: boolean;
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
	/** The event sells the per-guest branding removal add-on. */
	brandingRemovalEnabled: boolean;
	guest: {
		fullName: string;
		maxAllowedAttendees: number;
		attendanceStatus: AttendanceStatus;
		attendeeCount: number;
		guestComment: string;
		hideCelebraMeBranding: boolean;
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

/** Guest codes are 4 characters from an alphabet without 0/o/1/l/i (see migration 20261020120000). */
const GUEST_CODE_PATTERN = /^[a-hjkmnp-z2-9]{4}$/;

export function isGuestCodeFormat(value: string): boolean {
	return GUEST_CODE_PATTERN.test(value);
}

/**
 * Resolves `/{slug}/{guestCode}`. The code only counts inside its own invitation: a code that
 * belongs to another invitation is not found, and so is any code of an invitation that keeps
 * `/i/{shortId}` links (`events.guest_code_links` false).
 */
export async function getInvitationContextBySlugAndCode(
	eventSlug: string,
	guestCode: string,
): Promise<ReturnType<typeof toInvitationContext>> {
	const safeSlug = sanitize(eventSlug, 128);
	if (!safeSlug || !isGuestCodeFormat(guestCode)) {
		throw new ApiError(404, 'not_found', 'Invitation not found.');
	}

	const event = await findEventBySlugService(safeSlug);
	if (!event?.guestCodeLinks) throw new ApiError(404, 'not_found', 'Event not found.');

	const invitation = await findGuestByEventAndCodePublic(event.id, guestCode);
	if (!invitation) throw new ApiError(404, 'not_found', 'Invitation not found.');

	return toInvitationContext(invitation, event);
}
