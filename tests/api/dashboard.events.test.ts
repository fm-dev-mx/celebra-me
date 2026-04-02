import { GET } from '@/pages/api/dashboard/events';
import { getSessionDebugSnapshotFromRequest } from '@/lib/rsvp/auth/auth';
import { listHostEvents, listHostEventsWithDebug } from '@/lib/rsvp/services/event-admin.service';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/auth/auth', () => ({
	getSessionDebugSnapshotFromRequest: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/event-admin.service', () => ({
	listHostEvents: jest.fn(),
	listHostEventsWithDebug: jest.fn(),
}));

const getSessionDebugSnapshotFromRequestMock =
	getSessionDebugSnapshotFromRequest as jest.MockedFunction<
		typeof getSessionDebugSnapshotFromRequest
	>;
const listHostEventsMock = listHostEvents as jest.MockedFunction<typeof listHostEvents>;
const listHostEventsWithDebugMock = listHostEventsWithDebug as jest.MockedFunction<
	typeof listHostEventsWithDebug
>;

describe('GET /api/dashboard/events', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns 401 when not authenticated', async () => {
		getSessionDebugSnapshotFromRequestMock.mockResolvedValue({
			hasAccessToken: false,
			tokenSource: 'none',
			reason: 'missing_access_token',
			context: null,
		});
		const response = await GET({ request: createMockRequest() } as never);
		expect(response.status).toBe(401);
	});

	it('returns host-visible events', async () => {
		getSessionDebugSnapshotFromRequestMock.mockResolvedValue({
			hasAccessToken: true,
			tokenSource: 'cookie',
			reason: 'session_role_resolved',
			context: {
				userId: 'host-1',
				email: 'host@test.com',
				accessToken: 'token',
				role: 'host_client',
				isSuperAdmin: false,
			},
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

	it('returns debug payload when debug mode is enabled', async () => {
		getSessionDebugSnapshotFromRequestMock.mockResolvedValue({
			hasAccessToken: true,
			tokenSource: 'cookie',
			reason: 'session_role_resolved',
			context: {
				userId: 'host-1',
				email: 'host@test.com',
				accessToken: 'token',
				role: 'host_client',
				isSuperAdmin: false,
			},
		});
		listHostEventsWithDebugMock.mockResolvedValue({
			events: [
				{
					id: 'evt-1',
					ownerUserId: 'host-1',
					slug: 'ximena-meza-trasvina',
					eventType: 'xv',
					title: 'XV Ximena',
					status: 'published',
					publishedAt: null,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			],
			debug: {
				session: {
					hasAccessToken: true,
					tokenSource: 'cookie',
					reason: 'session_role_resolved',
					userId: 'host-1',
					email: null,
					role: null,
					isSuperAdmin: false,
				},
				ownerEvents: [],
				visibleEvents: [],
				memberships: [],
				membershipResolvedEvents: [],
				unresolvedMembershipEventIds: [],
				slugCheck: {
					expectedSlug: 'ximena-meza-trasvina',
					slugExistsInDb: true,
					eventId: 'evt-1',
					ownerUserId: 'host-1',
					title: 'XV Ximena',
				},
			},
		});

		const response = await GET({
			request: createMockRequest(
				undefined,
				undefined,
				'http://localhost/api/dashboard/events?debug=1',
			),
		} as never);
		const body = (await response.json()) as { debug?: { session?: { email: string | null } } };

		expect(response.status).toBe(200);
		expect(body.debug?.session?.email).toBe('host@test.com');
	});
});
