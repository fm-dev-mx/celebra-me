import { GET } from '@/pages/api/dashboard/guests';
import { requireHostSession } from '@/lib/rsvp-v2/auth';
import { listDashboardGuests } from '@/lib/rsvp-v2/service';
import { ApiError } from '@/lib/rsvp-v2/errors';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp-v2/auth', () => ({
	requireHostSession: jest.fn(),
}));

jest.mock('@/lib/rsvp-v2/service', () => ({
	listDashboardGuests: jest.fn(),
}));

const requireHostSessionMock = requireHostSession as jest.MockedFunction<typeof requireHostSession>;
const listDashboardGuestsMock = listDashboardGuests as jest.MockedFunction<
	typeof listDashboardGuests
>;

describe('dashboard guests ownership', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns 403 when host tries to access another owner event', async () => {
		requireHostSessionMock.mockResolvedValue({
			userId: 'host-a',
			email: 'a@test.com',
			accessToken: 'token-a',
		});
		listDashboardGuestsMock.mockRejectedValue(
			new ApiError(403, 'forbidden', 'Sin acceso al evento solicitado.'),
		);

		const response = await GET({
			request: createMockRequest(),
			url: new URL('http://localhost/api/dashboard/guests?eventId=evt-b'),
		} as never);
		expect(response.status).toBe(403);
		const body = (await response.json()) as { code: string };
		expect(body.code).toBe('forbidden');
	});
});
