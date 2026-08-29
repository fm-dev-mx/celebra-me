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
	adminResetAuthUserPassword,
	adminUpdateManagedLoginAlias,
	findAuthUserByEmail,
	findAuthUserByLoginIdentifier,
	getAuthUserAdminById,
	listAuthUsers,
} from '@/lib/rsvp/auth/auth-api';
import type { UserAssignedEventDTO, UserListItemDTO } from '@/lib/dashboard/dto/users';
import { listAllEventsService } from '@/lib/rsvp/repositories/event.repository';
import { logAdminAction, logAdminActionStrict } from '@/lib/rsvp/services/audit-logger.service';
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { sanitize } from '@/lib/rsvp/core/utils';
import { ApiError, isAuthRequestError } from '@/lib/rsvp/core/errors';
import {
	assertValidEmail,
	isValidLoginAlias,
	normalizeEmail,
	normalizeLoginIdentifier,
} from '@/lib/rsvp/security/auth-security';
import {
	buildManagedHostEmail,
	HOST_LOGIN_DOMAIN,
	isManagedHostEmail,
	normalizeHostLoginAlias,
} from '@/lib/auth/login-alias';
import type { InvitationMutationCommandContext } from '@/lib/intake/mutations/command-context';
import {
	TEMP_PASSWORD_SYMBOLS,
	TEMP_PASSWORD_WORDS,
} from '@/lib/rsvp/services/user-admin-passwords';
import { createMutationOutcome, type MutationOutcome } from '@/lib/intake/mutations/outcome';
import { recordInvitationMutationOutcome } from '@/lib/intake/services/mutation-operation.service';
import { findMutationOperationReceipt } from '@/lib/intake/repositories/mutation-operation.repository';
import { getSupabaseServiceRoleKey } from '@/lib/server/supabase-credentials';

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

/**
 * Generates a short, memorable temporary password using CSPRNG.
 * Format: Word-####! (easy to dictate; change required on first login).
 */
export function generateTemporaryPassword(): string {
	const raw = TEMP_PASSWORD_WORDS[randomInt(0, TEMP_PASSWORD_WORDS.length)];
	const word = raw.charAt(0).toUpperCase() + raw.slice(1);
	const digits = String(randomInt(0, 10_000)).padStart(4, '0');
	const symbol = TEMP_PASSWORD_SYMBOLS[randomInt(0, TEMP_PASSWORD_SYMBOLS.length)];
	return `${word}-${digits}${symbol}`;
}

export function deriveTemporaryPasswordForOperation(
	operationId: string,
	secret = getSupabaseServiceRoleKey(),
): string {
	const digest = createHmac('sha256', secret)
		.update(`celebra-me:password-reset:${operationId}`)
		.digest();
	const raw = TEMP_PASSWORD_WORDS[digest.readUInt16BE(0) % TEMP_PASSWORD_WORDS.length]!;
	const word = raw.charAt(0).toUpperCase() + raw.slice(1);
	const digits = String(digest.readUInt16BE(2) % 10_000).padStart(4, '0');
	const symbol = TEMP_PASSWORD_SYMBOLS[digest[4]! % TEMP_PASSWORD_SYMBOLS.length]!;
	return `${word}-${digits}${symbol}`;
}

async function recordIdentityMutation(input: {
	context: InvitationMutationCommandContext;
	commandKind: 'admin_password_reset' | 'admin_login_alias_update';
	status: 'not_applied' | 'applied' | 'partial' | 'replayed';
	completedSteps: string[];
	userId: string;
	inputHash?: string;
	error?: unknown;
}): Promise<boolean> {
	try {
		await recordInvitationMutationOutcome({
			context: input.context,
			invitationId: null,
			commandKind: input.commandKind,
			status: input.status,
			completedSteps: input.completedSteps,
			inputHashes: input.inputHash ? { mutationValueHash: input.inputHash } : {},
			expectedState: { targetUserId: input.userId },
			result: { targetUserId: input.userId },
			error: input.error,
		});
		return true;
	} catch {
		return false;
	}
}

