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
