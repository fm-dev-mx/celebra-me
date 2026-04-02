import {
	findAppUserRoleByUserIdService,
	listUserRolesService,
	upsertUserRoleService,
} from '@/lib/rsvp/repositories/role-membership.repository';
import type { AdminUserListItemDTO } from '@/interfaces/dashboard/admin.interface';
import type { AppUserRole } from '@/interfaces/auth/session.interface';
import {
	createAuthUserByAdmin,
	findAuthUserByEmail,
	findAuthUserByLoginIdentifier,
	listAuthUsers,
} from '@/lib/rsvp/auth/auth-api';
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';
import { randomBytes } from 'node:crypto';
import { sanitize } from '@/lib/rsvp/core/utils';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	assertValidEmail,
	normalizeEmail,
	normalizeLoginIdentifier,
} from '@/lib/rsvp/security/auth-security';

const GENERATED_LOGIN_DOMAIN = 'clientes.celebra.invalid';

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
		email: sanitize(user.login_alias || user.email, 320),
		role: roleMap.get(user.id) ?? 'host_client',
		createdAt: user.created_at || new Date().toISOString(),
	}));
}

export async function changeUserRoleAdmin(input: {
	userId: string;
	role: AppUserRole;
	actorUserId: string;
}): Promise<{
	userId: string;
	role: AppUserRole;
	previousRole: AppUserRole;
	changedAt: string;
}> {
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
		previousRole: existing?.role ?? 'host_client',
		changedAt: next.updatedAt,
	};
}

export function generateTemporaryPassword(seed?: string): string {
	const normalized = sanitize(seed, 60)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '')
		.slice(0, 12);
	const base = normalized || 'celebra';
	return `${base}2026`;
}

function generateManagedLoginAlias(): string {
	return `cliente-${randomBytes(4).toString('hex')}`;
}

function normalizeManagedLoginAlias(value: string): string {
	return sanitize(value, 60)
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/^[._-]+|[._-]+$/g, '')
		.slice(0, 40);
}

function buildManagedLoginEmail(alias: string): string {
	return `${alias}@${GENERATED_LOGIN_DOMAIN}`;
}

async function reserveManagedLoginAlias(seed?: string): Promise<string> {
	const normalizedSeed = normalizeManagedLoginAlias(seed || '');
	const candidates = normalizedSeed
		? [normalizedSeed, `${normalizedSeed}-${randomBytes(2).toString('hex')}`]
		: [generateManagedLoginAlias()];

	for (const candidate of candidates) {
		const [existingByIdentifier, existingByEmail] = await Promise.all([
			findAuthUserByLoginIdentifier({ identifier: candidate }),
			findAuthUserByEmail({ email: buildManagedLoginEmail(candidate) }),
		]);
		if (!existingByIdentifier && !existingByEmail) {
			return candidate;
		}
	}

	for (let attempt = 0; attempt < 5; attempt += 1) {
		const candidate = generateManagedLoginAlias();
		const [existingByIdentifier, existingByEmail] = await Promise.all([
			findAuthUserByLoginIdentifier({ identifier: candidate }),
			findAuthUserByEmail({ email: buildManagedLoginEmail(candidate) }),
		]);
		if (!existingByIdentifier && !existingByEmail) {
			return candidate;
		}
	}

	throw new ApiError(500, 'internal_error', 'No se pudo generar un usuario de acceso único.');
}

export async function createAdminUser(input: {
	email?: string;
	role: AppUserRole;
	actorUserId: string;
}): Promise<{
	item: AdminUserListItemDTO;
	credentials: {
		temporaryPassword: string;
	};
}> {
	const role = input.role === 'super_admin' ? 'super_admin' : 'host_client';
	const loginInput = normalizeLoginIdentifier(input.email);
	let authEmail = normalizeEmail(input.email);
	let visibleLogin = authEmail;
	let loginAlias: string | undefined;

	if (authEmail.includes('@')) {
		assertValidEmail(authEmail);
		const existing = await findAuthUserByEmail({ email: authEmail });
		if (existing) {
			throw new ApiError(
				409,
				'conflict',
				'Ya existe un usuario con este correo electrónico.',
			);
		}
	} else {
		loginAlias = await reserveManagedLoginAlias(loginInput);
		authEmail = buildManagedLoginEmail(loginAlias);
		visibleLogin = loginAlias;
	}

	const temporaryPassword = generateTemporaryPassword(loginAlias || authEmail);
	const authUser = await createAuthUserByAdmin({
		email: authEmail,
		password: temporaryPassword,
		loginAlias,
	});
	const roleRecord = await upsertUserRoleService({
		userId: authUser.id,
		role,
	});
	const createdAt = authUser.created_at || roleRecord.createdAt || new Date().toISOString();
	const item: AdminUserListItemDTO = {
		id: authUser.id,
		email: sanitize(authUser.login_alias || visibleLogin || authUser.email || authEmail, 320),
		role: roleRecord.role,
		createdAt,
	};

	await logAdminAction({
		actorId: sanitize(input.actorUserId, 120),
		action: 'create_user',
		targetTable: 'auth.users',
		targetId: item.id,
		oldData: null,
		newData: {
			userId: item.id,
			email: item.email,
			role: item.role,
			createdAt: item.createdAt,
		},
	});

	return {
		item,
		credentials: {
			temporaryPassword,
		},
	};
}
