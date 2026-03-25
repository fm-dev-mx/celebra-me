import { GET as getContext } from '@/pages/api/invitacion/[inviteId]/context';
import { POST as rsvp } from '@/pages/api/invitacion/[inviteId]/rsvp';
import { POST as trackView } from '@/pages/api/invitacion/[inviteId]/view';
import { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import {
	submitGuestRsvpByInviteId,
	trackInvitationView,
} from '@/lib/rsvp/services/rsvp-submission.service';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/services/invitation-context.service', () => ({
	getInvitationContextByInviteId: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/rsvp-submission.service', () => ({
	submitGuestRsvpByInviteId: jest.fn(),
	trackInvitationView: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

const getInvitationContextMock = getInvitationContextByInviteId as jest.MockedFunction<
	typeof getInvitationContextByInviteId
>;
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

	it('GET /context: returns personalized context', async () => {
		getInvitationContextMock.mockResolvedValue({
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

		const response = await getContext({
			params: { inviteId: 'invite-1' },
			request: createMockRequest(undefined, { 'x-real-ip': '127.0.0.1' }),
		} as never);

		expect(response.status).toBe(200);
		expect(getInvitationContextMock).toHaveBeenCalledWith('invite-1');
	});

	it('POST /rsvp: accepts confirmed RSVP with valid attendee count', async () => {
		submitGuestRsvpMock.mockResolvedValue({
			attendanceStatus: 'confirmed',
			attendeeCount: 2,
			respondedAt: new Date().toISOString(),
		});

		const response = await rsvp({
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
			request: createMockRequest(undefined, { 'x-real-ip': '127.0.0.1' }),
		} as never);

		expect(response.status).toBe(200);
		expect(trackInvitationViewMock).toHaveBeenCalledWith('invite-1');
	});
});
