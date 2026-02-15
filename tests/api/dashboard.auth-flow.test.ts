import { GET as getDashboardEvents } from '@/pages/api/dashboard/events';
import { GET as getDashboardGuests } from '@/pages/api/dashboard/guests';
import { ApiError } from '@/lib/rsvp-v2/errors';
import { requireHostSession } from '@/lib/rsvp-v2/auth';
import { buildHostLoginRedirect } from '@/lib/rsvp-v2/login';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp-v2/auth', () => ({
	requireHostSession: jest.fn(),
}));

const requireHostSessionMock = requireHostSession as jest.MockedFunction<typeof requireHostSession>;

describe('dashboard auth flow', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns 401 json on dashboard APIs without session', async () => {
		requireHostSessionMock.mockRejectedValue(
			new ApiError(401, 'unauthorized', 'No autorizado.'),
		);

		const eventsResp = await getDashboardEvents({
			request: createMockRequest(),
		} as never);
		const guestsResp = await getDashboardGuests({
			request: createMockRequest(),
			url: new URL('http://localhost/api/dashboard/guests?eventId=evt-1'),
		} as never);

		expect(eventsResp.status).toBe(401);
		expect(guestsResp.status).toBe(401);

		const eventsBody = (await eventsResp.json()) as { code?: string };
		const guestsBody = (await guestsResp.json()) as { code?: string };
		expect(eventsBody.code).toBe('unauthorized');
		expect(guestsBody.code).toBe('unauthorized');
	});

	it('builds login redirect preserving next dashboard path', () => {
		expect(buildHostLoginRedirect('/dashboard/invitados')).toBe(
			'/login?next=%2Fdashboard%2Finvitados',
		);
	});
});
