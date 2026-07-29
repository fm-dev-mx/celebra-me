import {
	createAdminUser,
	deriveTemporaryPasswordForOperation,
	generateTemporaryPassword,
	resetUserPasswordAdmin,
	updateUserLoginAliasAdmin,
} from '@/lib/rsvp/services/user-admin.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	adminUpdateManagedLoginAlias,
	adminResetAuthUserPassword,
	createAuthUserByAdmin,
	findAuthUserByEmail,
	findAuthUserByLoginIdentifier,
	getAuthUserAdminById,
} from '@/lib/rsvp/auth/auth-api';
import {
	findAppUserRoleByUserIdService,
	listEventMembershipsService,
	upsertUserRoleService,
} from '@/lib/rsvp/repositories/role-membership.repository';
import { listAllEventsService } from '@/lib/rsvp/repositories/event.repository';
import { logAdminAction, logAdminActionStrict } from '@/lib/rsvp/services/audit-logger.service';
import { recordInvitationMutationOutcome } from '@/lib/intake/services/mutation-operation.service';
import { findMutationOperationReceipt } from '@/lib/intake/repositories/mutation-operation.repository';

jest.mock('@/lib/rsvp/auth/auth-api', () => ({
	createAuthUserByAdmin: jest.fn(),
	adminUpdateManagedLoginAlias: jest.fn(),
	adminResetAuthUserPassword: jest.fn(),
	findAuthUserByEmail: jest.fn(),
	findAuthUserByLoginIdentifier: jest.fn(),
	getAuthUserAdminById: jest.fn(),
	listAuthUsers: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/role-membership.repository', () => ({
	findAppUserRoleByUserIdService: jest.fn(),
	listUserRolesService: jest.fn(),
	listEventMembershipsService: jest.fn(),
	upsertUserRoleService: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	listAllEventsService: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/audit-logger.service', () => ({
	logAdminAction: jest.fn(),
	logAdminActionStrict: jest.fn(),
}));

jest.mock('@/lib/intake/services/mutation-operation.service', () => ({
	recordInvitationMutationOutcome: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/mutation-operation.repository', () => ({
	findMutationOperationReceipt: jest.fn(),
}));

const createAuthUserByAdminMock = createAuthUserByAdmin as jest.MockedFunction<
	typeof createAuthUserByAdmin
>;
const adminUpdateManagedLoginAliasMock = adminUpdateManagedLoginAlias as jest.MockedFunction<
	typeof adminUpdateManagedLoginAlias
>;
const findAuthUserByEmailMock = findAuthUserByEmail as jest.MockedFunction<
	typeof findAuthUserByEmail
>;
const findAuthUserByLoginIdentifierMock = findAuthUserByLoginIdentifier as jest.MockedFunction<
	typeof findAuthUserByLoginIdentifier
>;
const getAuthUserAdminByIdMock = getAuthUserAdminById as jest.MockedFunction<
	typeof getAuthUserAdminById
>;
const findAppUserRoleByUserIdServiceMock = findAppUserRoleByUserIdService as jest.MockedFunction<
	typeof findAppUserRoleByUserIdService
>;
const listEventMembershipsServiceMock = listEventMembershipsService as jest.MockedFunction<
	typeof listEventMembershipsService
>;
const listAllEventsServiceMock = listAllEventsService as jest.MockedFunction<
	typeof listAllEventsService
>;
const upsertUserRoleServiceMock = upsertUserRoleService as jest.MockedFunction<
	typeof upsertUserRoleService
>;
const logAdminActionMock = logAdminAction as jest.MockedFunction<typeof logAdminAction>;
const logAdminActionStrictMock = logAdminActionStrict as jest.MockedFunction<
	typeof logAdminActionStrict
>;
const adminResetAuthUserPasswordMock = adminResetAuthUserPassword as jest.MockedFunction<
	typeof adminResetAuthUserPassword
>;
const recordInvitationMutationOutcomeMock = recordInvitationMutationOutcome as jest.MockedFunction<
	typeof recordInvitationMutationOutcome
>;
const findMutationOperationReceiptMock = findMutationOperationReceipt as jest.MockedFunction<
	typeof findMutationOperationReceipt
>;

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const COMMAND_CONTEXT = {
	operationId: OPERATION_ID,
	environment: 'local',
	projectRef: 'celebra-me-rsvp',
	actorId: 'admin-1',
	actorType: 'admin',
	origin: 'system',
} as const;

