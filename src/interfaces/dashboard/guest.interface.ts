import type {
	AttendanceStatus,
	DeliveryStatus,
	EntrySource,
	EventRecord,
} from '@/interfaces/rsvp/domain.interface';
import type {
	ShareMessagesConfig,
	ReminderSettings,
} from '@/lib/rsvp/services/shared/share-message-defaults';
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
	lastReminderSentAt?: string | null;
	/** Test guest: excluded from totals, funnel, and engagement snapshots. */
	isTest?: boolean;
	/** Guest engagement projections (docs/domains/rsvp/engagement-analytics.md). */
	openCount?: number;
	firstOpenedAt?: string | null;
	lastOpenedAt?: string | null;
	lastPreviewedAt?: string | null;
	maxProgressMilestone?: number;
}

/** Host funnel from get_event_engagement_summary; guests only, test guests excluded. */
export interface DashboardEngagementSummary {
	guests: number;
	shared: number;
	previewed: number;
	opened: number;
	formViewed: number;
	formStarted: number;
	responded: number;
	openedNotResponded: number;
	medianSecondsToOpen: number | null;
	trackingStartedAt: string | null;
}

export interface DashboardGuestListResponse {
	eventId: string;
	items: DashboardGuestItem[];
	shareTemplates: ShareMessagesConfig;
	reminderSettings: ReminderSettings;
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
		unconfirmedShared: number;
		viewed: number;
	};
	/** Absent or null when the summary could not be loaded; the dashboard hides the funnel. */
	engagement?: DashboardEngagementSummary | null;
	updatedAt: string;
}
