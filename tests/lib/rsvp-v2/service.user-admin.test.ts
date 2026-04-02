import { createAdminUser, generateTemporaryPassword } from '@/lib/rsvp/services/user-admin.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	createAuthUserByAdmin,
	findAuthUserByEmail,
	findAuthUserByLoginIdentifier,
} from '@/lib/rsvp/auth/auth-api';
import { upsertUserRoleService } from '@/lib/rsvp/repositories/role-membership.repository';
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';

jest.mock('@/lib/rsvp/auth/auth-api', () => ({
	createAuthUserByAdmin: jest.fn(),
	findAuthUserByEmail: jest.fn(),
	findAuthUserByLoginIdentifier: jest.fn(),
	listAuthUsers: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/role-membership.repository', () => ({
	findAppUserRoleByUserIdService: jest.fn(),
	listUserRolesService: jest.fn(),
	upsertUserRoleService: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/audit-logger.service', () => ({
	logAdminAction: jest.fn(),
}));

const createAuthUserByAdminMock = createAuthUserByAdmin as jest.MockedFunction<
	typeof createAuthUserByAdmin
>;
const findAuthUserByEmailMock = findAuthUserByEmail as jest.MockedFunction<
	typeof findAuthUserByEmail
>;
const findAuthUserByLoginIdentifierMock = findAuthUserByLoginIdentifier as jest.MockedFunction<
	typeof findAuthUserByLoginIdentifier
>;
const upsertUserRoleServiceMock = upsertUserRoleService as jest.MockedFunction<
	typeof upsertUserRoleService
>;
const logAdminActionMock = logAdminAction as jest.MockedFunction<typeof logAdminAction>;

describe('rsvp user admin service', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('generates simple temporary passwords from the provided seed', () => {
		expect(generateTemporaryPassword('ximena_meza')).toBe('ximenameza2026');
		expect(generateTemporaryPassword()).toBe('celebra2026');
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
			password: 'newclienttes2026',
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
		expect(result.credentials.temporaryPassword).toBe('newclienttes2026');
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
			password: expect.stringMatching(/^cliente[a-z0-9]{1,8}2026$/),
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
			password: 'ximenameza2026',
			loginAlias: 'ximena_meza',
		});
		expect(findAuthUserByEmailMock).toHaveBeenCalledWith({
			email: 'ximena_meza@clientes.celebra.invalid',
		});
		expect(result.item.email).toBe('ximena_meza');
		expect(result.credentials.temporaryPassword).toBe('ximenameza2026');
	});
});
