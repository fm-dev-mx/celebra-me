import {
	findAppUserRoleByUserIdService,
	listEventMembershipsService,
	createEventMembershipService,
	softDeleteEventMembershipService,
	listUserRolesService,
	upsertUserRoleService,
} from '@/lib/rsvp/repositories/role-membership.repository';
import type { AppUserRole } from '@/interfaces/auth/session.interface';
import {
	createAuthUserByAdmin,
	findAuthUserByEmail,
	findAuthUserByLoginIdentifier,
	listAuthUsers,
} from '@/lib/rsvp/auth/auth-api';
import type { UserAssignedEventDTO, UserListItemDTO } from '@/lib/dashboard/dto/users';
import { listAllEventsService } from '@/lib/rsvp/repositories/event.repository';
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
}): Promise<UserListItemDTO[]> {
	const [users, roleRecords, memberships, events] = await Promise.all([
		listAuthUsers({
			page: input?.page ?? 1,
			perPage: input?.perPage ?? 200,
		}),
		listUserRolesService(),
		listEventMembershipsService(),
		listAllEventsService(),
	]);
	const roleMap = new Map<string, AppUserRole>();
	for (const item of roleRecords) {
		roleMap.set(item.userId, item.role);
	}
	const eventMap = new Map(
		events.map((event) => [
			event.id,
			{
				eventId: event.id,
				title: event.title,
				slug: event.slug,
			},
		]),
	);
	const membershipsByUser = new Map<string, UserAssignedEventDTO[]>();
	for (const membership of memberships) {
		const event = eventMap.get(membership.eventId);
		if (!event) continue;
		const list = membershipsByUser.get(membership.userId) ?? [];
		list.push({
			...event,
			membershipRole: membership.membershipRole,
		});
		membershipsByUser.set(membership.userId, list);
	}

	return users.map((user) => ({
		id: user.id,
		email: sanitize(user.login_alias || user.email, 320),
		role: roleMap.get(user.id) ?? 'host_client',
		createdAt: user.created_at || new Date().toISOString(),
		assignedEvents: (membershipsByUser.get(user.id) ?? []).sort((left, right) =>
			left.title.localeCompare(right.title, 'es-MX'),
		),
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
	item: UserListItemDTO;
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
	const item: UserListItemDTO = {
		id: authUser.id,
		email: sanitize(authUser.login_alias || visibleLogin || authUser.email || authEmail, 320),
		role: roleRecord.role,
		createdAt,
		assignedEvents: [],
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

export async function updateUserEventMembershipAdmin(input: {
	userId: string;
	eventId: string;
	action: 'assign' | 'remove';
	membershipRole?: 'owner' | 'manager';
	actorUserId: string;
}): Promise<{
	userId: string;
	eventId: string;
	action: 'assign' | 'remove';
	membershipRole: 'owner' | 'manager' | null;
	changedAt: string;
}> {
	const userId = sanitize(input.userId, 120);
	const eventId = sanitize(input.eventId, 120);
	if (!userId || !eventId) {
		throw new ApiError(400, 'bad_request', 'userId y eventId son requeridos.');
	}

	if (input.action === 'assign') {
		const membershipRole = input.membershipRole === 'owner' ? 'owner' : 'manager';
		const membership = await createEventMembershipService({
			eventId,
			userId,
			membershipRole,
		});

		await logAdminAction({
			actorId: sanitize(input.actorUserId, 120),
			action: 'assign_event_membership',
			targetTable: 'event_memberships',
			targetId: membership.id,
			oldData: null,
			newData: membership as unknown as Record<string, unknown>,
		});

		return {
			userId,
			eventId,
			action: 'assign',
			membershipRole: membership.membershipRole,
			changedAt: membership.updatedAt,
		};
	}

	const removed = await softDeleteEventMembershipService({
		eventId,
		userId,
	});
	if (!removed) {
		throw new ApiError(404, 'not_found', 'No existe una asignación activa para este evento.');
	}

	await logAdminAction({
		actorId: sanitize(input.actorUserId, 120),
		action: 'remove_event_membership',
		targetTable: 'event_memberships',
		targetId: removed.id,
		oldData: removed as unknown as Record<string, unknown>,
		newData: {
			...removed,
			deletedAt: new Date().toISOString(),
		},
	});

	return {
		userId,
		eventId,
		action: 'remove',
		membershipRole: null,
		changedAt: new Date().toISOString(),
	};
}