async function ensureRetryParentReceipt(input: {
	context: InvitationMutationCommandContext;
	rootOperationId: string;
	commandKind: 'admin_password_reset' | 'admin_login_alias_update';
	completedSteps: string[];
	userId: string;
	inputHash?: string;
}): Promise<Awaited<ReturnType<typeof findMutationOperationReceipt>>> {
	let parent = await findMutationOperationReceipt(input.rootOperationId);
	if (!parent && input.context.operationId !== input.rootOperationId) {
		await recordIdentityMutation({
			context: {
				...input.context,
				operationId: input.rootOperationId,
				retryOfOperationId: undefined,
			},
			commandKind: input.commandKind,
			status: 'partial',
			completedSteps: input.completedSteps,
			userId: input.userId,
			inputHash: input.inputHash,
			error: new Error('External mutation succeeded before its receipt was persisted.'),
		});
		parent = await findMutationOperationReceipt(input.rootOperationId);
	}
	return parent;
}

function generateManagedLoginAlias(): string {
	return `cliente-${randomBytes(4).toString('hex')}`;
}

async function reserveManagedLoginAlias(seed?: string): Promise<string> {
	const normalizedSeed = normalizeHostLoginAlias(seed || '');
	const candidates = normalizedSeed
		? [normalizedSeed, `${normalizedSeed}-${randomBytes(2).toString('hex')}`]
		: [generateManagedLoginAlias()];

	for (const candidate of candidates) {
		const [existingByIdentifier, existingByEmail] = await Promise.all([
			findAuthUserByLoginIdentifier({ identifier: candidate }),
			findAuthUserByEmail({ email: buildManagedHostEmail(candidate) }),
		]);
		if (!existingByIdentifier && !existingByEmail) {
			return candidate;
		}
	}

	for (let attempt = 0; attempt < 5; attempt += 1) {
		const candidate = generateManagedLoginAlias();
		const [existingByIdentifier, existingByEmail] = await Promise.all([
			findAuthUserByLoginIdentifier({ identifier: candidate }),
			findAuthUserByEmail({ email: buildManagedHostEmail(candidate) }),
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
		authEmail = buildManagedHostEmail(loginAlias);
		visibleLogin = loginAlias;
	}

	const temporaryPassword = generateTemporaryPassword();
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
			must_change_password: true,
		},
	});

	return {
		item,
		credentials: {
			temporaryPassword,
		},
	};
}

export async function resetUserPasswordAdmin(input: {
	userId: string;
	actorUserId: string;
	credentialOperationId: string;
	commandContext: InvitationMutationCommandContext;
}): Promise<{
	userId: string;
	credentials?: {
		temporaryPassword: string;
	};
	outcome: MutationOutcome;
}> {
	const userId = sanitize(input.userId, 120);
	if (!userId) {
		throw new ApiError(400, 'bad_request', 'userId es requerido.');
	}

	const rootOperationId = input.credentialOperationId;
	const temporaryPassword = deriveTemporaryPasswordForOperation(rootOperationId);
	const completedSteps: string[] = [];
	let authAlreadyApplied: boolean;
	try {
		const existingAuth = await getAuthUserAdminById(userId);
		authAlreadyApplied =
			existingAuth.user_metadata?.password_reset_operation_id === rootOperationId;
		if (!authAlreadyApplied) {
			await adminResetAuthUserPassword({
				userId,
				password: temporaryPassword,
				mustChangePassword: true,
				operationId: rootOperationId,
			});
		}
		completedSteps.push('auth_password_updated');
	} catch (error) {
		await recordIdentityMutation({
			context: input.commandContext,
			commandKind: 'admin_password_reset',
			status: 'not_applied',
			completedSteps,
			userId,
			error,
		});
		if (isAuthRequestError(error) && error.retryable) throw error;
		return {
			userId,
			outcome: createMutationOutcome({
				operationId: input.commandContext.operationId,
				status: 'not_applied',
				completedSteps,
				error,
			}),
		};
	}

	const parentReceipt = await ensureRetryParentReceipt({
		context: input.commandContext,
		rootOperationId,
		commandKind: 'admin_password_reset',
		completedSteps,
		userId,
	});
	try {
		if (!parentReceipt?.completedSteps.includes('audit_logged')) {
			await logAdminActionStrict({
				actorId: sanitize(input.actorUserId, 120),
				action: 'reset_user_password',
				targetTable: 'auth.users',
				targetId: userId,
				oldData: null,
				newData: {
					userId,
					must_change_password: true,
					operationId: rootOperationId,
				},
			});
		}
		completedSteps.push('audit_logged');
	} catch (error) {
		await recordIdentityMutation({
			context: input.commandContext,
			commandKind: 'admin_password_reset',
			status: 'partial',
			completedSteps,
			userId,
			error,
		});
		return {
			userId,
			credentials: { temporaryPassword },
			outcome: createMutationOutcome({
				operationId: input.commandContext.operationId,
				status: 'partial',
				completedSteps,
				error,
			}),
		};
	}

	const status = authAlreadyApplied ? 'replayed' : 'applied';
	const receiptPersisted = await recordIdentityMutation({
		context: input.commandContext,
		commandKind: 'admin_password_reset',
		status,
		completedSteps,
		userId,
	});
	if (!receiptPersisted) {
		return {
			userId,
			credentials: { temporaryPassword },
			outcome: createMutationOutcome({
				operationId: input.commandContext.operationId,
				status: 'partial',
				completedSteps,
				error: new Error(
					'Password changed but its operation receipt could not be persisted.',
				),
			}),
		};
	}
	return {
		userId,
		credentials: { temporaryPassword },
		outcome: createMutationOutcome({
			operationId: input.commandContext.operationId,
			status,
			completedSteps,
			...(status === 'replayed' ? { replayedFromOperationId: rootOperationId } : {}),
		}),
	};
}

