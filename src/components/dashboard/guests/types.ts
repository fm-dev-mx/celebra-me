export type AttendanceStatus = 'pending' | 'confirmed' | 'declined';
export type DeliveryStatus = 'generated' | 'shared';

export interface DashboardGuestItem {
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
