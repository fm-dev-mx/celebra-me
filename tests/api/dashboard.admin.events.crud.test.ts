import { GET as getEvents, POST as createEvent } from '@/pages/api/dashboard/admin/events';
import { PATCH as updateEvent } from '@/pages/api/dashboard/admin/events/[eventId]';
import { requireAdminStrongSession } from '@/lib/rsvp-v2/authorization';
import { listAdminEvents, createEventAdmin, updateEventAdmin } from '@/lib/rsvp-v2/service';
import { ApiError } from '@/lib/rsvp-v2/errors';

jest.mock('@/lib/rsvp-v2/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp-v2/service', () => ({
	listAdminEvents: jest.fn(),
	createEventAdmin: jest.fn(),
	updateEventAdmin: jest.fn(),
}));

const requireAdminStrongSessionMock = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const listAdminEventsMock = listAdminEvents as jest.MockedFunction<typeof listAdminEvents>;
const createEventAdminMock = createEventAdmin as jest.MockedFunction<typeof createEventAdmin>;
const updateEventAdminMock = updateEventAdmin as jest.MockedFunction<typeof updateEventAdmin>;

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

		it('returns list of events for super_admin', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockEvents = [
				{
					id: 'evt-1',
					title: 'Demo Event',
					slug: 'demo',
					eventType: 'cumple' as const,
					status: 'published' as const,
					ownerUserId: 'user-1',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
				{
					id: 'evt-2',
					title: 'Another Event',
					slug: 'another',
					eventType: 'boda' as const,
					status: 'draft' as const,
					ownerUserId: 'user-2',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			];
			listAdminEventsMock.mockResolvedValue(mockEvents);

			const response = await getEvents({ request: createMockRequest() } as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.items).toEqual(mockEvents);
		});
	});

	describe('POST /api/dashboard/admin/events', () => {
		it('creates new event with valid data', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockEvent = {
				id: 'new-event',
				title: 'New Birthday',
				slug: 'new-birthday',
				eventType: 'cumple' as const,
				status: 'draft' as const,
				ownerUserId: 'admin-1',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			createEventAdminMock.mockResolvedValue(mockEvent);

			const request = createMockRequest({
				title: 'New Birthday',
				slug: 'new-birthday',
				eventType: 'cumple',
				status: 'draft',
			});

			const response = await createEvent({ request } as never);
			expect(response.status).toBe(201);
			const body = await response.json();
			expect(body.item).toEqual(mockEvent);
			expect(createEventAdminMock).toHaveBeenCalledWith({
				title: 'New Birthday',
				slug: 'new-birthday',
				eventType: 'cumple',
				status: 'draft',
				actorUserId: 'admin-1',
			});
		});

		it('returns 400 when required fields are missing', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const request = createMockRequest({
				title: 'New Event',
			});

			const response = await createEvent({ request } as never);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.code).toBe('bad_request');
		});

		it('returns 400 for invalid eventType', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
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

			const response = await createEvent({ request } as never);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.code).toBe('bad_request');
		});
	});

	describe('PATCH /api/dashboard/admin/events/[eventId]', () => {
		it('updates event with valid data', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockUpdatedEvent = {
				id: 'evt-1',
				title: 'Updated Title',
				slug: 'updated-slug',
				eventType: 'boda' as const,
				status: 'published' as const,
				ownerUserId: 'user-1',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			updateEventAdminMock.mockResolvedValue(mockUpdatedEvent);

			const request = createMockRequest({
				title: 'Updated Title',
				slug: 'updated-slug',
				eventType: 'boda',
				status: 'published',
			});

			const response = await updateEvent({
				params: { eventId: 'evt-1' },
				request,
			} as never);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.item).toEqual(mockUpdatedEvent);
			expect(updateEventAdminMock).toHaveBeenCalledWith({
				eventId: 'evt-1',
				title: 'Updated Title',
				slug: 'updated-slug',
				eventType: 'boda',
				status: 'published',
				actorUserId: 'admin-1',
			});
		});

		it('returns 400 for invalid status', async () => {
			requireAdminStrongSessionMock.mockResolvedValue({
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const request = createMockRequest({
				status: 'invalid-status',
			});

			const response = await updateEvent({
				params: { eventId: 'evt-1' },
				request,
			} as never);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.code).toBe('bad_request');
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
				title: 'Updated Title',
			});

			const response = await updateEvent({
				params: { eventId: '' },
				request,
			} as never);
			expect(response.status).toBe(400);
		});
	});
});
