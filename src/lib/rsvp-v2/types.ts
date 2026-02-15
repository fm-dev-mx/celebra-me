export type AttendanceStatus = 'pending' | 'confirmed' | 'declined';
export type DeliveryStatus = 'generated' | 'shared';
export type ResponseSource = 'link' | 'admin';

export interface EventRecord {
	id: string;
	ownerUserId: string;
	slug: string;
	eventType: 'xv' | 'boda' | 'bautizo' | 'cumple';
	title: string;
	status: 'draft' | 'published' | 'archived';
	publishedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface GuestInvitationRecord {
	id: string;
	inviteId: string;
	eventId: string;
	fullName: string;
	phoneE164: string;
	maxAllowedAttendees: number;
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	guestMessage: string;
	deliveryStatus: DeliveryStatus;
	firstViewedAt: string | null;
	lastViewedAt: string | null;
	respondedAt: string | null;
	lastResponseSource: ResponseSource;
	createdAt: string;
	updatedAt: string;
}

export interface GuestInvitationAuditRecord {
	id: string;
	guestInvitationId: string;
	actorType: 'guest' | 'host' | 'system';
	eventType: 'created' | 'viewed' | 'status_changed' | 'message_updated' | 'shared_whatsapp';
	payload: Record<string, unknown>;
	createdAt: string;
}

export interface GuestInvitationDTO {
	guestId: string;
	inviteId: string;
	fullName: string;
	phoneE164: string;
	maxAllowedAttendees: number;
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	guestMessage: string;
	deliveryStatus: DeliveryStatus;
	firstViewedAt: string | null;
	respondedAt: string | null;
	waShareUrl: string;
	updatedAt: string;
}

export interface DashboardGuestListResponse {
	items: GuestInvitationDTO[];
	totals: {
		total: number;
		pending: number;
		confirmed: number;
		declined: number;
		viewed: number;
	};
	updatedAt: string;
}

export interface GuestRSVPSubmitDTO {
	attendanceStatus: 'confirmed' | 'declined';
	attendeeCount: number;
	guestMessage?: string;
}
