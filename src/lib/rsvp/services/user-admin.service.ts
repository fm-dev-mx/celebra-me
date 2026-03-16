import {
	findAppUserRoleByUserIdService,
	listUserRolesService,
	upsertUserRoleService,
} from '@/lib/rsvp/repository';
import type { AdminUserListItemDTO, AppUserRole } from '@/lib/rsvp/types';
import { listAuthUsers } from '@/lib/rsvp/auth-api';
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';
import { randomBytes } from 'node:crypto';
import { sanitize } from '@/lib/rsvp/utils';

export async function listAdminUsers(input?: {
	page?: number;
	perPage?: number;
}): Promise<AdminUserListItemDTO[]> {
	const users = await listAuthUsers({
		page: input?.page ?? 1,
		perPage: input?.perPage ?? 200,
	});
	const roleRecords = await listUserRolesService();
	const roleMap = new Map<string, AppUserRole>();
	for (const item of roleRecords) {
		roleMap.set(item.userId, item.role);
	}

	return users.map((user) => ({
		id: user.id,
		email: sanitize(user.email, 320),
		role: roleMap.get(user.id) ?? 'host_client',
		createdAt: user.created_at || new Date().toISOString(),
	}));
}

export async function changeUserRoleAdmin(input: {
	userId: string;
	role: AppUserRole;
	actorUserId: string;
}): Promise<{ userId: string; role: AppUserRole }> {
	const userId = sanitize(input.userId, 120);
	const role = input.role === 'super_admin' ? 'super_admin' : 'host_client';
	const existing = await findAppUserRoleByUserIdService(userId);
	const next = await upsertUserRoleService({ userId, role });

	await logAdminAction({
		actorId: sanitize(input.actorUserId, 120),
		action: 'change_user_role',
		targetTable: 'app_user_roles',
		targetId: userId,
		oldData: existing ? (existing as unknown as Record<string, unknown>) : null,
		newData: next as unknown as Record<string, unknown>,
	});

	return {
		userId: next.userId,
		role: next.role,
	};
}

export function generateTemporaryPassword(): string {
	return `${randomBytes(12).toString('base64url')}!aA1`;
}
