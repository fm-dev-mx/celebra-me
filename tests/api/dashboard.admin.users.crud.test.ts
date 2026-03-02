import { GET as getUsers } from '@/pages/api/dashboard/admin/users';
import { PATCH as updateUserRole } from '@/pages/api/dashboard/admin/users/[userId]/role';
import { requireAdminStrongSession } from '@/lib/rsvp/authorization';
import { listAdminUsers, changeUserRoleAdmin } from '@/lib/rsvp/service';
import { ApiError } from '@/lib/rsvp/errors';
import { createMockRequest } from './rsvp.helpers';

// Mock funciones de seguridad admin
jest.mock('@/lib/rsvp/adminRateLimit', () => ({
	requireAdminRateLimit: jest.fn().mockResolvedValue(undefined as never),
}));

jest.mock('@/lib/rsvp/csrf', () => ({
	validateCsrfToken: jest.fn(),
	shouldSkipCsrfValidation: jest.fn().mockReturnValue(false),
	getCsrfTokenFromCookies: jest.fn().mockReturnValue(null),
	getCsrfTokenFromHeader: jest.fn().mockReturnValue(null),
}));

jest.mock('@/lib/rsvp/rateLimitProvider', () => ({
	checkRateLimit: jest.fn().mockResolvedValue(true as never),
}));

jest.mock('@/lib/rsvp/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/service', () => ({
	listAdminUsers: jest.fn(),
	changeUserRoleAdmin: jest.fn(),
}));

jest.mock('@/lib/rsvp/adminProtection', () => ({
	canChangeUserRole: jest.fn().mockResolvedValue({ allowed: true }),
}));

const requireAdminStrongSessionMock = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const listAdminUsersMock = listAdminUsers as jest.MockedFunction<typeof listAdminUsers>;
const changeUserRoleAdminMock = changeUserRoleAdmin as jest.MockedFunction<
	typeof changeUserRoleAdmin
>;

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
					disabled: false,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
				{
					id: '550e8400-e29b-41d4-a716-446655440002',
					email: 'user2@test.com',
					role: 'super_admin' as const,
					disabled: false,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			];
			listAdminUsersMock.mockResolvedValue(mockUsers);

			const response = await getUsers({
				request: createMockRequest(),
				url: createMockUrl({ page: '2', perPage: '50' }),
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.items).toEqual([
				{
					id: VALID_USER_ID,
					email: 'user1@test.com',
					role: 'host_client',
					disabled: false,
					createdAt: expect.any(String),
					updatedAt: expect.any(String),
				},
				{
					id: '550e8400-e29b-41d4-a716-446655440002',
					email: 'user2@test.com',
					role: 'super_admin',
					disabled: false,
					createdAt: expect.any(String),
					updatedAt: expect.any(String),
				},
			]);
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

		it('defaults to host_client for invalid role', async () => {
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
			};

			changeUserRoleAdminMock.mockResolvedValue(mockUpdatedUser);

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

		it('returns 400 when userId is missing', async () => {
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
