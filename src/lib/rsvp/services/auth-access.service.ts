import {
	findUserRoleService,
	listMembershipsForHost,
	upsertUserRoleService,
} from '@/lib/rsvp/repositories/role-membership.repository';
import { sanitize } from '@/lib/rsvp/core/utils';

export async function ensureUserRole(input: {
	userId: string;
	email: string;
	defaultRole?: 'host_client';
}): Promise<'host_client' | 'super_admin'> {
	const existing = await findUserRoleService(input.userId);
	if (existing) return existing.role;

	// Email allowlists are not an authorization boundary. Elevated roles are
	// granted only by authenticated administration or an explicit bootstrap
	// workflow; public registration always defaults to host_client.
	const nextRole = input.defaultRole ?? 'host_client';
	const upserted = await upsertUserRoleService({
		userId: input.userId,
		role: nextRole,
	});
	return upserted.role;
}

export async function buildAuthSessionDto(input: {
	userId: string;
	email: string;
	accessToken: string;
}): Promise<{
	userId: string;
	email: string;
	role: 'host_client' | 'super_admin' | null;
	isSuperAdmin: boolean;
	memberships: Array<{
		id: string;
		eventId: string;
		userId: string;
		membershipRole: 'owner' | 'manager';
		createdAt: string;
		updatedAt: string;
	}>;
}> {
	const role = await ensureUserRole({
		userId: input.userId,
		email: input.email,
		defaultRole: 'host_client',
	});
	const memberships = await listMembershipsForHost(input.accessToken);
	return {
		userId: input.userId,
		email: sanitize(input.email, 320),
		role,
		isSuperAdmin: role === 'super_admin',
		memberships,
	};
}
