import type { AppUserRole } from '@/interfaces/auth/session.interface';

export interface UserAssignedEventDTO {
	eventId: string;
	title: string;
	slug: string;
	membershipRole: 'owner' | 'manager';
}

export interface UserListItemDTO {
	id: string;
	email: string;
	role: AppUserRole;
	createdAt: string;
	assignedEvents: UserAssignedEventDTO[];
}

export interface UsersListResponse {
	items: UserListItemDTO[];
	total: number;
	page: number;
	perPage: number;
}

export interface CreateUserDTO {
	email?: string;
	role: AppUserRole;
}

export interface CreateUserResponse {
	item: UserListItemDTO;
	credentials: {
		temporaryPassword: string;
	};
}

export interface CreatedUserCredentialsDTO {
	email: string;
	role: AppUserRole;
	temporaryPassword: string;
}

export interface UpdateUserRoleDTO {
	role: AppUserRole;
}

export interface UserRoleChangeResponse {
	userId: string;
	role: AppUserRole;
	previousRole: AppUserRole;
	changedAt: string;
}

export interface UpdateUserEventMembershipDTO {
	eventId: string;
	action: 'assign' | 'remove';
	membershipRole?: 'owner' | 'manager';
}

export interface UserEventMembershipChangeResponse {
	userId: string;
	eventId: string;
	action: 'assign' | 'remove';
	membershipRole: 'owner' | 'manager' | null;
	changedAt: string;
}
