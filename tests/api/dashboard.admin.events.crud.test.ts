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

function createMockRequest(
	payload?: unknown,
	headers?: Record<string, string>,
): Pick<Request, 'json' | 'text' | 'headers'> {
	const defaultHeaders: Record<string, string> = {};

	// Only add Content-Type if not explicitly overridden or removed
	if (headers && 'Content-Type' in headers) {
		if (headers['Content-Type'] !== '') {
			defaultHeaders['Content-Type'] = headers['Content-Type'];
		}
	} else {
		defaultHeaders['Content-Type'] = 'application/json';
	}

	// Add other headers
	if (headers) {
		for (const [key, value] of Object.entries(headers)) {
			if (key !== 'Content-Type' || value !== '') {
				defaultHeaders[key] = value;
			}
		}
	}

	return {
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
				userId: 'admin-1',
				email: 'admin@test.com',
				accessToken: 'token',
				role: 'super_admin',
				isSuperAdmin: true,
			});

			const mockEvent = {
				id: 'evt-1',
				title: 'New Event',
				slug: 'new-event',
				eventType: 'cumple' as const,
				status: 'draft' as const,
				ownerUserId: 'admin-1',
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

			const response = await createEvent({ request, cookies: {} as any } as never);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error.code).toBe('bad_request');
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

			const response = await createEvent({ request, cookies: {} as any } as never);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error.code).toBe('bad_request');
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
				ownerUserId: 'admin-1',
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
				cookies: {} as any,
			} as never);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error.code).toBe('bad_request');
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
				params: { eventId: 'evt-1' },
				request,
				cookies: {} as any,
			} as never);
			expect(response.status).toBe(400);
		});
	});
});
