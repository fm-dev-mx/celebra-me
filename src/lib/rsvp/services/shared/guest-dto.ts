import type {
	EventRecord,
	GuestInvitationDTO,
	GuestInvitationRecord,
} from '@/interfaces/rsvp/domain.interface';
import {
	buildShareMessage,
	buildWhatsAppShareUrl,
} from '@/lib/rsvp/services/shared/invitation-helpers';

export function toGuestDto(
	guest: GuestInvitationRecord,
	origin: string,
	eventTitle?: string,
	eventType?: EventRecord['eventType'],
	eventSlug?: string,
	template?: string,
): GuestInvitationDTO {
	return {
		guestId: guest.id,
		inviteId: guest.inviteId,
		fullName: guest.fullName,
		phone: guest.phone,
		maxAllowedAttendees: guest.maxAllowedAttendees,
		attendanceStatus: guest.attendanceStatus,
		attendeeCount: guest.attendeeCount,
		guestMessage: guest.guestMessage,
		deliveryStatus: guest.deliveryStatus,
		firstViewedAt: guest.firstViewedAt,
		respondedAt: guest.respondedAt,
		waShareUrl: buildWhatsAppShareUrl({
			origin,
			inviteId: guest.inviteId,
			phone: guest.phone,
			fullName: guest.fullName,
			eventTitle,
			shortId: guest.shortId,
			eventType,
			eventSlug,
			template,
		}),
		shareText: buildShareMessage({
			origin,
			inviteId: guest.inviteId,
			phone: guest.phone,
			fullName: guest.fullName,
			eventTitle,
			shortId: guest.shortId,
			eventType,
			eventSlug,
			template,
			includeLink: false,
		}),
		updatedAt: guest.updatedAt,
		entrySource: guest.entrySource ?? 'dashboard',
		tags: guest.tags || [],
		eventType,
		eventSlug,
		shortId: guest.shortId,
	};
}
