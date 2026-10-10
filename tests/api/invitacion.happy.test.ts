import { POST as rsvp } from '@/pages/api/invitacion/[inviteId]/rsvp';
import { POST as trackView } from '@/pages/api/invitacion/[inviteId]/view';
import {
	submitGuestRsvpByInviteId,
	trackInvitationView,
} from '@/lib/rsvp/services/rsvp-submission.service';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/engagement/engagement.service', () => ({
	recordServerEngagementEvent: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/rsvp-submission.service', () => ({
	submitGuestRsvpByInviteId: jest.fn(),
	trackInvitationView: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

const submitGuestRsvpMock = submitGuestRsvpByInviteId as jest.MockedFunction<
	typeof submitGuestRsvpByInviteId
>;
const trackInvitationViewMock = trackInvitationView as jest.MockedFunction<
	typeof trackInvitationView
>;
const checkRateLimitMock = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

describe('Invitation API: Guest Engagement (Happy Path)', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		checkRateLimitMock.mockResolvedValue(true);
	});

	it('POST /rsvp: accepts confirmed RSVP with valid attendee count', async () => {
		submitGuestRsvpMock.mockResolvedValue({
			attendanceStatus: 'confirmed',
			attendeeCount: 2,
			respondedAt: new Date().toISOString(),
			inviteId: 'invite-1',
			guestId: 'guest-1',
			entrySource: 'dashboard',
		});

		const response = await rsvp({
			params: { inviteId: 'invite-1' },
			request: createMockRequest(
				{
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestComment: 'Nos vemos!',
				},
				{ 'Content-Type': 'application/json' },
			),
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(submitGuestRsvpMock).toHaveBeenCalledWith(
			'invite-1',
			expect.objectContaining({
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
			}),
		);
	});

	it('POST /view: tracks first/last view timestamp', async () => {
		trackInvitationViewMock.mockResolvedValue();

		const response = await trackView({
			params: { inviteId: 'invite-1' },
			request: createMockRequest({}, { 'x-real-ip': '127.0.0.1' }),
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(trackInvitationViewMock).toHaveBeenCalledWith('invite-1', undefined);
	});
});

describe('Invitation API: RSVP engagement event', () => {
	it('records rsvp_submitted after a successful personalized RSVP', async () => {
		const { recordServerEngagementEvent } = jest.requireMock(
			'@/lib/rsvp/engagement/engagement.service',
		) as { recordServerEngagementEvent: jest.Mock };
		recordServerEngagementEvent.mockClear();
		checkRateLimitMock.mockResolvedValue(true);
		submitGuestRsvpMock.mockResolvedValue({
			attendanceStatus: 'declined',
			attendeeCount: 0,
			respondedAt: new Date().toISOString(),
			inviteId: 'invite-1',
			guestId: 'guest-1',
			entrySource: 'dashboard',
		});

		const response = await rsvp({
			params: { inviteId: 'invite-1' },
			request: createMockRequest({ attendanceStatus: 'declined', attendeeCount: 0 }),
		} as never);

		expect(response.status).toBe(200);
		expect(recordServerEngagementEvent).toHaveBeenCalledWith(
			'invite-1',
			{ eventName: 'rsvp_submitted', properties: { attendanceStatus: 'declined' } },
			expect.anything(),
		);
	});
});
