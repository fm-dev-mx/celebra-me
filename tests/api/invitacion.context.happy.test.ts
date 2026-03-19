import { GET } from '@/pages/api/invitacion/[inviteId]/context';
import { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp/service', () => ({
	getInvitationContextByInviteId: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

const getInvitationContextByInviteIdMock = getInvitationContextByInviteId as jest.MockedFunction<
	typeof getInvitationContextByInviteId
>;
const checkRateLimitMock = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

describe('GET /api/invitacion/[inviteId]/context happy', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns personalized context without side-effect assertions', async () => {
		checkRateLimitMock.mockResolvedValue(true);
		getInvitationContextByInviteIdMock.mockResolvedValue({
			inviteId: 'invite-1',
			eventSlug: 'demo',
			eventType: 'xv',
			eventTitle: 'Evento Demo',
			guest: {
				fullName: 'Invitado Demo',
				maxAllowedAttendees: 3,
				attendanceStatus: 'pending',
				attendeeCount: 0,
				guestMessage: '',
			},
		});

		const response = await GET({
			params: { inviteId: 'invite-1' },
			request: createMockRequest(undefined, { 'x-real-ip': '127.0.0.1' }),
		} as never);

		expect(response.status).toBe(200);
	});
});
