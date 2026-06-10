import type {
	EventRecord,
	GuestInvitationDTO,
	GuestInvitationRecord,
} from '@/interfaces/rsvp/domain.interface';
import {
	buildShareMessage,
	buildWhatsAppShareUrl,
} from '@/lib/rsvp/services/shared/invitation-helpers';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';

export interface ToGuestDtoOptions {
	origin: string;
	eventTitle?: string;
	eventType?: EventRecord['eventType'];
	eventSlug?: string;
	shareMessages?: ShareMessagesConfig | null;
	eventDate?: string | null;
	rsvpDeadline?: string | null;
}

export function toGuestDto(
	guest: GuestInvitationRecord,
	options: ToGuestDtoOptions,
): GuestInvitationDTO {
	return {
		guestId: guest.id,
		inviteId: guest.inviteId,
		hideCelebraMeBranding: guest.hideCelebraMeBranding,
		fullName: guest.fullName,
		phone: guest.phone,
		countryCode: guest.countryCode,
		maxAllowedAttendees: guest.maxAllowedAttendees,
		attendanceStatus: guest.attendanceStatus,
		attendeeCount: guest.attendeeCount,
		guestComment: guest.guestComment,
		deliveryStatus: guest.deliveryStatus,
		viewPercentage: guest.viewPercentage,
		isViewed: guest.isViewed,
		firstViewedAt: guest.firstViewedAt,
		respondedAt: guest.respondedAt,
		waShareUrl: buildWhatsAppShareUrl({
			origin: options.origin,
			inviteId: guest.inviteId,
			phone: guest.phone,
			countryCode: guest.countryCode,
			fullName: guest.fullName,
			eventTitle: options.eventTitle,
			shortId: guest.shortId,
			eventType: options.eventType,
			eventSlug: options.eventSlug,
			shareMessages: options.shareMessages,
			messageType: 'invitation',
			eventDate: options.eventDate,
			rsvpDeadline: options.rsvpDeadline,
		}),
		shareText: buildShareMessage({
			origin: options.origin,
			inviteId: guest.inviteId,
			phone: guest.phone,
			fullName: guest.fullName,
			eventTitle: options.eventTitle,
			shortId: guest.shortId,
			eventType: options.eventType,
			eventSlug: options.eventSlug,
			shareMessages: options.shareMessages,
			messageType: 'invitation',
			includeLink: false,
			eventDate: options.eventDate,
			rsvpDeadline: options.rsvpDeadline,
		}),
		updatedAt: guest.updatedAt,
		entrySource: guest.entrySource ?? 'dashboard',
		tags: guest.tags || [],
		eventType: options.eventType,
		eventSlug: options.eventSlug,
		shortId: guest.shortId,
	};
}
