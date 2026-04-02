import { GET as getEvents } from '@/pages/api/dashboard/admin/events';
import { GET as getUsers, POST as createUser } from '@/pages/api/dashboard/admin/users';
import { GET as getClaimCodes } from '@/pages/api/dashboard/claimcodes';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { listAdminEvents } from '@/lib/rsvp/services/event-admin.service';
import { listAdminUsers, createAdminUser } from '@/lib/rsvp/services/user-admin.service';
import { listClaimCodesAdmin } from '@/lib/rsvp/services/claim-code-admin.service';
import { ApiError } from '@/lib/rsvp/core/errors';

jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn().mockResolvedValue(undefined as never),
}));

jest.mock('@/lib/rsvp/security/csrf', () => ({
	validateCsrfToken: jest.fn(),
	shouldSkipCsrfValidation: jest.fn().mockReturnValue(false),
}));

jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/event-admin.service', () => ({
	listAdminEvents: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/user-admin.service', () => ({
	listAdminUsers: jest.fn(),
	createAdminUser: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/claim-code-admin.service', () => ({
	listClaimCodesAdmin: jest.fn(),
}));

const requireAdminStrongSessionMock = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const listAdminEventsMock = listAdminEvents as jest.MockedFunction<typeof listAdminEvents>;
const listAdminUsersMock = listAdminUsers as jest.MockedFunction<typeof listAdminUsers>;
const createAdminUserMock = createAdminUser as jest.MockedFunction<typeof createAdminUser>;
const listClaimCodesAdminMock = listClaimCodesAdmin as jest.MockedFunction<
	typeof listClaimCodesAdmin
>;

function createMockRequest(
	payload?: unknown,
	headers?: Record<string, string>,
	url = 'http://localhost/api/test',
): Pick<Request, 'json' | 'text' | 'headers' | 'url'> {
	const defaultHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		...(headers ?? {}),
	};

	return {
		url,
		json: async () => payload,
		text: async () => {
			if (payload === undefined || payload === null) {
				return '';
			}
			if (typeof payload === 'string') {
				return payload;
			}
			return JSON.stringify(payload);
		},
		headers: {
			get: (name: string) => {
				const key = Object.keys(defaultHeaders).find(
					(headerName) => headerName.toLowerCase() === name.toLowerCase(),
				);
				return key ? (defaultHeaders[key] ?? null) : null;
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

		it('POST /api/dashboard/admin/users returns 403', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Se requiere autenticación fuerte'),
			);

			const response = await createUser({
				request: createMockRequest(
					{ role: 'host_client' },
					undefined,
					'http://localhost/api/dashboard/admin/users',
				),
				cookies: {},
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
					assignedEvents: [],
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

		it('POST /api/dashboard/admin/users returns 201', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			createAdminUserMock.mockResolvedValue({
				item: {
					id: 'user-2',
					email: 'cliente-ab12cd34@clientes.celebra.invalid',
					role: 'host_client',
					createdAt: new Date().toISOString(),
					assignedEvents: [],
				},
				credentials: {
					temporaryPassword: 'TempPass123!aA1',
				},
			});

			const response = await createUser({
				request: createMockRequest(
					{ role: 'host_client' },
					undefined,
					'http://localhost/api/dashboard/admin/users',
				),
				cookies: {},
			} as never);
			expect(response.status).toBe(201);
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
