import { GET as getEvents, POST as createEvent } from '@/pages/api/dashboard/admin/events';
import { PATCH as updateEvent } from '@/pages/api/dashboard/admin/events/[eventId]';
import { requireAdminStrongSession } from '@/lib/rsvp-v2/authorization';
import { listAdminEvents, createEventAdmin, updateEventAdmin } from '@/lib/rsvp-v2/service';
import { ApiError } from '@/lib/rsvp-v2/errors';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp-v2/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp-v2/service', () => ({
	listAdminEvents: jest.fn(),
	createEventAdmin: jest.fn(),
	updateEventAdmin: jest.fn(),
}));

jest.mock('@/lib/rsvp-v2/adminRateLimit', () => ({
	requireAdminRateLimit: jest.fn().mockResolvedValue(undefined as never),
}));

jest.mock('@/lib/rsvp-v2/csrf', () => ({
	validateCsrfToken: jest.fn(), // No hace nada, no lanza error
	shouldSkipCsrfValidation: jest.fn().mockReturnValue(false), // Siempre validar CSRF
	getCsrfTokenFromCookies: jest.fn().mockReturnValue(null), // No hay token en cookie
	getCsrfTokenFromHeader: jest.fn().mockReturnValue(null), // No hay token en header
}));

jest.mock('@/lib/rsvp-v2/rateLimitProvider', () => ({
	checkRateLimit: jest.fn().mockResolvedValue(true as never), // Siempre permite
}));

const requireAdminStrongSessionMock = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const listAdminEventsMock = listAdminEvents as jest.MockedFunction<typeof listAdminEvents>;
const createEventAdminMock = createEventAdmin as jest.MockedFunction<typeof createEventAdmin>;
const updateEventAdminMock = updateEventAdmin as jest.MockedFunction<typeof updateEventAdmin>;

const VALID_ADMIN_ID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_EVENT_ID = '5b29352e-503a-4a8e-a226-802528726247';
const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('Admin Events CRUD API', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('GET /api/dashboard/admin/events', () => {
		it('returns 403 when not authenticated as super_admin', async () => {
			requireAdminStrongSessionMock.mockRejectedValue(
				new ApiError(403, 'forbidden', 'Se requiere autenticación fuerte'),
			);

			const response = await getEvents({
				request: createMockRequest(),
				cookies: {} as any,
			} as never);
			expect(response.status).toBe(403);
		});

		it('returns list of events for super_admin', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockEvents = [
				{
					id: VALID_EVENT_ID,
					title: 'Demo Event',
					slug: 'demo',
					eventType: 'cumple' as const,
					status: 'published' as const,
					ownerUserId: VALID_USER_ID,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
				{
					id: '550e8400-e29b-41d4-a716-446655440003',
					title: 'Another Event',
					slug: 'another',
					eventType: 'boda' as const,
					status: 'draft' as const,
					ownerUserId: '550e8400-e29b-41d4-a716-446655440002',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			];
			listAdminEventsMock.mockResolvedValue(mockEvents);

			const response = await getEvents({
				request: createMockRequest(),
				cookies: {} as any,
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.items).toEqual(mockEvents);
		});
	});

	describe('POST /api/dashboard/admin/events', () => {
		it('creates new event with valid data', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockEvent = {
				id: VALID_EVENT_ID,
				title: 'New Event',
				slug: 'new-event',
				eventType: 'cumple' as const,
				status: 'draft' as const,
				ownerUserId: VALID_ADMIN_ID,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
			};
			createEventAdminMock.mockResolvedValue(mockEvent);

			const request = createMockRequest({
				title: 'New Birthday',
				slug: 'new-birthday',
				eventType: 'cumple',
				status: 'draft',
			});

			const response = await createEvent({ request, cookies: {} as any } as never);
			expect(response.status).toBe(201);
			const body = await response.json();
			expect(body.item).toEqual(mockEvent);
			expect(createEventAdminMock).toHaveBeenCalledWith({
				title: 'New Birthday',
				slug: 'new-birthday',
				eventType: 'cumple',
				status: 'draft',
				actorUserId: VALID_ADMIN_ID,
			});
		});

		it('returns 400 when required fields are missing', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const request = createMockRequest({
				title: 'New Event',
			});

			const response = await createEvent({ request, cookies: {} as any } as never);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error.code).toBe('bad_request');
		});

		it('returns 400 for invalid eventType', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const request = createMockRequest({
				title: 'New Event',
				slug: 'new-event',
				eventType: 'invalid-type',
			});

			const response = await createEvent({ request, cookies: {} as any } as never);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error.code).toBe('bad_request');
		});
	});

	describe('PATCH /api/dashboard/admin/events/[eventId]', () => {
		it('updates event with valid data', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockUpdatedEvent = {
				id: VALID_EVENT_ID,
				title: 'Updated Title',
				slug: 'updated-slug',
				eventType: 'boda' as const,
				status: 'published' as const,
				ownerUserId: VALID_ADMIN_ID,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-02T00:00:00Z',
			};
			updateEventAdminMock.mockResolvedValue(mockUpdatedEvent);

			const request = createMockRequest({
				title: 'Updated Title',
				slug: 'updated-slug',
				eventType: 'boda',
				status: 'published',
			});

			const response = await updateEvent({
				params: { eventId: VALID_EVENT_ID },
				request,
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.item).toEqual(mockUpdatedEvent);
			expect(updateEventAdminMock).toHaveBeenCalledWith({
				eventId: VALID_EVENT_ID,
				title: 'Updated Title',
				slug: 'updated-slug',
				eventType: 'boda',
				status: 'published',
				actorUserId: VALID_ADMIN_ID,
			});
		});

		it('returns 400 for invalid status', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: VALID_ADMIN_ID,
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const request = createMockRequest({
				status: 'invalid-status',
			});

			const response = await updateEvent({
				params: { eventId: VALID_EVENT_ID },
				request,
				cookies: {} as any,
			} as never);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error.code).toBe('bad_request');
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
				title: 'Updated Title',
			});

			const response = await updateEvent({
				params: { eventId: '' },
				request,
				cookies: {} as any,
			} as never);
			expect(response.status).toBe(400);
		});
	});
});
