import { submitGuestRsvpByInviteId } from '@/lib/rsvp/services/rsvp-submission.service';
import { findGuestByInviteIdPublic, updateGuestByInviteIdPublic } from '@/lib/rsvp/repositories/guest.repository';

jest.mock('@/lib/rsvp/repositories/repository');

const findGuestByInviteIdPublicMock = findGuestByInviteIdPublic as jest.MockedFunction<
	typeof findGuestByInviteIdPublic
>;
const updateGuestByInviteIdPublicMock = updateGuestByInviteIdPublic as jest.MockedFunction<
	typeof updateGuestByInviteIdPublic
>;

describe('rsvp service limits', () => {
	beforeEach(() => {
		findGuestByInviteIdPublicMock.mockResolvedValue({
			id: 'guest-1',
			inviteId: 'invite-1',
			eventId: 'evt-1',
			fullName: 'Invitado',
			phone: '6680000000',
			maxAllowedAttendees: 2,
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
			phone: '6680000000',
			maxAllowedAttendees: 2,
			attendanceStatus: 'confirmed',
			attendeeCount: 2,
			guestMessage: '',
			deliveryStatus: 'generated',
			firstViewedAt: null,
			lastViewedAt: null,
			respondedAt: new Date().toISOString(),
			lastResponseSource: 'link',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('throws bad_request when attendee count exceeds max', async () => {
		await expect(
			submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 3,
			}),
		).rejects.toMatchObject({
			status: 400,
			code: 'bad_request',
		});
	});
});
