import type {
	AttendanceStatus,
	DeliveryStatus,
	EntrySource,
	EventRecord,
} from '@/interfaces/rsvp/domain.interface';

export interface DashboardGuestItem {
	guestId: string;
	inviteId: string;
	fullName: string;
	phone: string;
	email?: string | null;
	tags: string[];
	metadata?: Record<string, unknown>;
	maxAllowedAttendees: number;
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	guestComment: string;
	deliveryStatus: DeliveryStatus;
	viewPercentage: number;
	isViewed: boolean;
	firstViewedAt: string | null;
	respondedAt: string | null;
	waShareUrl: string;
	shareText: string;
	updatedAt: string;
	entrySource?: EntrySource;
	eventType?: EventRecord['eventType'];
	eventSlug?: string;
	shortId?: string;
}

export interface DashboardGuestListResponse {
	eventId: string;
	items: DashboardGuestItem[];
	totals: {
		totalInvitations: number;
		totalPeople: number;
		generatedInvitations: number;
		sharedInvitations: number;
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
