import { GET } from '@/pages/api/dashboard/guests/export.csv';
import { requireHostSession } from '@/lib/rsvp/auth/auth';
import { listDashboardGuests } from '@/lib/rsvp/services/dashboard-guests.service';
import { createMockRequest } from '../helpers/api-mocks';
import {
	DEFAULT_INVITATION_MESSAGE,
	DEFAULT_REMINDER_MESSAGE,
} from '@/lib/rsvp/services/shared/share-message-defaults';

jest.mock('@/lib/rsvp/auth/auth', () => ({
	requireHostSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/dashboard-guests.service', () => ({
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

	it('returns csv with BOM, country_code split, and escaped fields', async () => {
		listDashboardGuestsMock.mockResolvedValue({
			eventId: 'evt-1',
			items: [
				{
					guestId: 'guest-1',
					inviteId: 'invite-1',
					fullName: 'Ana, "Mendoza"',
					phone: '+526680000000',
					maxAllowedAttendees: 2,
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestComment: 'Linea 1\nLinea 2',
					deliveryStatus: 'shared',
					viewPercentage: 0,
					isViewed: false,
					firstViewedAt: null,
					respondedAt: null,
					waShareUrl: '',
					shareText: '',
					tags: [],
					updatedAt: new Date().toISOString(),
				},
			],
			totals: {
				totalInvitations: 1,
				totalPeople: 1,
				generatedInvitations: 0,
				sharedInvitations: 1,
				pendingInvitations: 0,
				pendingPeople: 0,
				confirmedInvitations: 1,
				confirmedPeople: 1,
				declinedInvitations: 0,
				declinedPeople: 0,
				viewed: 0,
			},
			shareTemplates: {
				invitation: DEFAULT_INVITATION_MESSAGE,
				reminder: DEFAULT_REMINDER_MESSAGE,
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

		// BOM present
		expect(body.charCodeAt(0)).toBe(0xfeff);

		// Header columns (no internal IDs, includes country_code)
		expect(body).toContain('full_name');
		expect(body).toContain('country_code');
		expect(body).not.toContain('guest_id');

		// Country code split: +52 extracted (with tab prefix for CSV injection safety),
		// local phone shown
		expect(body).toContain('"\t+52"');
		expect(body).toContain('"6680000000"');

		// Escaping
		expect(body).toContain('"Ana, ""Mendoza"""');
		expect(body).toContain('"Linea 1');
	});

	it('exports legacy plain-digit phone as-is when no known prefix matches', async () => {
		listDashboardGuestsMock.mockResolvedValue({
			eventId: 'evt-1',
			items: [
				{
					guestId: 'guest-2',
					inviteId: 'invite-2',
					fullName: 'Juan Perez',
					phone: '6681234567',
					maxAllowedAttendees: 2,
					attendanceStatus: 'pending',
					attendeeCount: 0,
					guestComment: '',
					deliveryStatus: 'generated',
					viewPercentage: 0,
					isViewed: false,
					firstViewedAt: null,
					respondedAt: null,
					waShareUrl: '',
					shareText: '',
					tags: ['Amigos'],
					updatedAt: new Date().toISOString(),
				},
			],
			totals: {
				totalInvitations: 1,
				totalPeople: 2,
				generatedInvitations: 1,
				sharedInvitations: 0,
				pendingInvitations: 1,
				pendingPeople: 2,
				confirmedInvitations: 0,
				confirmedPeople: 0,
				declinedInvitations: 0,
				declinedPeople: 0,
				viewed: 0,
			},
			shareTemplates: {
				invitation: DEFAULT_INVITATION_MESSAGE,
				reminder: DEFAULT_REMINDER_MESSAGE,
			},
			updatedAt: new Date().toISOString(),
		});

		const response = await GET({
			request: createMockRequest(),
			url: new URL('http://localhost/api/dashboard/guests/export.csv?eventId=evt-1'),
		} as never);
		const body = await response.text();

		// Legacy phone preserved as-is, country_code empty
		expect(body).toContain('"6681234567"');
		expect(body).toContain('""'); // empty country_code
	});
});
