import { POST } from '@/pages/api/invitacion/[inviteId]/rsvp';
import { submitGuestRsvpByInviteId } from '@/lib/rsvp-v2/service';
import { checkRateLimit } from '@/lib/rsvp-v2/rateLimitProvider';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp-v2/service', () => ({
	submitGuestRsvpByInviteId: jest.fn(),
}));

jest.mock('@/lib/rsvp-v2/rateLimitProvider', () => ({
	checkRateLimit: jest.fn(),
}));

const submitGuestRsvpByInviteIdMock = submitGuestRsvpByInviteId as jest.MockedFunction<
	typeof submitGuestRsvpByInviteId
>;
const checkRateLimitMock = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

describe('POST /api/invitacion/[inviteId]/rsvp happy', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('accepts confirmed RSVP with valid attendee count', async () => {
		checkRateLimitMock.mockResolvedValue(true);
		submitGuestRsvpByInviteIdMock.mockResolvedValue({
			attendanceStatus: 'confirmed',
			attendeeCount: 2,
			respondedAt: new Date().toISOString(),
		});

		const response = await POST({
			params: { inviteId: 'invite-1' },
			request: createMockRequest({
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				guestMessage: 'Nos vemos!',
			}),
		} as never);
		expect(response.status).toBe(200);
	});
});
