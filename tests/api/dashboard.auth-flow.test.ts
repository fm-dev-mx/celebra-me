import { GET as getDashboardEvents } from '@/pages/api/dashboard/events';
import { GET as getDashboardGuests } from '@/pages/api/dashboard/guests';
import { ApiError } from '@/lib/rsvp/core/errors';
import { requireHostSession, getSessionContextFromRequest, getSessionDebugSnapshotFromRequest } from '@/lib/rsvp/auth/auth';
import { buildHostLoginRedirect } from '@/lib/rsvp/auth/login';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/auth/auth', () => ({
	requireHostSession: jest.fn(),
	getSessionContextFromRequest: jest.fn(),
	getSessionDebugSnapshotFromRequest: jest.fn(),
}));

const requireHostSessionMock = requireHostSession as jest.MockedFunction<typeof requireHostSession>;
const getSessionContextFromRequestMock = getSessionContextFromRequest as jest.MockedFunction<
	typeof getSessionContextFromRequest
>;
const getSessionDebugSnapshotFromRequestMock =
	getSessionDebugSnapshotFromRequest as jest.MockedFunction<
		typeof getSessionDebugSnapshotFromRequest
	>;

describe('dashboard auth flow', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns 401 json on dashboard APIs without session', async () => {
		requireHostSessionMock.mockRejectedValue(
			new ApiError(401, 'unauthorized', 'No autorizado.'),
		);
		getSessionContextFromRequestMock.mockResolvedValue(null);
		getSessionDebugSnapshotFromRequestMock.mockResolvedValue({
			hasAccessToken: false,
			tokenSource: 'none',
			reason: 'missing_access_token',
			context: null,
		});

		const eventsResp = await getDashboardEvents({
			request: createMockRequest(),
		} as never);
		const guestsResp = await getDashboardGuests({
			request: createMockRequest(),
			url: new URL('http://localhost/api/dashboard/guests?eventId=evt-1'),
		} as never);

		expect(eventsResp.status).toBe(401);
		expect(guestsResp.status).toBe(401);

		const eventsBody = (await eventsResp.json()) as {
			success: false;
			error: { code: string; message: string };
		};
		const guestsBody = (await guestsResp.json()) as {
			success: false;
			error: { code: string; message: string };
		};
		expect(eventsBody.error.code).toBe('unauthorized');
		expect(guestsBody.error.code).toBe('unauthorized');
	});

	it('builds login redirect preserving next dashboard path', () => {
		expect(buildHostLoginRedirect('/dashboard/invitados')).toBe(
			'/login?next=%2Fdashboard%2Finvitados',
		);
	});
});
