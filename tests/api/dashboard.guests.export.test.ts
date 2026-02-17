import { GET } from '@/pages/api/dashboard/guests/export.csv';
import { requireHostSession } from '@/lib/rsvp-v2/auth';
import { listDashboardGuests } from '@/lib/rsvp-v2/service';
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

describe('GET /api/dashboard/guests/export.csv', () => {
	beforeEach(() => {
		requireHostSessionMock.mockResolvedValue({
			userId: 'host-1',
			email: 'host@test.com',
			accessToken: 'token',
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns 400 when eventId is missing', async () => {
		const response = await GET({
			request: createMockRequest(),
			url: new URL('http://localhost/api/dashboard/guests/export.csv'),
		} as never);
		expect(response.status).toBe(400);
	});

	it('returns csv with escaped fields', async () => {
		listDashboardGuestsMock.mockResolvedValue({
			eventId: 'evt-1',
			items: [
				{
					guestId: 'guest-1',
					inviteId: 'invite-1',
					fullName: 'Ana, "Mendoza"',
					phone: '6680000000',
					maxAllowedAttendees: 2,
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestMessage: 'Linea 1\nLinea 2',
					deliveryStatus: 'shared',
					firstViewedAt: null,
					respondedAt: null,
					waShareUrl: '',
					shareText: '',
					updatedAt: new Date().toISOString(),
				},
			],
			totals: {
				totalInvitations: 1,
				totalPeople: 1,
				pendingInvitations: 0,
				pendingPeople: 0,
				confirmedInvitations: 1,
				confirmedPeople: 1,
				declinedInvitations: 0,
				declinedPeople: 0,
				viewed: 0,
			},
			updatedAt: new Date().toISOString(),
		});

		const response = await GET({
			request: createMockRequest(),
			url: new URL('http://localhost/api/dashboard/guests/export.csv?eventId=evt-1'),
		} as never);
		const body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/csv');
		expect(body).toContain('"Ana, ""Mendoza"""');
		expect(body).toContain('"Linea 1');
	});
});
