import { GET } from '@/pages/api/dashboard/events';
import { ApiError } from '@/lib/rsvp/core/errors';
import { requireHostSession } from '@/lib/rsvp/auth/auth';
import { listHostEvents } from '@/lib/rsvp/services/event-admin.service';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/auth/auth', () => ({
	requireHostSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/event-admin.service', () => ({
	listHostEvents: jest.fn(),
}));

const requireHostSessionMock = requireHostSession as jest.MockedFunction<typeof requireHostSession>;
const listHostEventsMock = listHostEvents as jest.MockedFunction<typeof listHostEvents>;

describe('GET /api/dashboard/events', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns 401 when not authenticated', async () => {
		requireHostSessionMock.mockRejectedValue(
			new ApiError(401, 'unauthorized', 'No autorizado.'),
		);
		const response = await GET({ request: createMockRequest() } as never);
		expect(response.status).toBe(401);
	});

	it('returns host-visible events', async () => {
		requireHostSessionMock.mockResolvedValue({
			userId: 'host-1',
			email: 'host@test.com',
			accessToken: 'token',
		});
		listHostEventsMock.mockResolvedValue([
			{
				id: 'evt-1',
				ownerUserId: 'host-1',
				slug: 'demo',
				eventType: 'cumple',
				title: 'Demo Event',
				status: 'published',
				publishedAt: null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);

		const response = await GET({ request: createMockRequest() } as never);
		const body = (await response.json()) as { items: Array<{ id: string }> };
		expect(response.status).toBe(200);
		expect(body.items).toHaveLength(1);
		expect(body.items[0].id).toBe('evt-1');
	});
});