describe('rsvp user admin service', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	beforeEach(() => {
		findMutationOperationReceiptMock.mockResolvedValue(null);
		recordInvitationMutationOutcomeMock.mockResolvedValue({
			operationId: OPERATION_ID,
			status: 'applied',
			durableMutation: true,
			completedSteps: [],
		});
		logAdminActionStrictMock.mockResolvedValue(undefined);
	});

	it('generates short memorable temporary passwords with secure randomness', () => {
		const pwd1 = generateTemporaryPassword();
		const pwd2 = generateTemporaryPassword();
		const pattern = /^[A-Z][a-z]+-\d{4}[!@#$%*]$/;
		expect(pwd1).toMatch(pattern);
		expect(pwd2).toMatch(pattern);
		expect(pwd1).not.toBe(pwd2);
		expect(pwd1.length).toBeLessThanOrEqual(16);
		expect(pwd1).not.toMatch(/[áéíóúñü]/i);
	});

	it('derives the same strong temporary password for the same operation without persistence', () => {
		const first = deriveTemporaryPasswordForOperation(OPERATION_ID, 'test-secret');
		const second = deriveTemporaryPasswordForOperation(OPERATION_ID, 'test-secret');
		expect(first).toBe(second);
		expect(first).toMatch(/^[A-Z][a-z]+-\d{4}[!@#$%*]$/);
	});

	describe('resetUserPasswordAdmin outcomes', () => {
		beforeEach(() => {
			process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-secret';
			getAuthUserAdminByIdMock.mockResolvedValue({
				id: 'user-host',
				email: 'abril_becerra@clientes.celebra.invalid',
				user_metadata: {},
				app_metadata: {},
			});
			adminResetAuthUserPasswordMock.mockResolvedValue({ id: 'user-host' });
		});

		it('returns not_applied when Auth rejects the mutation', async () => {
			adminResetAuthUserPasswordMock.mockRejectedValue(new Error('Auth unavailable'));
			const result = await resetUserPasswordAdmin({
				userId: 'user-host',
				actorUserId: 'admin-1',
				credentialOperationId: OPERATION_ID,
				commandContext: COMMAND_CONTEXT,
			});
			expect(result.outcome.status).toBe('not_applied');
			expect(result.credentials).toBeUndefined();
			expect(recordInvitationMutationOutcomeMock).toHaveBeenCalledWith(
				expect.objectContaining({ status: 'not_applied', completedSteps: [] }),
			);
		});

		it('returns applied with the credential and stores no secret in receipt inputs', async () => {
			const result = await resetUserPasswordAdmin({
				userId: 'user-host',
				actorUserId: 'admin-1',
				credentialOperationId: OPERATION_ID,
				commandContext: COMMAND_CONTEXT,
			});
			expect(result.outcome.status).toBe('applied');
			expect(result.credentials?.temporaryPassword).toBeDefined();
			expect(adminResetAuthUserPasswordMock).toHaveBeenCalledWith(
				expect.objectContaining({ operationId: OPERATION_ID }),
			);
			const receiptInput = recordInvitationMutationOutcomeMock.mock.calls.at(-1)?.[0];
			expect(JSON.stringify(receiptInput)).not.toContain(
				result.credentials!.temporaryPassword,
			);
		});

		it('returns partial and still returns the accepted credential when audit fails', async () => {
			logAdminActionStrictMock.mockRejectedValue(new Error('audit unavailable'));
			const result = await resetUserPasswordAdmin({
				userId: 'user-host',
				actorUserId: 'admin-1',
				credentialOperationId: OPERATION_ID,
				commandContext: COMMAND_CONTEXT,
			});
			expect(result.outcome.status).toBe('partial');
			expect(result.outcome.completedSteps).toEqual(['auth_password_updated']);
			expect(result.credentials?.temporaryPassword).toBeDefined();
			expect(recordInvitationMutationOutcomeMock).toHaveBeenCalledWith(
				expect.objectContaining({ status: 'partial' }),
			);
		});

		it('returns partial without rotating Auth when the receipt write fails after success', async () => {
			recordInvitationMutationOutcomeMock.mockRejectedValueOnce(
				new Error('receipt unavailable'),
			);
			const result = await resetUserPasswordAdmin({
				userId: 'user-host',
				actorUserId: 'admin-1',
				credentialOperationId: OPERATION_ID,
				commandContext: COMMAND_CONTEXT,
			});
			expect(result.outcome).toMatchObject({
				status: 'partial',
				completedSteps: ['auth_password_updated', 'audit_logged'],
			});
			expect(result.credentials?.temporaryPassword).toBeDefined();
			expect(adminResetAuthUserPasswordMock).toHaveBeenCalledTimes(1);
		});

		it('repairs a partial retry without rotating Auth again', async () => {
			const retryOperationId = '22222222-2222-4222-8222-222222222222';
			getAuthUserAdminByIdMock.mockResolvedValue({
				id: 'user-host',
				email: 'abril_becerra@clientes.celebra.invalid',
				user_metadata: { password_reset_operation_id: OPERATION_ID },
				app_metadata: {},
			});
			findMutationOperationReceiptMock.mockResolvedValue({
				operationId: OPERATION_ID,
				status: 'partial',
				commandKind: 'admin_password_reset',
				completedSteps: ['auth_password_updated'],
				retryOfOperationId: null,
			});
			const result = await resetUserPasswordAdmin({
				userId: 'user-host',
				actorUserId: 'admin-1',
				credentialOperationId: OPERATION_ID,
				commandContext: {
					...COMMAND_CONTEXT,
					operationId: retryOperationId,
					retryOfOperationId: OPERATION_ID,
				},
			});
			expect(adminResetAuthUserPasswordMock).not.toHaveBeenCalled();
			expect(result.outcome.status).toBe('replayed');
			expect(result.credentials?.temporaryPassword).toBe(
				deriveTemporaryPasswordForOperation(OPERATION_ID, 'test-service-secret'),
			);
		});
	});

	it('creates a new admin-managed user without persisting the password', async () => {
		findAuthUserByEmailMock.mockResolvedValue(null);
		createAuthUserByAdminMock.mockResolvedValue({
			id: 'user-1',
			email: 'new-client@test.com',
			created_at: '2026-04-01T00:00:00.000Z',
		});
		upsertUserRoleServiceMock.mockResolvedValue({
			userId: 'user-1',
			role: 'host_client',
			createdAt: '2026-04-01T00:00:00.000Z',
			updatedAt: '2026-04-01T00:00:00.000Z',
		});

		const result = await createAdminUser({
			email: ' New-Client@Test.com ',
			role: 'host_client',
			actorUserId: 'admin-1',
		});

		expect(findAuthUserByEmailMock).toHaveBeenCalledWith({
			email: 'new-client@test.com',
		});
		expect(createAuthUserByAdminMock).toHaveBeenCalledWith({
			email: 'new-client@test.com',
			password: expect.any(String),
			loginAlias: undefined,
		});
		expect(upsertUserRoleServiceMock).toHaveBeenCalledWith({
			userId: 'user-1',
			role: 'host_client',
		});
		expect(result.item).toEqual({
			id: 'user-1',
			email: 'new-client@test.com',
			role: 'host_client',
			createdAt: '2026-04-01T00:00:00.000Z',
			assignedEvents: [],
		});
		expect(result.credentials.temporaryPassword).toBeDefined();
		expect(logAdminActionMock).toHaveBeenCalledWith(
			expect.objectContaining({
				action: 'create_user',
				targetTable: 'auth.users',
				targetId: 'user-1',
				newData: expect.not.objectContaining({
					temporaryPassword: expect.any(String),
				}),
			}),
		);
	});

	it('rejects duplicate emails before creating the auth user', async () => {
		findAuthUserByEmailMock.mockResolvedValue({
			id: 'existing-user',
			email: 'existing@test.com',
		});

		await expect(
			createAdminUser({
				email: 'existing@test.com',
				role: 'super_admin',
				actorUserId: 'admin-1',
			}),
		).rejects.toMatchObject<Partial<ApiError>>({
			status: 409,
			code: 'conflict',
		});
		expect(createAuthUserByAdminMock).not.toHaveBeenCalled();
		expect(upsertUserRoleServiceMock).not.toHaveBeenCalled();
		expect(logAdminActionMock).not.toHaveBeenCalled();
	});

	it('generates an internal access user when no email is provided', async () => {
		findAuthUserByLoginIdentifierMock.mockResolvedValueOnce(null);
		findAuthUserByEmailMock.mockResolvedValueOnce(null);
		createAuthUserByAdminMock.mockResolvedValue({
			id: 'user-2',
			email: 'cliente-abcdef12@clientes.celebra.invalid',
			login_alias: 'cliente-ab12cd34',
			created_at: '2026-04-01T00:00:00.000Z',
		});
		upsertUserRoleServiceMock.mockResolvedValue({
			userId: 'user-2',
			role: 'host_client',
			createdAt: '2026-04-01T00:00:00.000Z',
			updatedAt: '2026-04-01T00:00:00.000Z',
		});

		const result = await createAdminUser({
			role: 'host_client',
			actorUserId: 'admin-1',
		});

		expect(findAuthUserByEmailMock).toHaveBeenCalledWith({
			email: expect.stringMatching(/@clientes\.celebra\.invalid$/),
		});
		expect(createAuthUserByAdminMock).toHaveBeenCalledWith({
			email: expect.stringMatching(/@clientes\.celebra\.invalid$/),
			password: expect.any(String),
			loginAlias: expect.stringMatching(/^cliente-[a-f0-9]{8}$/),
		});
		expect(result.item.email).toMatch(/^cliente-[a-f0-9]{8}$/);
	});

	it('turns a simple alias into a visible access user and stores the internal email only behind the scenes', async () => {
		findAuthUserByLoginIdentifierMock.mockResolvedValueOnce(null);
		findAuthUserByEmailMock.mockResolvedValueOnce(null);
		createAuthUserByAdminMock.mockResolvedValue({
			id: 'user-3',
			email: 'ximena_meza@clientes.celebra.invalid',
			login_alias: 'ximena_meza',
			created_at: '2026-04-01T00:00:00.000Z',
		});
		upsertUserRoleServiceMock.mockResolvedValue({
			userId: 'user-3',
			role: 'host_client',
			createdAt: '2026-04-01T00:00:00.000Z',
			updatedAt: '2026-04-01T00:00:00.000Z',
		});

		const result = await createAdminUser({
			email: 'ximena_meza',
			role: 'host_client',
			actorUserId: 'admin-1',
		});

		expect(findAuthUserByLoginIdentifierMock).toHaveBeenCalledWith({
			identifier: 'ximena_meza',
		});
		expect(createAuthUserByAdminMock).toHaveBeenCalledWith({
			email: expect.stringMatching(/@clientes\.celebra\.invalid$/),
			password: expect.any(String),
			loginAlias: 'ximena_meza',
		});
		expect(findAuthUserByEmailMock).toHaveBeenCalledWith({
			email: 'ximena_meza@clientes.celebra.invalid',
		});
		expect(result.item.email).toBe('ximena_meza');
		expect(result.credentials.temporaryPassword).toBeDefined();
	});

	describe('updateUserLoginAliasAdmin', () => {
		beforeEach(() => {
			listEventMembershipsServiceMock.mockResolvedValue([]);
			listAllEventsServiceMock.mockResolvedValue([]);
			findAppUserRoleByUserIdServiceMock.mockResolvedValue({
				userId: 'user-host',
				role: 'host_client',
				createdAt: '2026-04-01T00:00:00.000Z',
				updatedAt: '2026-04-01T00:00:00.000Z',
			});
		});

		it('renames a managed host login alias', async () => {
			getAuthUserAdminByIdMock.mockResolvedValue({
				id: 'user-host',
				email: 'abril_michelle_becerra_rea@clientes.celebra.invalid',
				created_at: '2026-04-01T00:00:00.000Z',
				user_metadata: { login_alias: 'abril_michelle_becerra_rea' },
				app_metadata: {},
			});
			findAuthUserByLoginIdentifierMock.mockResolvedValue(null);
			findAuthUserByEmailMock.mockResolvedValue(null);
			adminUpdateManagedLoginAliasMock.mockResolvedValue({
				id: 'user-host',
				email: 'abril_becerra@clientes.celebra.invalid',
				login_alias: 'abril_becerra',
				created_at: '2026-04-01T00:00:00.000Z',
			});

			const result = await updateUserLoginAliasAdmin({
				userId: 'user-host',
				loginAlias: ' Abril_Becerra ',
				actorUserId: 'admin-1',
				aliasOperationId: OPERATION_ID,
				commandContext: COMMAND_CONTEXT,
			});

			expect(adminUpdateManagedLoginAliasMock).toHaveBeenCalledWith({
				userId: 'user-host',
				email: 'abril_becerra@clientes.celebra.invalid',
				loginAlias: 'abril_becerra',
				operationId: OPERATION_ID,
			});
			expect(result.item?.email).toBe('abril_becerra');
			expect(logAdminActionStrictMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: 'update_user_login_alias',
					oldData: { loginAlias: 'abril_michelle_becerra_rea' },
					newData: { loginAlias: 'abril_becerra', operationId: OPERATION_ID },
				}),
			);
		});

		it('is a no-op when the alias is unchanged', async () => {
			getAuthUserAdminByIdMock.mockResolvedValue({
				id: 'user-host',
				email: 'abril_becerra@clientes.celebra.invalid',
				created_at: '2026-04-01T00:00:00.000Z',
				user_metadata: { login_alias: 'abril_becerra' },
				app_metadata: {},
			});

			const result = await updateUserLoginAliasAdmin({
				userId: 'user-host',
				loginAlias: 'abril_becerra',
				actorUserId: 'admin-1',
				aliasOperationId: OPERATION_ID,
				commandContext: COMMAND_CONTEXT,
			});

			expect(adminUpdateManagedLoginAliasMock).toHaveBeenCalledWith(
				expect.objectContaining({ operationId: OPERATION_ID }),
			);
			expect(result.item?.email).toBe('abril_becerra');
		});

		it('rejects real-email users', async () => {
			getAuthUserAdminByIdMock.mockResolvedValue({
				id: 'user-email',
				email: 'cliente@ejemplo.com',
				created_at: '2026-04-01T00:00:00.000Z',
				user_metadata: {},
				app_metadata: {},
			});

			await expect(
				updateUserLoginAliasAdmin({
					userId: 'user-email',
					loginAlias: 'nuevo_alias',
					actorUserId: 'admin-1',
					aliasOperationId: OPERATION_ID,
					commandContext: COMMAND_CONTEXT,
				}),
			).rejects.toMatchObject<Partial<ApiError>>({
				status: 400,
				code: 'bad_request',
			});
			expect(adminUpdateManagedLoginAliasMock).not.toHaveBeenCalled();
		});

		it('rejects real-email users even when login_alias metadata is present', async () => {
			getAuthUserAdminByIdMock.mockResolvedValue({
				id: 'user-email',
				email: 'cliente@ejemplo.com',
				created_at: '2026-04-01T00:00:00.000Z',
				user_metadata: { login_alias: 'cliente_ejemplo' },
				app_metadata: {},
			});

			await expect(
				updateUserLoginAliasAdmin({
					userId: 'user-email',
					loginAlias: 'nuevo_alias',
					actorUserId: 'admin-1',
					aliasOperationId: OPERATION_ID,
					commandContext: COMMAND_CONTEXT,
				}),
			).rejects.toMatchObject<Partial<ApiError>>({
				status: 400,
				code: 'bad_request',
			});
			expect(adminUpdateManagedLoginAliasMock).not.toHaveBeenCalled();
		});

		it('rejects alias collisions', async () => {
			getAuthUserAdminByIdMock.mockResolvedValue({
				id: 'user-host',
				email: 'abril_becerra@clientes.celebra.invalid',
				created_at: '2026-04-01T00:00:00.000Z',
				user_metadata: { login_alias: 'abril_becerra' },
				app_metadata: {},
			});
			findAuthUserByLoginIdentifierMock.mockResolvedValue({
				id: 'other-user',
				email: 'alba_quinones@clientes.celebra.invalid',
				login_alias: 'alba_quinones',
			});
			findAuthUserByEmailMock.mockResolvedValue(null);

			const result = await updateUserLoginAliasAdmin({
				userId: 'user-host',
				loginAlias: 'alba_quinones',
				actorUserId: 'admin-1',
				aliasOperationId: OPERATION_ID,
				commandContext: COMMAND_CONTEXT,
			});
			expect(result.outcome.status).toBe('not_applied');
			expect(adminUpdateManagedLoginAliasMock).not.toHaveBeenCalled();
		});

		it('returns partial when Auth succeeds but strict audit fails', async () => {
			getAuthUserAdminByIdMock.mockResolvedValue({
				id: 'user-host',
				email: 'abril_anterior@clientes.celebra.invalid',
				created_at: '2026-04-01T00:00:00.000Z',
				user_metadata: { login_alias: 'abril_anterior' },
				app_metadata: {},
			});
			findAuthUserByLoginIdentifierMock.mockResolvedValue(null);
			findAuthUserByEmailMock.mockResolvedValue(null);
			adminUpdateManagedLoginAliasMock.mockResolvedValue({
				id: 'user-host',
				email: 'abril_becerra@clientes.celebra.invalid',
				login_alias: 'abril_becerra',
				created_at: '2026-04-01T00:00:00.000Z',
			});
			logAdminActionStrictMock.mockRejectedValueOnce(new Error('audit unavailable'));

			const result = await updateUserLoginAliasAdmin({
				userId: 'user-host',
				loginAlias: 'abril_becerra',
				actorUserId: 'admin-1',
				aliasOperationId: OPERATION_ID,
				commandContext: COMMAND_CONTEXT,
			});

			expect(result.item?.email).toBe('abril_becerra');
			expect(result.outcome).toMatchObject({
				status: 'partial',
				completedSteps: ['auth_alias_updated'],
			});
			expect(recordInvitationMutationOutcomeMock).toHaveBeenCalledWith(
				expect.objectContaining({ status: 'partial' }),
			);
		});

		it('returns partial without repeating Auth when the alias receipt write fails', async () => {
			getAuthUserAdminByIdMock.mockResolvedValue({
				id: 'user-host',
				email: 'abril_anterior@clientes.celebra.invalid',
				created_at: '2026-04-01T00:00:00.000Z',
				user_metadata: { login_alias: 'abril_anterior' },
				app_metadata: {},
			});
			findAuthUserByLoginIdentifierMock.mockResolvedValue(null);
			findAuthUserByEmailMock.mockResolvedValue(null);
			adminUpdateManagedLoginAliasMock.mockResolvedValue({
				id: 'user-host',
				email: 'abril_becerra@clientes.celebra.invalid',
				login_alias: 'abril_becerra',
				created_at: '2026-04-01T00:00:00.000Z',
			});
			recordInvitationMutationOutcomeMock.mockRejectedValueOnce(
				new Error('receipt unavailable'),
			);

			const result = await updateUserLoginAliasAdmin({
				userId: 'user-host',
				loginAlias: 'abril_becerra',
				actorUserId: 'admin-1',
				aliasOperationId: OPERATION_ID,
				commandContext: COMMAND_CONTEXT,
			});

			expect(result.outcome).toMatchObject({
				status: 'partial',
				completedSteps: ['auth_alias_updated', 'audit_logged'],
			});
			expect(adminUpdateManagedLoginAliasMock).toHaveBeenCalledTimes(1);
		});

		it('repairs a partial alias mutation without applying Auth twice', async () => {
			const retryOperationId = '22222222-2222-4222-8222-222222222222';
			getAuthUserAdminByIdMock.mockResolvedValue({
				id: 'user-host',
				email: 'abril_becerra@clientes.celebra.invalid',
				created_at: '2026-04-01T00:00:00.000Z',
				user_metadata: {
					login_alias: 'abril_becerra',
					login_alias_operation_id: OPERATION_ID,
				},
				app_metadata: {},
			});
			findMutationOperationReceiptMock.mockResolvedValue({
				operationId: OPERATION_ID,
				status: 'partial',
				commandKind: 'admin_login_alias_update',
				completedSteps: ['auth_alias_updated'],
				retryOfOperationId: null,
			});

			const result = await updateUserLoginAliasAdmin({
				userId: 'user-host',
				loginAlias: 'abril_becerra',
				actorUserId: 'admin-1',
				aliasOperationId: OPERATION_ID,
				commandContext: {
					...COMMAND_CONTEXT,
					operationId: retryOperationId,
					retryOfOperationId: OPERATION_ID,
				},
			});

			expect(adminUpdateManagedLoginAliasMock).not.toHaveBeenCalled();
			expect(logAdminActionStrictMock).toHaveBeenCalled();
			expect(result.outcome).toMatchObject({
				operationId: retryOperationId,
				status: 'replayed',
			});
		});
	});
});
