import type { AppUserRole } from '@/interfaces/auth/session.interface';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';

export interface DashboardNavItem {
	label: string;
	href: string;
	adminOnly?: boolean;
}

export interface DashboardEventListItem {
	id: string;
	title: string;
	slug: string;
	eventType: EventRecord['eventType'];
	status: EventRecord['status'];
}

export interface DashboardEventSessionDebug {
	hasAccessToken: boolean;
	tokenSource: 'authorization' | 'cookie' | 'none';
	reason: 'missing_access_token' | 'invalid_supabase_user' | 'session_role_resolved';
	userId: string | null;
	email: string | null;
	role: AppUserRole | null;
	isSuperAdmin: boolean;
}

export interface DashboardEventSlugDebug {
	expectedSlug: string;
	slugExistsInDb: boolean;
	eventId: string | null;
	ownerUserId: string | null;
	title: string | null;
}

export interface DashboardEventListDebug {
	session: DashboardEventSessionDebug;
	ownerEvents: DashboardEventListItem[];
	visibleEvents: DashboardEventListItem[];
	memberships: Array<{
		id: string;
		eventId: string;
		userId: string;
		membershipRole: 'owner' | 'manager';
	}>;
	membershipResolvedEvents: DashboardEventListItem[];
	unresolvedMembershipEventIds: string[];
	slugCheck: DashboardEventSlugDebug;
}

export interface DashboardEventListResponse {
	items: DashboardEventListItem[];
	debug?: DashboardEventListDebug;
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
