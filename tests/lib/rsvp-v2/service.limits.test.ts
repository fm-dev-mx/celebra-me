import { submitGuestRsvpByInviteId } from '@/lib/rsvp/services/rsvp-submission.service';
import {
	findGuestByInviteIdPublic,
	submitGuestRsvpPublicRpc,
} from '@/lib/rsvp/repositories/guest.repository';

jest.mock('@/lib/rsvp/repositories/guest.repository');

const findGuestByInviteIdPublicMock = findGuestByInviteIdPublic as jest.MockedFunction<
	typeof findGuestByInviteIdPublic
>;
const submitGuestRsvpPublicRpcMock = submitGuestRsvpPublicRpc as jest.MockedFunction<
	typeof submitGuestRsvpPublicRpc
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
			guestComment: '',
			deliveryStatus: 'generated',
			firstSharedAt: null,
			viewPercentage: 0,
			isViewed: false,
			firstViewedAt: null,
			lastViewedAt: null,
			respondedAt: null,
			lastResponseSource: 'link',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		submitGuestRsvpPublicRpcMock.mockResolvedValue({
			id: 'guest-1',
			inviteId: 'invite-1',
			eventId: 'evt-1',
			fullName: 'Invitado',
			phone: '6680000000',
			maxAllowedAttendees: 2,
			attendanceStatus: 'confirmed',
			attendeeCount: 2,
			guestComment: '',
			deliveryStatus: 'generated',
			firstSharedAt: null,
			viewPercentage: 0,
			isViewed: false,
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
