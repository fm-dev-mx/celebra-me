import { GET as getEvents } from '@/pages/api/dashboard/admin/events';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { ApiError } from '@/lib/rsvp/core/errors';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	listAllEventsService: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn().mockResolvedValue(undefined as never),
}));

const requireAdminStrongSessionMock = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const VALID_ADMIN_ID = '550e8400-e29b-41d4-a716-446655440001';

describe('Admin Events CRUD API', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('GET /api/dashboard/admin/events', () => {
		it('returns 403 when not authenticated as super_admin', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Se requiere autenticación fuerte'),
			);
			const response = await getEvents({ request: createMockRequest() } as never);
			expect(response.status).toBe(403);
		});

		it('returns 200 for super_admin', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});
			const response = await getEvents({ request: createMockRequest() } as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(Array.isArray(body.items)).toBe(true);
		});
	});
});
