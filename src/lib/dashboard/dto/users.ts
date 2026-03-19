import type { AppUserRole } from '@/lib/rsvp/core/types';

export interface UserListItemDTO {
	id: string;
	email: string;
	role: AppUserRole;
	createdAt: string;
}

export interface UsersListResponse {
	items: UserListItemDTO[];
	total: number;
	page: number;
	perPage: number;
}

export interface CreateUserDTO {
	email: string;
	role: AppUserRole;
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
