import { GET as getUsers, POST as createUser } from '@/pages/api/dashboard/admin/users';
import { PATCH as updateUserRole } from '@/pages/api/dashboard/admin/users/[userId]/role';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import {
	listAdminUsers,
	changeUserRoleAdmin,
	createAdminUser,
} from '@/lib/rsvp/services/user-admin.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { createMockRequest } from '../helpers/api-mocks';

// Mock funciones de seguridad admin
jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn().mockResolvedValue(undefined as never),
}));

jest.mock('@/lib/rsvp/security/csrf', () => ({
	validateCsrfToken: jest.fn(),
	shouldSkipCsrfValidation: jest.fn().mockReturnValue(false),
	getCsrfTokenFromCookies: jest.fn().mockReturnValue(null),
	getCsrfTokenFromHeader: jest.fn().mockReturnValue(null),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn().mockResolvedValue(true as never),
}));

jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/user-admin.service', () => ({
	listAdminUsers: jest.fn(),
	changeUserRoleAdmin: jest.fn(),
	createAdminUser: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/admin-protection', () => ({
	canChangeUserRole: jest.fn().mockResolvedValue({ allowed: true }),
}));

const requireAdminStrongSessionMock = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const listAdminUsersMock = listAdminUsers as jest.MockedFunction<typeof listAdminUsers>;
const changeUserRoleAdminMock = changeUserRoleAdmin as jest.MockedFunction<
	typeof changeUserRoleAdmin
>;
const createAdminUserMock = createAdminUser as jest.MockedFunction<typeof createAdminUser>;

function createMockUrl(searchParams?: Record<string, string>): URL {
	const url = new URL('http://localhost/api/dashboard/admin/users');
	if (searchParams) {
		Object.entries(searchParams).forEach(([key, value]) => {
			url.searchParams.set(key, value);
		});
	}
	return url;
}

const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_ADMIN_ID = '550e8400-e29b-41d4-a716-446655440001';

describe('Admin Users API', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('GET /api/dashboard/admin/users', () => {
		it('returns 403 when not authenticated as super_admin', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Se requiere autenticación fuerte'),
			);

			const response = await getUsers({
				request: createMockRequest(),
				url: createMockUrl(),
			} as never);
			expect(response.status).toBe(403);
		});

		it('returns list of users with pagination', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockUsers = [
				{
					id: VALID_USER_ID,
					email: 'user1@test.com',
					role: 'host_client' as const,
					createdAt: new Date().toISOString(),
				},
				{
					id: '550e8400-e29b-41d4-a716-446655440002',
					email: 'user2@test.com',
					role: 'super_admin' as const,
					createdAt: new Date().toISOString(),
				},
			];
			listAdminUsersMock.mockResolvedValue(mockUsers);

			const response = await getUsers({
				request: createMockRequest(),
				url: createMockUrl({ page: '2', perPage: '50' }),
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({
				items: [
					{
						id: VALID_USER_ID,
						email: 'user1@test.com',
						role: 'host_client',
						createdAt: expect.any(String),
					},
					{
						id: '550e8400-e29b-41d4-a716-446655440002',
						email: 'user2@test.com',
						role: 'super_admin',
						createdAt: expect.any(String),
					},
				],
				total: 2,
				page: 2,
				perPage: 50,
			});
		});

		it('creates a user and returns one-time credentials', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			createAdminUserMock.mockResolvedValue({
				item: {
					id: VALID_USER_ID,
					email: 'new-user@test.com',
					role: 'host_client',
					createdAt: '2026-04-01T00:00:00.000Z',
				},
				credentials: {
					temporaryPassword: 'newusertest2026',
				},
			});

			const request = createMockRequest(
				{
					email: 'new-user@test.com',
					role: 'host_client',
				},
				undefined,
				'http://localhost/api/dashboard/admin/users',
			);

			const response = await createUser({
				request,
				cookies: {},
			} as never);
			expect(response.status).toBe(201);
			const body = await response.json();
			expect(body).toEqual({
				item: {
					id: VALID_USER_ID,
					email: 'new-user@test.com',
					role: 'host_client',
					createdAt: '2026-04-01T00:00:00.000Z',
				},
				credentials: {
					temporaryPassword: 'newusertest2026',
				},
			});
			expect(createAdminUserMock).toHaveBeenCalledWith({
				email: 'new-user@test.com',
				role: 'host_client',
				actorUserId: VALID_ADMIN_ID,
			});
		});

		it('rejects invalid create-user payloads', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const request = createMockRequest(
				{
					email: 'invalid-email',
					role: 'invalid_role',
				},
				undefined,
				'http://localhost/api/dashboard/admin/users',
			);

			const response = await createUser({
				request,
				cookies: {},
			} as never);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.success).toBe(false);
			expect(body.error.code).toBe('bad_request');
			expect(createAdminUserMock).not.toHaveBeenCalled();
		});

		it('returns conflict when the email already exists', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			createAdminUserMock.mockRejectedValue(
				new ApiError(409, 'conflict', 'Ya existe un usuario con este correo electrónico.'),
			);

			const request = createMockRequest(
				{
					email: 'existing@test.com',
					role: 'super_admin',
				},
				undefined,
				'http://localhost/api/dashboard/admin/users',
			);

			const response = await createUser({
				request,
				cookies: {},
			} as never);
			expect(response.status).toBe(409);
			const body = await response.json();
			expect(body.error.code).toBe('conflict');
		});

		it('allows creating a user from a simple alias and returns the visible access alias', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			createAdminUserMock.mockResolvedValue({
				item: {
					id: VALID_USER_ID,
					email: 'ximena_meza',
					role: 'host_client',
					createdAt: '2026-04-01T00:00:00.000Z',
				},
				credentials: {
					temporaryPassword: 'ximenameza2026',
				},
			});

			const request = createMockRequest(
				{
					email: 'ximena_meza',
					role: 'host_client',
				},
				undefined,
				'http://localhost/api/dashboard/admin/users',
			);

			const response = await createUser({
				request,
				cookies: {},
			} as never);
			expect(response.status).toBe(201);
			const body = await response.json();
			expect(body.item.email).toBe('ximena_meza');
			expect(createAdminUserMock).toHaveBeenCalledWith({
				email: 'ximena_meza',
				role: 'host_client',
				actorUserId: VALID_ADMIN_ID,
			});
		});

		it('updates user role to host_client', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockUpdatedUser = {
				userId: VALID_USER_ID,
				role: 'host_client' as const,
				previousRole: 'super_admin' as const,
				changedAt: '2026-04-01T00:00:00.000Z',
			};

			changeUserRoleAdminMock.mockResolvedValue(mockUpdatedUser);

			const request = createMockRequest({
				role: 'host_client',
			});

			const response = await updateUserRole({
				params: { userId: VALID_USER_ID },
				request,
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.item).toEqual(mockUpdatedUser);
			expect(changeUserRoleAdminMock).toHaveBeenCalledWith({
				userId: VALID_USER_ID,
				role: 'host_client',
				actorUserId: VALID_ADMIN_ID,
			});
		});

		it('returns 400 when role payload is invalid during role change', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const request = createMockRequest({
				role: 'invalid_role',
			});

			const response = await updateUserRole({
				params: { userId: VALID_USER_ID },
				request,
			} as never);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.success).toBe(false);
			expect(body.error.code).toBe('bad_request');
		});

		it('returns 403 when userId is missing', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const request = createMockRequest({
				role: 'super_admin',
			});

			const response = await updateUserRole({
				params: { userId: '' },
				request,
			} as never);
			expect(response.status).toBe(403);
		});
	});
});
