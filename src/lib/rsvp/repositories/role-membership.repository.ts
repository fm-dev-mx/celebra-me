import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type {
	AppUserRole,
	AppUserRoleRecord,
	EventMembershipRecord,
} from '@/interfaces/auth/session.interface';
import {
	type EventMembershipRow,
	type UserRoleRow,
	toMembershipRecord,
	toRoleRecord,
} from '@/lib/rsvp/repositories/shared/rows';

const ACTIVE_MEMBERSHIP_FILTER = 'deleted_at=is.null';

export async function upsertUserRoleService(input: {
	userId: string;
	role: AppUserRole;
}): Promise<AppUserRoleRecord> {
	const rows = await supabaseRestRequest<UserRoleRow[]>({
		pathWithQuery: 'app_user_roles?select=*',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=merge-duplicates,return=representation',
		body: {
			user_id: input.userId,
			role: input.role,
		},
	});
	if (!rows[0]) throw new Error('No se pudo actualizar rol de usuario.');
	return toRoleRecord(rows[0]);
}

export async function findUserRoleService(userId: string): Promise<AppUserRoleRecord | null> {
	const rows = await supabaseRestRequest<UserRoleRow[]>({
		pathWithQuery: `app_user_roles?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toRoleRecord(rows[0]) : null;
}

export async function findAppUserRoleByUserIdService(
	userId: string,
): Promise<AppUserRoleRecord | null> {
	return findUserRoleService(userId);
}

export async function listUserRolesService(): Promise<AppUserRoleRecord[]> {
	const rows = await supabaseRestRequest<UserRoleRow[]>({
		pathWithQuery: 'app_user_roles?select=*&order=created_at.desc',
		useServiceRole: true,
	});
	return rows.map(toRoleRecord);
}

export async function createEventMembershipService(input: {
	eventId: string;
	userId: string;
	membershipRole: 'owner' | 'manager';
}): Promise<EventMembershipRecord> {
	const rows = await supabaseRestRequest<EventMembershipRow[]>({
		pathWithQuery: 'event_memberships?select=*',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=merge-duplicates,return=representation',
		body: {
			event_id: input.eventId,
			user_id: input.userId,
			membership_role: input.membershipRole,
			deleted_at: null,
		},
	});
	if (!rows[0]) throw new Error('No se pudo crear membresia del evento.');
	return toMembershipRecord(rows[0]);
}

export async function listEventMembershipsService(): Promise<EventMembershipRecord[]> {
	const rows = await supabaseRestRequest<EventMembershipRow[]>({
		pathWithQuery: `event_memberships?select=*&${ACTIVE_MEMBERSHIP_FILTER}&order=created_at.desc`,
		useServiceRole: true,
	});
	return rows.map(toMembershipRecord);
}

export async function softDeleteEventMembershipService(input: {
	eventId: string;
	userId: string;
}): Promise<EventMembershipRecord | null> {
	const rows = await supabaseRestRequest<EventMembershipRow[]>({
		pathWithQuery: `event_memberships?event_id=eq.${encodeURIComponent(input.eventId)}&user_id=eq.${encodeURIComponent(input.userId)}&select=*`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			deleted_at: new Date().toISOString(),
		},
	});
	return rows[0] ? toMembershipRecord(rows[0]) : null;
}

export async function findMembershipByEventForHost(
	eventId: string,
	hostAccessToken: string,
): Promise<EventMembershipRecord | null> {
	const rows = await supabaseRestRequest<EventMembershipRow[]>({
		pathWithQuery: `event_memberships?select=*&event_id=eq.${encodeURIComponent(eventId)}&${ACTIVE_MEMBERSHIP_FILTER}&limit=1`,
		authToken: hostAccessToken,
	});
	return rows[0] ? toMembershipRecord(rows[0]) : null;
}

export async function listMembershipsForHost(
	hostAccessToken: string,
): Promise<EventMembershipRecord[]> {
	const rows = await supabaseRestRequest<EventMembershipRow[]>({
		pathWithQuery: `event_memberships?select=*&${ACTIVE_MEMBERSHIP_FILTER}&order=created_at.desc`,
		authToken: hostAccessToken,
	});
	return rows.map(toMembershipRecord);
}
