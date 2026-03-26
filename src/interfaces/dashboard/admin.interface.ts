import type { AppUserRole } from '@/interfaces/auth/session.interface';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';

export interface DashboardNavItem {
	label: string;
	href: string;
	adminOnly?: boolean;
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
