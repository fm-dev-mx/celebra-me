import {
	findGuestByInviteIdPublic,
	submitGuestRsvpPublicRpc,
	trackGuestInvitationViewPublicRpc,
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
import { ApiError, toErrorMessage } from '@/lib/rsvp/core/errors';
import {
	formatPhoneError,
	MAX_GUEST_COMMENT_LEN,
	normalizeOptionalNationalPhone,
	sanitize,
	toSafeAttendeeCount,
} from '@/lib/rsvp/core/utils';
import { resolveGuestCap } from '@/lib/rsvp/guest-cap';
import { appendGuestMessage } from '@/lib/rsvp/core/guest-message';
import { isSupportedCountryCode } from '@/lib/phone/country-codes';
import { mapSupabaseErrorToApiError } from '@/lib/rsvp/repositories/supabase-errors';

type InviteRsvpIdentity = {
	inviteId: string;
};

type PublicEventRsvpIdentity = {
	event: EventRecord;
	fullName: string;
	phone: string;
	countryCode?: string;
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
				phone?: string;
				countryCode?: string;
				maxAllowedAttendees: number;
				entrySource: EntrySource;
				tags?: string[];
			};
	  };

function isInviteIdentity(identity: RsvpIdentity): identity is InviteRsvpIdentity {
	return 'inviteId' in identity;
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

		const phoneResult = normalizeOptionalNationalPhone(identity.phone);
		if (!phoneResult.ok) {
			throw new ApiError(400, 'bad_request', formatPhoneError(phoneResult.reason));
		}
		const phone = phoneResult.phone;
		if (phone) {
			if (!identity.countryCode || !isSupportedCountryCode(identity.countryCode)) {
				throw new ApiError(400, 'bad_request', 'Código de país no válido.');
			}
		}

		return {
			event: identity.event,
			createInput: {
				eventId: identity.event.id,
				fullName,
				phone: phone ?? undefined,
				countryCode: identity.countryCode,
				maxAllowedAttendees: resolveGuestCap(identity.maxAllowedAttendees)
					.maxTotalAttendees,
				entrySource: 'generic_public',
				tags: ['system:public'],
			},
		};
	} catch (error) {
		throw mapSupabaseErrorToApiError(error);
	}
}

function validateRsvpPayload(
	payload: GuestRSVPSubmitDTO,
	maxAllowed: number,
): { attendanceStatus: AttendanceStatus; attendeeCount: number } {
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
	const maxAllowedAttendees = resolveGuestCap(maxAllowed).maxTotalAttendees;
	if (attendeeCount > maxAllowedAttendees) {
		throw new ApiError(
			400,
			'bad_request',
			`The limit for this invitation is ${maxAllowedAttendees}.`,
		);
	}

	return { attendanceStatus, attendeeCount };
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
	const maxAllowed =
		target.invitation?.maxAllowedAttendees ?? target.createInput?.maxAllowedAttendees;
	if (maxAllowed === undefined) {
		throw new ApiError(500, 'internal_error', 'Unable to resolve RSVP target.');
	}

	const { attendanceStatus, attendeeCount } = validateRsvpPayload(payload, maxAllowed);
	const sanitizedNewMessage = sanitize(payload.guestComment, MAX_GUEST_COMMENT_LEN);
	// Absolute comment for RPC SET semantics; null keeps existing DB value.
	const guestCommentAbsolute = !sanitizedNewMessage
		? null
		: appendGuestMessage(target.invitation?.guestComment ?? '', sanitizedNewMessage);

	try {
		const updated = target.invitation
			? await submitGuestRsvpPublicRpc({
					inviteId: target.invitation.inviteId,
					attendanceStatus,
					attendeeCount,
					guestComment: guestCommentAbsolute,
					responseSource,
				})
			: await submitGuestRsvpPublicRpc({
					eventId: target.createInput.eventId,
					fullName: target.createInput.fullName,
					phone: target.createInput.phone,
					countryCode: target.createInput.countryCode,
					maxAllowedAttendees: target.createInput.maxAllowedAttendees,
					shortId: generateShortId(8),
					attendanceStatus,
					attendeeCount,
					guestComment: guestCommentAbsolute,
					responseSource,
				});

		console.info(`[rsvp] Success: RSVP submitted for invite ${updated.inviteId}`);

		return {
			attendanceStatus: updated.attendanceStatus ?? attendanceStatus,
			attendeeCount: updated.attendeeCount ?? attendeeCount,
			respondedAt: updated.respondedAt ?? new Date().toISOString(),
			inviteId: updated.inviteId,
			guestId: updated.id,
			entrySource: updated.entrySource ?? 'generic_public',
		};
	} catch (error) {
		const message = toErrorMessage(error, '');
		if (
			!target.invitation &&
			(message.includes('guest_invitations_event_country_phone_active_unique') ||
				message.includes('23505'))
		) {
			throw new ApiError(
				409,
				'conflict',
				'No se pudo registrar su respuesta. Utilice su enlace personalizado o contacte al anfitrión.',
			);
		}
		throw mapSupabaseErrorToApiError(error);
	}
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
	countryCode?: string;
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
		countryCode: input.countryCode,
		maxAllowedAttendees: input.maxAllowedAttendees,
	});
	return persistRsvpResponse(target, input.payload, 'generic_link');
}

export async function trackInvitationView(
	inviteId: string,
	viewPercentage?: number,
): Promise<void> {
	const cleanInviteId = sanitize(inviteId, 64);
	if (!cleanInviteId) return;

	try {
		await trackGuestInvitationViewPublicRpc(cleanInviteId, viewPercentage);
	} catch (error) {
		console.warn('[telemetry] Non-critical view tracking failed:', {
			inviteId: cleanInviteId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
