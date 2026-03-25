import { GET as getEvents } from '@/pages/api/dashboard/admin/events';
import { GET as getUsers } from '@/pages/api/dashboard/admin/users';
import { GET as getClaimCodes } from '@/pages/api/dashboard/claimcodes';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { listAdminEvents } from '@/lib/rsvp/services/event-admin.service';
import { listAdminUsers } from '@/lib/rsvp/services/user-admin.service';
import { listClaimCodesAdmin } from '@/lib/rsvp/services/claim-code-admin.service';
import { ApiError } from '@/lib/rsvp/core/errors';

jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/event-admin.service', () => ({
	listAdminEvents: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/user-admin.service', () => ({
	listAdminUsers: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/claim-code-admin.service', () => ({
	listClaimCodesAdmin: jest.fn(),
}));

const requireAdminStrongSessionMock = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const listAdminEventsMock = listAdminEvents as jest.MockedFunction<typeof listAdminEvents>;
const listAdminUsersMock = listAdminUsers as jest.MockedFunction<typeof listAdminUsers>;
const listClaimCodesAdminMock = listClaimCodesAdmin as jest.MockedFunction<
	typeof listClaimCodesAdmin
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

describe('Admin API Strong Session Guard', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('super_admin with AAL1 (no MFA)', () => {
		it('GET /api/dashboard/admin/events returns 403', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Se requiere autenticación fuerte'),
			);

			const response = await getEvents({ request: createMockRequest() } as never);
			expect(response.status).toBe(403);
			const body = await response.json();
			expect(body.error.code).toBe('forbidden');
		});

		it('GET /api/dashboard/admin/users returns 403', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Se requiere autenticación fuerte'),
			);

			const response = await getUsers({
				request: createMockRequest(),
				url: new URL('http://localhost/api/dashboard/admin/users'),
			} as never);
			expect(response.status).toBe(403);
		});

		it('GET /api/dashboard/claimcodes returns 403', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Se requiere autenticación fuerte'),
			);

			const response = await getClaimCodes({
				request: createMockRequest(),
				url: new URL('http://localhost/api/dashboard/claimcodes'),
			} as never);
			expect(response.status).toBe(403);
		});
	});

	describe('super_admin with AAL2 (MFA enabled)', () => {
		it('GET /api/dashboard/admin/events returns 200', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			listAdminEventsMock.mockResolvedValue([
				{
					id: 'evt-1',
					title: 'Demo Event',
					slug: 'demo',
					eventType: 'cumple',
					status: 'published',
					ownerUserId: 'host-1',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			]);

			const response = await getEvents({ request: createMockRequest() } as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.items).toHaveLength(1);
		});

		it('GET /api/dashboard/admin/users returns 200', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			listAdminUsersMock.mockResolvedValue([
				{
					id: 'user-1',
					email: 'user@test.com',
					role: 'host_client',
					createdAt: new Date().toISOString(),
				},
			]);

			const response = await getUsers({
				request: createMockRequest(),
				url: new URL('http://localhost/api/dashboard/admin/users'),
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.items).toHaveLength(1);
		});
	});

	describe('host_client (any auth level)', () => {
		it('GET /api/dashboard/admin/events returns 403', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'No autorizado'),
			);

			const response = await getEvents({ request: createMockRequest() } as never);
			expect(response.status).toBe(403);
		});

		it('GET /api/dashboard/claimcodes returns 403', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'No autorizado'),
			);

			const response = await getClaimCodes({
				request: createMockRequest(),
				url: new URL('http://localhost/api/dashboard/claimcodes'),
			} as never);
			expect(response.status).toBe(403);
		});
	});

	describe('Authorization guard is called', () => {
		it('GET /api/dashboard/admin/events calls requireAdminStrongSession', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			listAdminEventsMock.mockResolvedValue([]);

			await getEvents({ request: createMockRequest() } as never);
			expect(requireAdminStrongSessionMock).toHaveBeenCalled();
		});

		it('GET /api/dashboard/admin/users calls requireAdminStrongSession', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			listAdminUsersMock.mockResolvedValue([]);

			await getUsers({
				request: createMockRequest(),
				url: new URL('http://localhost/api/dashboard/admin/users'),
			} as never);
			expect(requireAdminStrongSessionMock).toHaveBeenCalled();
		});

		it('GET /api/dashboard/claimcodes calls requireAdminStrongSession', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			listClaimCodesAdminMock.mockResolvedValue([]);

			await getClaimCodes({
				request: createMockRequest(),
				url: new URL('http://localhost/api/dashboard/claimcodes'),
			} as never);
			expect(requireAdminStrongSessionMock).toHaveBeenCalled();
		});
	});
});
