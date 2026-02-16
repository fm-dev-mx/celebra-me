import { GET } from '@/pages/api/dashboard/guests';
import { getSessionContextFromRequest } from '@/lib/rsvp-v2/auth';
import { listDashboardGuests } from '@/lib/rsvp-v2/service';
import { ApiError } from '@/lib/rsvp-v2/errors';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp-v2/auth', () => ({
	getSessionContextFromRequest: jest.fn(),
}));

jest.mock('@/lib/rsvp-v2/service', () => ({
	listDashboardGuests: jest.fn(),
}));

const getSessionContextFromRequestMock = getSessionContextFromRequest as jest.MockedFunction<
	typeof getSessionContextFromRequest
>;
const listDashboardGuestsMock = listDashboardGuests as jest.MockedFunction<
	typeof listDashboardGuests
>;

describe('dashboard guests ownership', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns 403 when host tries to access another owner event', async () => {
		getSessionContextFromRequestMock.mockResolvedValue({
			userId: 'host-a',
			email: 'a@test.com',
			accessToken: 'token-a',
			role: 'host_client',
			isSuperAdmin: false,
			amr: [],
		});
		listDashboardGuestsMock.mockRejectedValue(
			new ApiError(403, 'forbidden', 'Sin acceso al evento solicitado.'),
		);

		const response = await GET({
			request: createMockRequest(),
			url: new URL('http://localhost/api/dashboard/guests?eventId=evt-b'),
		} as never);
		expect(response.status).toBe(403);
		const body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe('forbidden');
	});
});
