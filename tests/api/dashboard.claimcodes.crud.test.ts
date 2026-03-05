import { GET as getClaimCodes, POST as createClaimCode } from '@/pages/api/dashboard/claimcodes';
import {
	PATCH as updateClaimCode,
	DELETE as deleteClaimCode,
} from '@/pages/api/dashboard/claimcodes/[claimCodeId]';
import { requireAdminStrongSession } from '@/lib/rsvp/authorization';
import {
	listClaimCodesAdmin,
	createClaimCodeAdmin,
	updateClaimCodeAdmin,
	disableClaimCodeAdmin,
} from '@/lib/rsvp/service';
import { ApiError } from '@/lib/rsvp/errors';
import { createMockRequest } from './rsvp.helpers';

// Mock funciones de seguridad admin
jest.mock('@/lib/rsvp/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn().mockResolvedValue(undefined as never),
}));

jest.mock('@/lib/rsvp/csrf', () => ({
	validateCsrfToken: jest.fn(),
	shouldSkipCsrfValidation: jest.fn().mockReturnValue(false),
	getCsrfTokenFromCookies: jest.fn().mockReturnValue(null),
	getCsrfTokenFromHeader: jest.fn().mockReturnValue(null),
}));

jest.mock('@/lib/rsvp/rate-limit-provider', () => ({
	checkRateLimit: jest.fn().mockResolvedValue(true as never),
}));

jest.mock('@/lib/rsvp/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/service', () => ({
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

function createMockUrl(searchParams?: Record<string, string>): URL {
	const url = new URL('http://localhost/api/dashboard/claimcodes');
	if (searchParams) {
		Object.entries(searchParams).forEach(([key, value]) => {
			url.searchParams.set(key, value);
		});
	}
	return url;
}

const VALID_ADMIN_ID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_EVENT_ID = '5b29352e-503a-4a8e-a226-802528726247';
const VALID_CODE_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

describe('Admin Claim Codes CRUD API', () => {
	beforeEach(() => {
		jest.clearAllMocks();
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
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockClaimCodes = [
				{
					id: VALID_CODE_ID,
					eventId: VALID_EVENT_ID,
					active: true,
					expiresAt: null,
					maxUses: 10,
					usedCount: 0,
					createdBy: '550e8400-e29b-41d4-a716-446655440000',
					status: 'active' as const,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			];
			listClaimCodesAdminMock.mockResolvedValue(mockClaimCodes);

			const response = await getClaimCodes({
				request: createMockRequest(),
				url: createMockUrl({ eventId: VALID_EVENT_ID }),
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.items).toEqual(mockClaimCodes);
			expect(listClaimCodesAdminMock).toHaveBeenCalledWith({ eventId: VALID_EVENT_ID });
		});

		it('returns all claim codes when no eventId filter', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
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
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockClaimCode = {
				plainCode: 'XYZ789',
				item: {
					id: '550e8400-e29b-41d4-a716-446655440004',
					eventId: VALID_EVENT_ID,
					active: true,
					expiresAt: null,
					maxUses: 5,
					usedCount: 0,
					createdBy: VALID_ADMIN_ID,
					status: 'active' as const,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			};

			createClaimCodeAdminMock.mockResolvedValue(mockClaimCode);

			const request = createMockRequest({
				eventId: VALID_EVENT_ID,
				maxUses: 5,
			});

			const response = await createClaimCode({ request } as never);
			expect(response.status).toBe(201);
			const body = await response.json();
			expect(body).toEqual({
				plainCode: 'XYZ789',
				item: {
					id: '550e8400-e29b-41d4-a716-446655440004',
					eventId: VALID_EVENT_ID,
					active: true,
					expiresAt: null,
					maxUses: 5,
					usedCount: 0,
					createdBy: VALID_ADMIN_ID,
					status: 'active',
					createdAt: expect.any(String),
					updatedAt: expect.any(String),
				},
			});
			expect(createClaimCodeAdminMock).toHaveBeenCalledWith({
				eventId: VALID_EVENT_ID,
				expiresAt: null,
				maxUses: 5,
				createdBy: VALID_ADMIN_ID,
			});
		});

		it('returns 400 when eventId is missing', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
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
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockUpdatedClaimCode = {
				id: VALID_CODE_ID,
				eventId: VALID_EVENT_ID,
				active: false,
				expiresAt: '2025-12-31T23:59:59Z',
				maxUses: 20,
				usedCount: 5,
				createdBy: '550e8400-e29b-41d4-a716-446655440000',
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
				params: { claimCodeId: VALID_CODE_ID },
				request,
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.item).toEqual(mockUpdatedClaimCode);
			expect(updateClaimCodeAdminMock).toHaveBeenCalledWith({
				claimCodeId: VALID_CODE_ID,
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
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockDisabledClaimCode = {
				id: VALID_CODE_ID,
				eventId: VALID_EVENT_ID,
				active: false,
				expiresAt: null,
				maxUses: 10,
				usedCount: 0,
				createdBy: '550e8400-e29b-41d4-a716-446655440000',
				status: 'active' as const,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			disableClaimCodeAdminMock.mockResolvedValue(mockDisabledClaimCode);

			const response = await deleteClaimCode({
				params: { claimCodeId: VALID_CODE_ID },
				request: createMockRequest(),
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.item).toEqual(mockDisabledClaimCode);
			expect(disableClaimCodeAdminMock).toHaveBeenCalledWith({ claimCodeId: VALID_CODE_ID });
		});
	});
});
