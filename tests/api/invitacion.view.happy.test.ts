import { POST } from '@/pages/api/invitacion/[inviteId]/view';
import { checkRateLimit } from '@/lib/rsvp-v2/rateLimitProvider';
import { trackInvitationView } from '@/lib/rsvp-v2/service';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp-v2/rateLimitProvider', () => ({
	checkRateLimit: jest.fn(),
}));

jest.mock('@/lib/rsvp-v2/service', () => ({
	trackInvitationView: jest.fn(),
}));

const checkRateLimitMock = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const trackInvitationViewMock = trackInvitationView as jest.MockedFunction<
	typeof trackInvitationView
>;

describe('POST /api/invitacion/[inviteId]/view happy', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('tracks first/last view timestamp update flow', async () => {
		checkRateLimitMock.mockResolvedValue(true);
		trackInvitationViewMock.mockResolvedValue();

		const response = await POST({
			params: { inviteId: 'invite-1' },
			request: createMockRequest(undefined, { 'x-real-ip': '127.0.0.1' }),
		} as never);

		expect(response.status).toBe(200);
		expect(trackInvitationViewMock).toHaveBeenCalledWith('invite-1');
	});
});
