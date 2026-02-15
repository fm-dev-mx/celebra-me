import { GET, POST } from '@/pages/api/dashboard/guests';
import { PATCH, DELETE } from '@/pages/api/dashboard/guests/[guestId]';
import { POST as markShared } from '@/pages/api/dashboard/guests/[guestId]/mark-shared';
import { requireHostSession } from '@/lib/rsvp-v2/auth';
import {
	createDashboardGuest,
	deleteDashboardGuest,
	listDashboardGuests,
	markGuestShared,
	updateDashboardGuest,
} from '@/lib/rsvp-v2/service';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp-v2/auth', () => ({
	requireHostSession: jest.fn(),
}));

jest.mock('@/lib/rsvp-v2/service', () => ({
	listDashboardGuests: jest.fn(),
	createDashboardGuest: jest.fn(),
	updateDashboardGuest: jest.fn(),
	deleteDashboardGuest: jest.fn(),
	markGuestShared: jest.fn(),
}));

const requireHostSessionMock = requireHostSession as jest.MockedFunction<typeof requireHostSession>;
const listDashboardGuestsMock = listDashboardGuests as jest.MockedFunction<
	typeof listDashboardGuests
>;
const createDashboardGuestMock = createDashboardGuest as jest.MockedFunction<
	typeof createDashboardGuest
>;
const updateDashboardGuestMock = updateDashboardGuest as jest.MockedFunction<
	typeof updateDashboardGuest
>;
const deleteDashboardGuestMock = deleteDashboardGuest as jest.MockedFunction<
	typeof deleteDashboardGuest
>;
const markGuestSharedMock = markGuestShared as jest.MockedFunction<typeof markGuestShared>;

describe('dashboard guests happy path', () => {
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

	it('lists guests', async () => {
		listDashboardGuestsMock.mockResolvedValue({
			eventId: 'evt-1',
			items: [],
			totals: { total: 0, pending: 0, confirmed: 0, declined: 0, viewed: 0 },
			updatedAt: new Date().toISOString(),
		});
		const response = await GET({
			request: createMockRequest(),
			url: new URL('http://localhost/api/dashboard/guests?eventId=evt-1'),
		} as never);
		expect(response.status).toBe(200);
	});

	it('creates a guest', async () => {
		createDashboardGuestMock.mockResolvedValue({
			source: 'mutation',
			updatedAt: new Date().toISOString(),
			item: {
				guestId: 'guest-1',
				inviteId: 'invite-1',
				fullName: 'Guest',
				phoneE164: '+5216680000000',
				maxAllowedAttendees: 2,
				attendanceStatus: 'pending',
				attendeeCount: 0,
				guestMessage: '',
				deliveryStatus: 'generated',
				firstViewedAt: null,
				respondedAt: null,
				waShareUrl: '',
				updatedAt: new Date().toISOString(),
			},
		});
		const response = await POST({
			request: createMockRequest({
				eventId: 'evt-1',
				fullName: 'Guest',
				phoneE164: '+5216680000000',
				maxAllowedAttendees: 2,
			}),
			url: new URL('http://localhost/api/dashboard/guests'),
		} as never);
		expect(response.status).toBe(201);
	});

	it('updates, marks shared and deletes a guest', async () => {
		updateDashboardGuestMock.mockResolvedValue({
			source: 'mutation',
			updatedAt: new Date().toISOString(),
			item: {
				guestId: 'guest-1',
				inviteId: 'invite-1',
				fullName: 'Guest',
				phoneE164: '+5216680000000',
				maxAllowedAttendees: 2,
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				guestMessage: '',
				deliveryStatus: 'generated',
				firstViewedAt: null,
				respondedAt: null,
				waShareUrl: '',
				updatedAt: new Date().toISOString(),
			},
		});
		markGuestSharedMock.mockResolvedValue({
			source: 'mutation',
			updatedAt: new Date().toISOString(),
			item: {
				guestId: 'guest-1',
				inviteId: 'invite-1',
				fullName: 'Guest',
				phoneE164: '+5216680000000',
				maxAllowedAttendees: 2,
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				guestMessage: '',
				deliveryStatus: 'shared',
				firstViewedAt: null,
				respondedAt: null,
				waShareUrl: '',
				updatedAt: new Date().toISOString(),
			},
		});
		deleteDashboardGuestMock.mockResolvedValue();

		const patchResp = await PATCH({
			params: { guestId: 'guest-1' },
			request: createMockRequest({ attendanceStatus: 'confirmed', attendeeCount: 2 }),
			url: new URL('http://localhost/api/dashboard/guests/guest-1'),
		} as never);
		expect(patchResp.status).toBe(200);

		const shareResp = await markShared({
			params: { guestId: 'guest-1' },
			request: createMockRequest(),
			url: new URL('http://localhost/api/dashboard/guests/guest-1/mark-shared'),
		} as never);
		expect(shareResp.status).toBe(200);

		const deleteResp = await DELETE({
			params: { guestId: 'guest-1' },
			request: createMockRequest(),
		} as never);
		expect(deleteResp.status).toBe(200);
	});
});
