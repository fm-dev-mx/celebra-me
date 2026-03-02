import { GET as getDashboardEvents } from '@/pages/api/dashboard/events';
import { GET as getDashboardGuests } from '@/pages/api/dashboard/guests';
import { ApiError } from '@/lib/rsvp/errors';
import { requireHostSession, getSessionContextFromRequest } from '@/lib/rsvp/auth';
import { buildHostLoginRedirect } from '@/lib/rsvp/login';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp/auth', () => ({
	requireHostSession: jest.fn(),
	getSessionContextFromRequest: jest.fn(),
}));

const requireHostSessionMock = requireHostSession as jest.MockedFunction<typeof requireHostSession>;
const getSessionContextFromRequestMock = getSessionContextFromRequest as jest.MockedFunction<
	typeof getSessionContextFromRequest
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