function resolveCurrentManagedAlias(input: { email?: string; loginAlias?: string }): string | null {
	if (!isManagedHostEmail(input.email)) return null;
	const alias = input.loginAlias?.trim().toLowerCase();
	if (alias && isValidLoginAlias(alias)) return alias;
	const email = (input.email || '').trim().toLowerCase();
	const suffix = `@${HOST_LOGIN_DOMAIN}`;
	const localPart = email.slice(0, -suffix.length);
	return isValidLoginAlias(localPart) ? localPart : null;
}

async function buildAssignedEventsForUser(userId: string): Promise<UserAssignedEventDTO[]> {
	const [memberships, events] = await Promise.all([
		listEventMembershipsService(),
		listAllEventsService(),
	]);
	const eventMap = new Map(
		events.map((event) => [
			event.id,
			{ eventId: event.id, title: event.title, slug: event.slug },
		]),
	);
	return memberships
		.filter((membership) => membership.userId === userId)
		.map((membership) => {
			const event = eventMap.get(membership.eventId);
			if (!event) return null;
			return {
				...event,
				membershipRole: membership.membershipRole,
			};
		})
		.filter((value): value is UserAssignedEventDTO => Boolean(value))
		.sort((left, right) => left.title.localeCompare(right.title, 'es-MX'));
}

