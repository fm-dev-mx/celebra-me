import type {
	AttendanceStatus,
	ClaimCodeRecord,
	EntrySource,
	EventRecord,
	GuestInvitationAuditRecord,
	GuestInvitationRecord,
	ResponseSource,
} from '@/interfaces/rsvp/domain.interface';
import type {
	AppUserRole,
	AppUserRoleRecord,
	EventMembershipRecord,
} from '@/interfaces/auth/session.interface';

export interface GuestFilters {
	eventId: string;
	status?: AttendanceStatus | 'all' | 'viewed';
	search?: string;
}

export interface CreateGuestInput {
	eventId: string;
	fullName: string;
	phone?: string;
	maxAllowedAttendees: number;
	tags?: string[];
	shortId?: string;
	entrySource?: EntrySource;
}

export interface UpdateGuestInput {
	guestId: string;
	fullName?: string;
	phone?: string;
	maxAllowedAttendees?: number;
	attendanceStatus?: AttendanceStatus;
	attendeeCount?: number;
	guestMessage?: string;
	deliveryStatus?: 'generated' | 'shared';
	lastResponseSource?: ResponseSource;
	respondedAt?: string | null;
	tags?: string[];
}

export type EventRow = {
	id: string;
	owner_user_id: string;
	slug: string;
	event_type: EventRecord['eventType'];
	title: string;
	status: EventRecord['status'];
	published_at: string | null;
	created_at: string;
	updated_at: string;
};

export type GuestRow = {
	id: string;
	invite_id: string;
	event_id: string;
	full_name: string;
	phone: string;
	max_allowed_attendees: number;
	attendance_status: AttendanceStatus;
	attendee_count: number;
	guest_message: string;
	delivery_status: 'generated' | 'shared';
	first_viewed_at: string | null;
	last_viewed_at: string | null;
	responded_at: string | null;
	last_response_source: ResponseSource;
	entry_source?: EntrySource;
	created_at: string;
	updated_at: string;
	tags: string[];
	short_id?: string;
};

export type GuestAuditRow = {
	id: string;
	guest_invitation_id: string;
	actor_type: 'guest' | 'host' | 'system';
	event_type: 'created' | 'viewed' | 'status_changed' | 'message_updated' | 'shared_whatsapp';
	payload: Record<string, unknown>;
	created_at: string;
};

export type UserRoleRow = {
	user_id: string;
	role: AppUserRole;
	created_at: string;
	updated_at: string;
};

export type EventMembershipRow = {
	id: string;
	event_id: string;
	user_id: string;
	membership_role: 'owner' | 'manager';
	created_at: string;
	updated_at: string;
};

export type ClaimCodeRow = {
	id: string;
	event_id: string;
	active: boolean;
	expires_at: string | null;
	max_uses: number;
	used_count: number;
	created_by: string | null;
	created_at: string;
	updated_at: string;
};

export const EVENT_COLUMNS =
	'id,owner_user_id,slug,event_type,title,status,published_at,created_at,updated_at';
export const EVENT_MUTATION_COLUMNS =
	'id,owner_user_id,slug,event_type,title,status,created_at,updated_at';
export const GUEST_COLUMNS =
	'id,invite_id,event_id,full_name,phone,max_allowed_attendees,attendance_status,attendee_count,guest_message,delivery_status,first_viewed_at,last_viewed_at,responded_at,last_response_source,entry_source,created_at,updated_at,tags,short_id';
export const GUEST_COLUMNS_WITHOUT_SHORT_ID =
	'id,invite_id,event_id,full_name,phone,max_allowed_attendees,attendance_status,attendee_count,guest_message,delivery_status,first_viewed_at,last_viewed_at,responded_at,last_response_source,entry_source,created_at,updated_at,tags';
export const GUEST_COLUMNS_WITHOUT_ENTRY_SOURCE =
	'id,invite_id,event_id,full_name,phone,max_allowed_attendees,attendance_status,attendee_count,guest_message,delivery_status,first_viewed_at,last_viewed_at,responded_at,last_response_source,created_at,updated_at,tags,short_id';
export const GUEST_COLUMNS_MINIMAL =
	'id,invite_id,event_id,full_name,phone,max_allowed_attendees,attendance_status,attendee_count,guest_message,delivery_status,first_viewed_at,last_viewed_at,responded_at,last_response_source,created_at,updated_at,tags';

export function toEventRecord(row: EventRow): EventRecord {
	return {
		id: row.id,
		ownerUserId: row.owner_user_id,
		slug: row.slug,
		eventType: row.event_type,
		title: row.title,
		status: row.status,
		publishedAt: row.published_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export function toGuestRecord(row: GuestRow): GuestInvitationRecord {
	return {
		id: row.id,
		inviteId: row.invite_id,
		eventId: row.event_id,
		fullName: row.full_name,
		phone: row.phone,
		maxAllowedAttendees: row.max_allowed_attendees,
		attendanceStatus: row.attendance_status,
		attendeeCount: row.attendee_count,
		guestMessage: row.guest_message,
		deliveryStatus: row.delivery_status,
		firstViewedAt: row.first_viewed_at,
		lastViewedAt: row.last_viewed_at,
		respondedAt: row.responded_at,
		lastResponseSource: row.last_response_source,
		entrySource: row.entry_source ?? 'dashboard',
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		tags: row.tags || [],
		shortId: row.short_id,
	};
}

export function toGuestAuditRecord(row: GuestAuditRow): GuestInvitationAuditRecord {
	return {
		id: row.id,
		guestInvitationId: row.guest_invitation_id,
		actorType: row.actor_type,
		eventType: row.event_type,
		payload: row.payload ?? {},
		createdAt: row.created_at,
	};
}

export function toRoleRecord(row: UserRoleRow): AppUserRoleRecord {
	return {
		userId: row.user_id,
		role: row.role,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export function toMembershipRecord(row: EventMembershipRow): EventMembershipRecord {
	return {
		id: row.id,
		eventId: row.event_id,
		userId: row.user_id,
		membershipRole: row.membership_role,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export function toClaimCodeRecord(row: ClaimCodeRow): ClaimCodeRecord {
	return {
		id: row.id,
		eventId: row.event_id,
		active: row.active,
		expiresAt: row.expires_at,
		maxUses: row.max_uses,
		usedCount: row.used_count,
		createdBy: row.created_by,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}
