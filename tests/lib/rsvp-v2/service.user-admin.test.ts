import {
	createAdminUser,
	generateTemporaryPassword,
	updateUserLoginAliasAdmin,
} from '@/lib/rsvp/services/user-admin.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	adminUpdateManagedLoginAlias,
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
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';

jest.mock('@/lib/rsvp/auth/auth-api', () => ({
	createAuthUserByAdmin: jest.fn(),
	adminUpdateManagedLoginAlias: jest.fn(),
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

describe('rsvp user admin service', () => {
	afterEach(() => {
		jest.clearAllMocks();
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
			});

			expect(adminUpdateManagedLoginAliasMock).toHaveBeenCalledWith({
				userId: 'user-host',
				email: 'abril_becerra@clientes.celebra.invalid',
				loginAlias: 'abril_becerra',
			});
			expect(result.item.email).toBe('abril_becerra');
			expect(logAdminActionMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: 'update_user_login_alias',
					oldData: { loginAlias: 'abril_michelle_becerra_rea' },
					newData: { loginAlias: 'abril_becerra' },
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
			});

			expect(adminUpdateManagedLoginAliasMock).not.toHaveBeenCalled();
			expect(result.item.email).toBe('abril_becerra');
			expect(logAdminActionMock).not.toHaveBeenCalled();
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

			await expect(
				updateUserLoginAliasAdmin({
					userId: 'user-host',
					loginAlias: 'alba_quinones',
					actorUserId: 'admin-1',
				}),
			).rejects.toMatchObject<Partial<ApiError>>({
				status: 409,
				code: 'conflict',
			});
			expect(adminUpdateManagedLoginAliasMock).not.toHaveBeenCalled();
		});
	});
});
