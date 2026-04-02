import {
	createGuestInvitationPublic,
	findGuestByInviteIdPublic,
	findGuestByPhone,
	updateGuestByIdService,
	updateGuestByInviteIdPublic,
} from '@/lib/rsvp/repositories/guest.repository';
import { generateShortId } from '@/lib/server/ids';
import type {
	AttendanceStatus,
	EntrySource,
	EventRecord,
	GuestInvitationRecord,
	GuestRSVPSubmitDTO,
	ResponseSource,
} from '@/interfaces/rsvp/domain.interface';
import { ApiError } from '@/lib/rsvp/core/errors';
import { publishGuestStreamEvent } from '@/lib/rsvp/core/stream';
import { normalizePhone, sanitize, toSafeAttendeeCount } from '@/lib/rsvp/core/utils';
import { mapSupabaseErrorToApiError } from '@/lib/rsvp/repositories/supabase-errors';

type InviteRsvpIdentity = {
	inviteId: string;
};

type PublicEventRsvpIdentity = {
	event: EventRecord;
	fullName: string;
	phone: string;
	maxAllowedAttendees: number;
};

type RsvpIdentity = InviteRsvpIdentity | PublicEventRsvpIdentity;

type ResolvedRsvpTarget =
	| {
			event: EventRecord | null;
			invitation: GuestInvitationRecord;
			createInput?: never;
	  }
	| {
			event: EventRecord;
			invitation?: never;
			createInput: {
				eventId: string;
				fullName: string;
				phone: string;
				maxAllowedAttendees: number;
				entrySource: EntrySource;
			};
	  };

function isInviteIdentity(identity: RsvpIdentity): identity is InviteRsvpIdentity {
	return 'inviteId' in identity;
}

function clampGuestCap(raw: number) {
	return Math.max(1, Math.min(20, Math.trunc(raw || 1)));
}

function validatePhone(phone: string) {
	const normalizedPhone = normalizePhone(phone);
	if (!normalizedPhone) return '';
	if (!/^\d{10}$/.test(normalizedPhone)) {
		throw new ApiError(400, 'bad_request', 'Phone must contain 10 digits.');
	}
	return normalizedPhone;
}

export async function resolveRsvpTarget(identity: RsvpIdentity): Promise<ResolvedRsvpTarget> {
	try {
		if (isInviteIdentity(identity)) {
			const invitation = await findGuestByInviteIdPublic(sanitize(identity.inviteId, 64));
			if (!invitation) throw new ApiError(404, 'not_found', 'Invitation not found.');
			return {
				event: null,
				invitation,
			};
		}

		const fullName = sanitize(identity.fullName, 140);
		if (!fullName) throw new ApiError(400, 'bad_request', 'Full name is required.');

		const phone = validatePhone(identity.phone);
		if (phone) {
			const existingInvitation = await findGuestByPhone(identity.event.id, phone);
			if (existingInvitation) {
				return {
					event: identity.event,
					invitation: existingInvitation,
				};
			}
		}

		return {
			event: identity.event,
			createInput: {
				eventId: identity.event.id,
				fullName,
				phone: phone || (null as unknown as string),
				maxAllowedAttendees: clampGuestCap(identity.maxAllowedAttendees),
				entrySource: 'generic_public',
			},
		};
	} catch (error) {
		throw mapSupabaseErrorToApiError(error);
	}
}

export async function persistRsvpResponse(
	target: ResolvedRsvpTarget,
	payload: GuestRSVPSubmitDTO,
	responseSource: ResponseSource,
): Promise<{
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	respondedAt: string;
	inviteId: string;
	guestId: string;
	entrySource: EntrySource;
}> {
	let invitation = target.invitation;
	if (!invitation && target.createInput) {
		invitation = await createGuestInvitationPublic({
			...target.createInput,
			shortId: generateShortId(8),
		});
	}
	if (!invitation) {
		throw new ApiError(500, 'internal_error', 'Unable to resolve RSVP target.');
	}

	const attendanceStatus = payload.attendanceStatus;
	if (attendanceStatus !== 'confirmed' && attendanceStatus !== 'declined') {
		throw new ApiError(400, 'bad_request', 'Attendance status is invalid.');
	}

	const safeCount = toSafeAttendeeCount(payload.attendeeCount);
	const attendeeCount = attendanceStatus === 'declined' ? 0 : safeCount;
	if (attendanceStatus === 'confirmed' && attendeeCount < 1) {
		throw new ApiError(
			400,
			'bad_request',
			'Confirmed attendance requires at least 1 attendee.',
		);
	}
	if (attendeeCount > invitation.maxAllowedAttendees) {
		throw new ApiError(
			400,
			'bad_request',
			`The limit for this invitation is ${invitation.maxAllowedAttendees}.`,
		);
	}

	const respondedAt = new Date().toISOString();
	const updateBody = {
		attendanceStatus,
		attendeeCount,
		guestMessage: sanitize(payload.guestMessage, 500),
		respondedAt,
		lastResponseSource: responseSource,
	};
	const updated =
		responseSource === 'link'
			? await updateGuestByInviteIdPublic(invitation.inviteId, {
					attendance_status: updateBody.attendanceStatus,
					attendee_count: updateBody.attendeeCount,
					guest_message: updateBody.guestMessage,
					responded_at: updateBody.respondedAt,
					last_response_source: updateBody.lastResponseSource,
				})
			: await updateGuestByIdService({
					guestId: invitation.id,
					attendanceStatus: updateBody.attendanceStatus,
					attendeeCount: updateBody.attendeeCount,
					guestMessage: updateBody.guestMessage,
					respondedAt: updateBody.respondedAt,
					lastResponseSource: updateBody.lastResponseSource,
				});

	console.info(`[rsvp] Success: RSVP submitted for invite ${updated.inviteId}`);
	publishGuestStreamEvent({
		type: 'guest_updated',
		eventId: updated.eventId,
		guestId: updated.id,
		updatedAt: updated.updatedAt,
	});

	return {
		attendanceStatus: updated.attendanceStatus,
		attendeeCount: updated.attendeeCount,
		respondedAt: updated.respondedAt ?? respondedAt,
		inviteId: updated.inviteId,
		guestId: updated.id,
		entrySource: updated.entrySource ?? 'dashboard',
	};
}

export async function submitGuestRsvpByInviteId(
	inviteId: string,
	payload: GuestRSVPSubmitDTO,
): Promise<{
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	respondedAt: string;
	inviteId: string;
	guestId: string;
	entrySource: EntrySource;
}> {
	const target = await resolveRsvpTarget({ inviteId });
	return persistRsvpResponse(target, payload, 'link');
}

export async function submitGuestRsvpByPublicEvent(input: {
	event: EventRecord;
	fullName: string;
	phone: string;
	maxAllowedAttendees: number;
	payload: GuestRSVPSubmitDTO;
}): Promise<{
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	respondedAt: string;
	inviteId: string;
	guestId: string;
	entrySource: EntrySource;
}> {
	const target = await resolveRsvpTarget({
		event: input.event,
		fullName: input.fullName,
		phone: input.phone,
		maxAllowedAttendees: input.maxAllowedAttendees,
	});
	return persistRsvpResponse(target, input.payload, 'generic_link');
}

export async function trackInvitationView(inviteId: string): Promise<void> {
	const invitation = await findGuestByInviteIdPublic(sanitize(inviteId, 64));
	if (!invitation) throw new ApiError(404, 'not_found', 'Invitation not found.');

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
