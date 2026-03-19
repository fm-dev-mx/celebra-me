import { POST } from '@/pages/api/invitacion/[inviteId]/rsvp';
import { submitGuestRsvpByInviteId } from '@/lib/rsvp/services/rsvp-submission.service';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp/service', () => ({
	submitGuestRsvpByInviteId: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
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
			request: createMockRequest(
				{
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestMessage: 'Nos vemos!',
				},
				{ 'Content-Type': 'application/json' },
			),
		} as never);
		expect(response.status).toBe(200);
	});
});
