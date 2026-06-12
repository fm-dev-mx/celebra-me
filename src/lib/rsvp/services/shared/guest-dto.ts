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
import { resolveDefaultMessageKind } from '@/lib/rsvp/services/shared/message-type-resolver';

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
	const messageType = resolveDefaultMessageKind({
		firstSharedAt: guest.firstSharedAt,
		attendanceStatus: guest.attendanceStatus,
		deliveryStatus: guest.deliveryStatus,
	});

	const messageOptions = {
		origin: options.origin,
		inviteId: guest.inviteId,
		phone: guest.phone,
		fullName: guest.fullName,
		eventTitle: options.eventTitle,
		shortId: guest.shortId,
		eventType: options.eventType,
		eventSlug: options.eventSlug,
		shareMessages: options.shareMessages,
		messageType,
		eventDate: options.eventDate,
		rsvpDeadline: options.rsvpDeadline,
		attendanceStatus: guest.attendanceStatus,
	};

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
		firstSharedAt: guest.firstSharedAt,
		viewPercentage: guest.viewPercentage,
		isViewed: guest.isViewed,
		firstViewedAt: guest.firstViewedAt,
		respondedAt: guest.respondedAt,
		waShareUrl: buildWhatsAppShareUrl({ ...messageOptions, countryCode: guest.countryCode }),
		shareText: buildShareMessage({ ...messageOptions, includeLink: false }),
		updatedAt: guest.updatedAt,
		entrySource: guest.entrySource ?? 'dashboard',
		tags: guest.tags || [],
		eventType: options.eventType,
		eventSlug: options.eventSlug,
		shortId: guest.shortId,
	};
}
