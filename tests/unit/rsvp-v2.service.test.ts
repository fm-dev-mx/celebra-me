import { submitGuestRsvpByInviteId } from '@/lib/rsvp-v2/service';
import { findGuestByInviteIdPublic, updateGuestByInviteIdPublic } from '@/lib/rsvp-v2/repository';

jest.mock('@/lib/rsvp-v2/repository', () => ({
	findGuestByInviteIdPublic: jest.fn(),
	updateGuestByInviteIdPublic: jest.fn(),
}));

const findGuestByInviteIdPublicMock = findGuestByInviteIdPublic as jest.MockedFunction<
	typeof findGuestByInviteIdPublic
>;
const updateGuestByInviteIdPublicMock = updateGuestByInviteIdPublic as jest.MockedFunction<
	typeof updateGuestByInviteIdPublic
>;

describe('rsvp-v2 service unit', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('persists declined RSVP with attendee_count forced to 0', async () => {
		findGuestByInviteIdPublicMock.mockResolvedValue({
			id: 'guest-1',
			inviteId: 'invite-1',
			eventId: 'evt-1',
			fullName: 'Invitado',
			phoneE164: '+5216680000000',
			maxAllowedAttendees: 4,
			attendanceStatus: 'pending',
			attendeeCount: 0,
			guestMessage: '',
			deliveryStatus: 'generated',
			firstViewedAt: null,
			lastViewedAt: null,
			respondedAt: null,
			lastResponseSource: 'link',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});

		updateGuestByInviteIdPublicMock.mockResolvedValue({
			id: 'guest-1',
			inviteId: 'invite-1',
			eventId: 'evt-1',
			fullName: 'Invitado',
			phoneE164: '+5216680000000',
			maxAllowedAttendees: 4,
			attendanceStatus: 'declined',
			attendeeCount: 0,
			guestMessage: 'No podre asistir',
			deliveryStatus: 'generated',
			firstViewedAt: null,
			lastViewedAt: null,
			respondedAt: new Date().toISOString(),
			lastResponseSource: 'link',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});

		const result = await submitGuestRsvpByInviteId('invite-1', {
			attendanceStatus: 'declined',
			attendeeCount: 3,
			guestMessage: 'No podre asistir',
		});

		expect(result.attendanceStatus).toBe('declined');
		expect(result.attendeeCount).toBe(0);
	});
});
