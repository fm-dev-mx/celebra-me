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

export interface AuthSessionDebugDTO {
	hasAccessToken: boolean;
	tokenSource: 'authorization' | 'cookie' | 'none';
	reason: 'missing_access_token' | 'invalid_supabase_user' | 'session_role_resolved';
	expectedEventSlug: string;
	expectedEventExistsInDb: boolean;
	expectedEventId: string | null;
	expectedEventOwnerUserId: string | null;
	hasVisibleMembershipForExpectedSlug: boolean;
	hasOwnedEventForExpectedSlug: boolean;
}

export interface AuthSessionDTO {
	userId: string;
	email: string;
	role: AppUserRole | null;
	isSuperAdmin: boolean;
	memberships: EventMembershipRecord[];
	debug?: AuthSessionDebugDTO;
}
