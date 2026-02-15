export type AttendanceStatus = 'pending' | 'confirmed' | 'declined';
export type RsvpSource = 'personalized_link' | 'generic_link' | 'admin';
export type ChannelType = 'whatsapp';
export type ChannelAction = 'cta_rendered' | 'clicked';

export interface RsvpRecord {
	rsvpId: string;
	eventSlug: string;
	guestId: string | null;
	guestNameEntered: string;
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	notes: string;
	dietary: string;
	source: RsvpSource;
	createdAt: string;
	lastUpdatedAt: string;
	normalizedGuestName: string;
	isPotentialDuplicate: boolean;
}

export interface RsvpAuditRecord {
	auditId: string;
	rsvpId: string;
	previousStatus: AttendanceStatus | null;
	newStatus: AttendanceStatus;
	previousAttendeeCount: number | null;
	newAttendeeCount: number;
	changedBy: 'guest' | 'admin' | 'system';
	changedAt: string;
}

export interface RsvpChannelRecord {
	channelEventId: string;
	rsvpId: string;
	channel: ChannelType;
	action: ChannelAction;
	occurredAt: string;
}