// eslint-disable-next-line complexity -- External Auth, collision, audit, receipt, and replay boundaries require explicit outcome branches.
export async function updateUserLoginAliasAdmin(input: {
	userId: string;
	loginAlias: string;
	actorUserId: string;
	aliasOperationId: string;
	commandContext: InvitationMutationCommandContext;
}): Promise<{ item?: UserListItemDTO; outcome: MutationOutcome }> {
	const userId = sanitize(input.userId, 120);
	if (!userId) {
		throw new ApiError(400, 'bad_request', 'userId es requerido.');
	}

	const requestedAlias = normalizeLoginIdentifier(input.loginAlias);
	if (!isValidLoginAlias(requestedAlias)) {
		throw new ApiError(400, 'bad_request', 'El usuario de acceso es inválido.');
	}
	const aliasHash = createHash('sha256').update(requestedAlias).digest('hex');
	const completedSteps: string[] = [];

	const existingAuth = await getAuthUserAdminById(userId);
	const existingMappedAlias =
		typeof existingAuth.user_metadata?.login_alias === 'string'
			? existingAuth.user_metadata.login_alias.trim().toLowerCase()
			: undefined;
	const existingOperationId =
		typeof existingAuth.user_metadata?.login_alias_operation_id === 'string'
			? existingAuth.user_metadata.login_alias_operation_id
			: null;

	if (!isManagedHostEmail(existingAuth.email)) {
		throw new ApiError(
			400,
			'bad_request',
			'Solo se puede editar el usuario de acceso de cuentas administradas (sin correo real).',
		);
	}

	const previousAlias = resolveCurrentManagedAlias({
		email: existingAuth.email,
		loginAlias: existingMappedAlias,
	});
	if (!previousAlias) {
		throw new ApiError(
			400,
			'bad_request',
			'Solo se puede editar el usuario de acceso de cuentas administradas (sin correo real).',
		);
	}

	const targetEmail = buildManagedHostEmail(requestedAlias);
	const authAlreadyApplied =
		previousAlias === requestedAlias && existingOperationId === input.aliasOperationId;
	let updatedAuth = existingAuth;
	try {
		if (!authAlreadyApplied) {
			const [existingByIdentifier, existingByEmail] = await Promise.all([
				findAuthUserByLoginIdentifier({ identifier: requestedAlias }),
				findAuthUserByEmail({ email: targetEmail }),
			]);
			if (
				(existingByIdentifier && existingByIdentifier.id !== userId) ||
				(existingByEmail && existingByEmail.id !== userId)
			) {
				throw new ApiError(
					409,
					'conflict',
					'Ya existe un usuario con este usuario de acceso.',
				);
			}
			updatedAuth = await adminUpdateManagedLoginAlias({
				userId,
				email: targetEmail,
				loginAlias: requestedAlias,
				operationId: input.aliasOperationId,
			});
		}
		completedSteps.push('auth_alias_updated');
	} catch (error) {
		await recordIdentityMutation({
			context: input.commandContext,
			commandKind: 'admin_login_alias_update',
			status: 'not_applied',
			completedSteps,
			userId,
			inputHash: aliasHash,
			error,
		});
		if (isAuthRequestError(error) && error.retryable) throw error;
		return {
			outcome: createMutationOutcome({
				operationId: input.commandContext.operationId,
				status: 'not_applied',
				completedSteps,
				error,
			}),
		};
	}

	const parentReceipt = await ensureRetryParentReceipt({
		context: input.commandContext,
		rootOperationId: input.aliasOperationId,
		commandKind: 'admin_login_alias_update',
		completedSteps,
		userId,
		inputHash: aliasHash,
	});
	try {
		if (!parentReceipt?.completedSteps.includes('audit_logged')) {
			await logAdminActionStrict({
				actorId: sanitize(input.actorUserId, 120),
				action: 'update_user_login_alias',
				targetTable: 'auth.users',
				targetId: userId,
				oldData: { loginAlias: previousAlias },
				newData: { loginAlias: requestedAlias, operationId: input.aliasOperationId },
			});
		}
		completedSteps.push('audit_logged');
	} catch (error) {
		await recordIdentityMutation({
			context: input.commandContext,
			commandKind: 'admin_login_alias_update',
			status: 'partial',
			completedSteps,
			userId,
			inputHash: aliasHash,
			error,
		});
		const [roleRecord, assignedEvents] = await Promise.all([
			findAppUserRoleByUserIdService(userId),
			buildAssignedEventsForUser(userId),
		]);
		return {
			item: {
				id: userId,
				email: requestedAlias,
				role: roleRecord?.role ?? 'host_client',
				createdAt:
					updatedAuth.created_at || existingAuth.created_at || new Date().toISOString(),
				assignedEvents,
			},
			outcome: createMutationOutcome({
				operationId: input.commandContext.operationId,
				status: 'partial',
				completedSteps,
				error,
			}),
		};
	}

	const [roleRecord, assignedEvents] = await Promise.all([
		findAppUserRoleByUserIdService(userId),
		buildAssignedEventsForUser(userId),
	]);

	const item: UserListItemDTO = {
		id: updatedAuth.id,
		email: requestedAlias,
		role: roleRecord?.role ?? 'host_client',
		createdAt: updatedAuth.created_at || existingAuth.created_at || new Date().toISOString(),
		assignedEvents,
	};
	const status = authAlreadyApplied ? 'replayed' : 'applied';
	const receiptPersisted = await recordIdentityMutation({
		context: input.commandContext,
		commandKind: 'admin_login_alias_update',
		status,
		completedSteps,
		userId,
		inputHash: aliasHash,
	});
	return {
		item,
		outcome: createMutationOutcome({
			operationId: input.commandContext.operationId,
			status: receiptPersisted ? status : 'partial',
			completedSteps,
			...(!receiptPersisted
				? {
						error: new Error(
							'Alias changed but its operation receipt could not be persisted.',
						),
					}
				: status === 'replayed'
					? { replayedFromOperationId: input.aliasOperationId }
					: {}),
		}),
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
