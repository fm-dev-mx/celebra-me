import type { EventType } from '@/lib/theme/theme-contract';

export type AttendanceStatus = 'pending' | 'confirmed' | 'declined';
export type DeliveryStatus = 'generated' | 'shared';
export type DeliveryFilter = DeliveryStatus | 'all';
export type ResponseSource = 'link' | 'admin' | 'generic_link';
export type EntrySource = 'dashboard' | 'generic_public';

export interface EventRecord {
	id: string;
	ownerUserId: string;
	slug: string;
	eventType: EventType;
	title: string;
	status: 'draft' | 'published' | 'archived';
	publishedAt: string | null;
	invitationId: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface GuestInvitationRecord {
	id: string;
	inviteId: string;
	eventId: string;
	fullName: string;
	phone: string;
	countryCode?: string;
	maxAllowedAttendees: number;
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	guestComment: string;
	deliveryStatus: DeliveryStatus;
	firstSharedAt: string | null;
	firstViewedAt: string | null;
	lastViewedAt: string | null;
	viewPercentage: number;
	isViewed: boolean;
	respondedAt: string | null;
	lastResponseSource: ResponseSource;
	entrySource?: EntrySource;
	createdAt: string;
	updatedAt: string;
	tags?: string[];
	shortId?: string;
	hideCelebraMeBranding?: boolean;
	lastReminderSentAt?: string | null;
}

export interface GuestInvitationAuditRecord {
	id: string;
	guestInvitationId: string;
	actorType: 'guest' | 'host' | 'system';
	eventType: 'created' | 'viewed' | 'status_changed' | 'message_updated' | 'shared_whatsapp';
	payload: Record<string, unknown>;
	createdAt: string;
}

export interface AuditLogRecord {
	id: string;
	actorId: string | null;
	action: string;
	targetTable: string;
	targetId: string;
	oldData: Record<string, unknown> | null;
	newData: Record<string, unknown> | null;
	createdAt: string;
}

export interface GuestInvitationDTO {
	guestId: string;
	inviteId: string;
	fullName: string;
	phone: string;
	countryCode?: string;
	maxAllowedAttendees: number;
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	guestComment: string;
	deliveryStatus: DeliveryStatus;
	firstSharedAt: string | null;
	firstViewedAt: string | null;
	viewPercentage: number;
	isViewed: boolean;
	respondedAt: string | null;
	waShareUrl: string;
	shareText: string;
	updatedAt: string;
	entrySource?: EntrySource;
	tags: string[];
	eventType?: EventRecord['eventType'];
	eventSlug?: string;
	shortId?: string;
	hideCelebraMeBranding?: boolean;
	lastReminderSentAt?: string | null;
}

export interface DashboardGuestMutationResponse {
	item: GuestInvitationDTO;
	updatedAt: string;
	source: 'mutation';
}

export interface GuestRSVPSubmitDTO {
	attendanceStatus: 'confirmed' | 'declined';
	attendeeCount: number;
	guestComment?: string;
}

export type ClaimCodeStatus = 'active' | 'expired' | 'exhausted' | 'disabled';

export interface ClaimCodeRecord {
	id: string;
	eventId: string;
	active: boolean;
	expiresAt: string | null;
	maxUses: number;
	usedCount: number;
	createdBy: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ClaimCodeDTO {
	id: string;
	eventId: string;
	active: boolean;
	expiresAt: string | null;
	maxUses: number;
	usedCount: number;
	createdBy: string | null;
	createdAt: string;
	updatedAt: string;
	status: ClaimCodeStatus;
}

export interface AdminClaimCodeListResponse {
	items: ClaimCodeDTO[];
}
