import { findGuestByInviteIdPublic, updateGuestByInviteIdPublic } from '@/lib/rsvp/repositories/guest.repository';
import type { AttendanceStatus, GuestRSVPSubmitDTO } from '@/lib/rsvp/core/types';
import { ApiError } from '@/lib/rsvp/core/errors';
import { publishGuestStreamEvent } from '@/lib/rsvp/core/stream';
import { sanitize, toSafeAttendeeCount } from '@/lib/rsvp/core/utils';

export async function submitGuestRsvpByInviteId(
	inviteId: string,
	payload: GuestRSVPSubmitDTO,
): Promise<{ attendanceStatus: AttendanceStatus; attendeeCount: number; respondedAt: string }> {
	const invitation = await findGuestByInviteIdPublic(sanitize(inviteId, 64));
	if (!invitation) throw new ApiError(404, 'not_found', 'Invitacion no encontrada.');

	const attendanceStatus = payload.attendanceStatus;
	if (attendanceStatus !== 'confirmed' && attendanceStatus !== 'declined') {
		throw new ApiError(400, 'bad_request', 'Estado de asistencia invalido.');
	}

	const safeCount = toSafeAttendeeCount(payload.attendeeCount);
	const attendeeCount = attendanceStatus === 'declined' ? 0 : safeCount;
	if (attendanceStatus === 'confirmed' && attendeeCount < 1) {
		throw new ApiError(400, 'bad_request', 'Confirmado requiere al menos 1 asistente.');
	}
	if (attendeeCount > invitation.maxAllowedAttendees) {
		throw new ApiError(
			400,
			'bad_request',
			`El limite para esta invitacion es ${invitation.maxAllowedAttendees}.`,
		);
	}

	const respondedAt = new Date().toISOString();
	const updated = await updateGuestByInviteIdPublic(inviteId, {
		attendance_status: attendanceStatus,
		attendee_count: attendeeCount,
		guest_message: sanitize(payload.guestMessage, 500),
		responded_at: respondedAt,
		last_response_source: 'link',
	});

	console.info(`[rsvp] Success: RSVP submitted for invite ${inviteId}`);
	publishGuestStreamEvent({
		type: 'guest_updated',
		eventId: invitation.eventId,
		guestId: invitation.id,
		updatedAt: updated.updatedAt,
	});

	return {
		attendanceStatus: updated.attendanceStatus,
		attendeeCount: updated.attendeeCount,
		respondedAt: updated.respondedAt ?? respondedAt,
	};
}

export async function trackInvitationView(inviteId: string): Promise<void> {
	const invitation = await findGuestByInviteIdPublic(sanitize(inviteId, 64));
	if (!invitation) throw new ApiError(404, 'not_found', 'Invitacion no encontrada.');

	const now = new Date().toISOString();
	await updateGuestByInviteIdPublic(inviteId, {
		first_viewed_at: invitation.firstViewedAt ?? now,
		last_viewed_at: now,
	});

	publishGuestStreamEvent({
		type: 'guest_updated',
		eventId: invitation.eventId,
		guestId: invitation.id,
		updatedAt: now,
	});
}
