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
	phone: string;
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
	tags?: string[];
	shortId?: string;
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
	maxAllowedAttendees: number;
	attendanceStatus: AttendanceStatus;
	attendeeCount: number;
	guestMessage: string;
	deliveryStatus: DeliveryStatus;
	firstViewedAt: string | null;
	respondedAt: string | null;
	waShareUrl: string;
	updatedAt: string;
	tags?: string[];
	eventType?: EventRecord['eventType'];
	eventSlug?: string;
	shortId?: string;
}

export interface DashboardGuestListResponse {
	eventId: string;
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

export interface DashboardEventListResponse {
	items: Array<{
		id: string;
		title: string;
		slug: string;
		eventType: EventRecord['eventType'];
		status: EventRecord['status'];
	}>;
}

export interface DashboardGuestMutationResponse {
	item: GuestInvitationDTO;
	updatedAt: string;
	source: 'mutation';
}

export interface GuestRSVPSubmitDTO {
	attendanceStatus: 'confirmed' | 'declined';
	attendeeCount: number;
	guestMessage?: string;
}

export type AppUserRole = 'super_admin' | 'host_client';

export interface AppUserRoleRecord {
	userId: string;
	role: AppUserRole;
	createdAt: string;
	updatedAt: string;
}

export interface EventMembershipRecord {
	id: string;
	eventId: string;
	userId: string;
	membershipRole: 'owner' | 'manager';
	createdAt: string;
	updatedAt: string;
}

export interface AuthSessionDTO {
	userId: string;
	email: string;
	role: AppUserRole | null;
	isSuperAdmin: boolean;
	memberships: EventMembershipRecord[];
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

export interface AdminEventListItemDTO {
	id: string;
	title: string;
	slug: string;
	eventType: EventRecord['eventType'];
	status: EventRecord['status'];
	ownerUserId: string;
	createdAt: string;
	updatedAt: string;
}

export interface AdminUserListItemDTO {
	id: string;
	email: string;
	role: AppUserRole;
	createdAt: string;
}

export interface DashboardNavItem {
	label: string;
	href: string;
	adminOnly?: boolean;
}
