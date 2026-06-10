import type {
	AttendanceStatus,
	DeliveryStatus,
	EntrySource,
	EventRecord,
} from '@/interfaces/rsvp/domain.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';

export interface DashboardGuestItem {
	guestId: string;
	inviteId: string;
	fullName: string;
	phone: string;
	countryCode?: string;
	email?: string | null;
	tags: string[];
	metadata?: Record<string, unknown>;
	maxAllowedAttendees: number;
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	guestComment: string;
	deliveryStatus: DeliveryStatus;
	firstSharedAt: string | null;
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
	hideCelebraMeBranding?: boolean;
}

export interface DashboardGuestListResponse {
	eventId: string;
	items: DashboardGuestItem[];
	shareTemplates: ShareMessagesConfig;
	shareOgDescription?: string;
	shareDateContext: ShareMessageDateContext;
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
