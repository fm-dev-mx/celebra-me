export type AttendanceStatus = 'pending' | 'confirmed' | 'declined';
export type DeliveryStatus = 'generated' | 'shared';

export interface DashboardGuestItem {
	guestId: string;
	inviteId: string;
	fullName: string;
	phone: string;
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
	shareText: string;
	updatedAt: string;
	eventType?: string;
	eventSlug?: string;
	shortId?: string;
}

export interface DashboardGuestListResponse {
	eventId: string;
	items: DashboardGuestItem[];
	totals: {
		totalInvitations: number;
		totalPeople: number;
		pendingInvitations: number;
		pendingPeople: number;
		confirmedInvitations: number;
		confirmedPeople: number;
		declinedInvitations: number;
		declinedPeople: number;
		viewed: number;
	};
	updatedAt: string;
}
