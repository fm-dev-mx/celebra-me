export type AttendanceStatus = 'pending' | 'confirmed' | 'declined';
export type DeliveryStatus = 'generated' | 'shared';

export interface DashboardGuestItem {
	guestId: string;
	inviteId: string;
	fullName: string;
	phoneE164: string;
	email: string | null;
	tags: string[];
	metadata: Record<string, unknown>;
	maxAllowedAttendees: number;
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	guestMessage: string;
	deliveryStatus: DeliveryStatus;
	firstViewedAt: string | null;
	respondedAt: string | null;
	waShareUrl: string;
	updatedAt: string;
	eventType?: string;
	eventSlug?: string;
}

export interface DashboardGuestListResponse {
	eventId: string;
	items: DashboardGuestItem[];
	totals: {
		total: number;
		pending: number;
		confirmed: number;
		declined: number;
		viewed: number;
	};
	updatedAt: string;
}
