import { GET as getUsers } from '@/pages/api/dashboard/admin/users';
import { PATCH as updateUserRole } from '@/pages/api/dashboard/admin/users/[userId]/role';
import { requireAdminStrongSession } from '@/lib/rsvp-v2/authorization';
import { listAdminUsers, changeUserRoleAdmin } from '@/lib/rsvp-v2/service';
import { ApiError } from '@/lib/rsvp-v2/errors';
import { mockAdminSecurityPass } from '../helpers/mockAdminSecurity';

// Mock funciones de seguridad admin
mockAdminSecurityPass();

jest.mock('@/lib/rsvp-v2/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp-v2/service', () => ({
	listAdminUsers: jest.fn(),
	changeUserRoleAdmin: jest.fn(),
}));

const requireAdminStrongSessionMock = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const listAdminUsersMock = listAdminUsers as jest.MockedFunction<typeof listAdminUsers>;
const changeUserRoleAdminMock = changeUserRoleAdmin as jest.MockedFunction<
	typeof changeUserRoleAdmin
>;

function createMockRequest(
	payload?: unknown,
	headers?: Record<string, string>,
): Pick<Request, 'json' | 'headers'> {
	return {
		json: async () => payload,
		headers: {
			get: (name: string) => {
				const key = Object.keys(headers ?? {}).find(
					(headerName) => headerName.toLowerCase() === name.toLowerCase(),
				);
				return key ? (headers?.[key] ?? null) : null;
			},
		} as Headers,
	};
}

function createMockUrl(searchParams?: Record<string, string>): URL {
	const url = new URL('http://localhost/api/dashboard/admin/users');
	if (searchParams) {
		Object.entries(searchParams).forEach(([key, value]) => {
			url.searchParams.set(key, value);
		});
	}
	return url;
}

describe('Admin Users API', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Mock funciones de seguridad admin
		mockAdminSecurityPass();
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
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockUsers = [
				{
					id: 'user-1',
					email: 'user1@test.com',
					role: 'host_client' as const,
					disabled: false,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
				{
					id: 'user-2',
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
					id: 'user-1',
					email: 'user1@test.com',
					role: 'host_client',
					disabled: false,
					createdAt: expect.any(String),
					updatedAt: expect.any(String),
				},
				{
					id: 'user-2',
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
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockUpdatedUser = {
				userId: 'user-1',
				role: 'host_client' as const,
			};

			changeUserRoleAdminMock.mockResolvedValue(mockUpdatedUser);

			const request = createMockRequest({
				role: 'host_client',
			});

			const response = await updateUserRole({
				params: { userId: 'user-1' },
				request,
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.item).toEqual(mockUpdatedUser);
			expect(changeUserRoleAdminMock).toHaveBeenCalledWith({
				userId: 'user-1',
				role: 'host_client',
				actorUserId: 'admin-1',
			});
		});

		it('defaults to host_client for invalid role', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockUpdatedUser = {
				userId: 'user-1',
				role: 'host_client' as const,
			};

			changeUserRoleAdminMock.mockResolvedValue(mockUpdatedUser);

			const request = createMockRequest({
				role: 'invalid_role',
			});

			const response = await updateUserRole({
				params: { userId: 'user-1' },
				request,
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.item).toEqual(mockUpdatedUser);
			expect(changeUserRoleAdminMock).toHaveBeenCalledWith({
				userId: 'user-1',
				role: 'host_client',
				actorUserId: 'admin-1',
			});
		});

		it('returns 400 when userId is missing', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
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
			expect(response.status).toBe(400);
		});
	});
});
