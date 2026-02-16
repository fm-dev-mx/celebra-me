import { GET as getClaimCodes, POST as createClaimCode } from '@/pages/api/dashboard/claimcodes';
import {
	PATCH as updateClaimCode,
	DELETE as deleteClaimCode,
} from '@/pages/api/dashboard/claimcodes/[claimCodeId]';
import { requireAdminStrongSession } from '@/lib/rsvp-v2/authorization';
import {
	listClaimCodesAdmin,
	createClaimCodeAdmin,
	updateClaimCodeAdmin,
	disableClaimCodeAdmin,
} from '@/lib/rsvp-v2/service';
import { ApiError } from '@/lib/rsvp-v2/errors';
import { mockAdminSecurityPass } from '../helpers/mockAdminSecurity';

// Mock funciones de seguridad admin
mockAdminSecurityPass();

jest.mock('@/lib/rsvp-v2/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp-v2/service', () => ({
	listClaimCodesAdmin: jest.fn(),
	createClaimCodeAdmin: jest.fn(),
	updateClaimCodeAdmin: jest.fn(),
	disableClaimCodeAdmin: jest.fn(),
}));

const requireAdminStrongSessionMock = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const listClaimCodesAdminMock = listClaimCodesAdmin as jest.MockedFunction<
	typeof listClaimCodesAdmin
>;
const createClaimCodeAdminMock = createClaimCodeAdmin as jest.MockedFunction<
	typeof createClaimCodeAdmin
>;
const updateClaimCodeAdminMock = updateClaimCodeAdmin as jest.MockedFunction<
	typeof updateClaimCodeAdmin
>;
const disableClaimCodeAdminMock = disableClaimCodeAdmin as jest.MockedFunction<
	typeof disableClaimCodeAdmin
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
	const url = new URL('http://localhost/api/dashboard/claimcodes');
	if (searchParams) {
		Object.entries(searchParams).forEach(([key, value]) => {
			url.searchParams.set(key, value);
		});
	}
	return url;
}

describe('Admin Claim Codes CRUD API', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Mock funciones de seguridad admin
		mockAdminSecurityPass();
	});

	describe('GET /api/dashboard/claimcodes', () => {
		it('returns 403 when not authenticated as super_admin', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Se requiere autenticación fuerte'),
			);

			const response = await getClaimCodes({
				request: createMockRequest(),
				url: createMockUrl(),
			} as never);
			expect(response.status).toBe(403);
		});

		it('returns list of claim codes filtered by eventId', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockClaimCodes = [
				{
					id: 'code-1',
					eventId: 'evt-1',
					active: true,
					expiresAt: null,
					maxUses: 10,
					usedCount: 0,
					createdBy: 'user-1',
					status: 'active' as const,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			];
			listClaimCodesAdminMock.mockResolvedValue(mockClaimCodes);

			const response = await getClaimCodes({
				request: createMockRequest(),
				url: createMockUrl({ eventId: 'evt-1' }),
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.items).toEqual(mockClaimCodes);
			expect(listClaimCodesAdminMock).toHaveBeenCalledWith({ eventId: 'evt-1' });
		});

		it('returns all claim codes when no eventId filter', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			listClaimCodesAdminMock.mockResolvedValue([]);

			const response = await getClaimCodes({
				request: createMockRequest(),
				url: createMockUrl(),
			} as never);
			expect(response.status).toBe(200);
			expect(listClaimCodesAdminMock).toHaveBeenCalledWith({ eventId: undefined });
		});
	});

	describe('POST /api/dashboard/claimcodes', () => {
		it('creates new claim code with valid data', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockClaimCode = {
				plainCode: 'XYZ789',
				item: {
					id: 'new-code',
					eventId: 'evt-1',
					active: true,
					expiresAt: null,
					maxUses: 5,
					usedCount: 0,
					createdBy: 'admin-1',
					status: 'active' as const,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			};

			createClaimCodeAdminMock.mockResolvedValue(mockClaimCode);

			const request = createMockRequest({
				eventId: 'evt-1',
				maxUses: 5,
			});

			const response = await createClaimCode({ request } as never);
			expect(response.status).toBe(201);
			const body = await response.json();
			expect(body).toEqual({
				plainCode: 'XYZ789',
				item: {
					id: 'new-code',
					eventId: 'evt-1',
					active: true,
					expiresAt: null,
					maxUses: 5,
					usedCount: 0,
					createdBy: 'admin-1',
					status: 'active',
					createdAt: expect.any(String),
					updatedAt: expect.any(String),
				},
			});
			expect(createClaimCodeAdminMock).toHaveBeenCalledWith({
				eventId: 'evt-1',
				expiresAt: null,
				maxUses: 5,
				createdBy: 'admin-1',
			});
		});

		it('returns 400 when eventId is missing', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const request = createMockRequest({
				maxUses: 5,
			});

			const response = await createClaimCode({ request } as never);
			expect(response.status).toBe(400);
		});
	});

	describe('PATCH /api/dashboard/claimcodes/[claimCodeId]', () => {
		it('updates claim code with valid data', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockUpdatedClaimCode = {
				id: 'code-1',
				eventId: 'evt-1',
				active: false,
				expiresAt: '2025-12-31T23:59:59Z',
				maxUses: 20,
				usedCount: 5,
				createdBy: 'user-1',
				status: 'active' as const,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			updateClaimCodeAdminMock.mockResolvedValue(mockUpdatedClaimCode);

			const request = createMockRequest({
				active: false,
				expiresAt: '2025-12-31T23:59:59Z',
				maxUses: 20,
			});

			const response = await updateClaimCode({
				params: { claimCodeId: 'code-1' },
				request,
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.item).toEqual(mockUpdatedClaimCode);
			expect(updateClaimCodeAdminMock).toHaveBeenCalledWith({
				claimCodeId: 'code-1',
				active: false,
				expiresAt: '2025-12-31T23:59:59Z',
				maxUses: 20,
			});
		});

		it('returns 400 when claimCodeId is missing', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const request = createMockRequest({
				active: false,
			});

			const response = await updateClaimCode({
				params: { claimCodeId: '' },
				request,
			} as never);
			expect(response.status).toBe(400);
		});
	});

	describe('DELETE /api/dashboard/claimcodes/[claimCodeId]', () => {
		it('disables claim code', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockDisabledClaimCode = {
				id: 'code-1',
				eventId: 'evt-1',
				active: false,
				expiresAt: null,
				maxUses: 10,
				usedCount: 0,
				createdBy: 'user-1',
				status: 'active' as const,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			disableClaimCodeAdminMock.mockResolvedValue(mockDisabledClaimCode);

			const response = await deleteClaimCode({
				params: { claimCodeId: 'code-1' },
				request: createMockRequest(),
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.item).toEqual(mockDisabledClaimCode);
			expect(disableClaimCodeAdminMock).toHaveBeenCalledWith({ claimCodeId: 'code-1' });
		});
	});
});
