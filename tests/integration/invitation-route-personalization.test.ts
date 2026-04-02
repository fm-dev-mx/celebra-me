import {
	decideInvitationRouteAccess,
	resolveRoutePersonalization,
} from '@/lib/invitation/route-personalization';
import { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import { trackInvitationView } from '@/lib/rsvp/services/rsvp-submission.service';

jest.mock('@/lib/rsvp/services/invitation-context.service', () => ({
	getInvitationContextByInviteId: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/rsvp-submission.service', () => ({
	trackInvitationView: jest.fn(),
}));

const getInvitationContextByInviteIdMock = getInvitationContextByInviteId as jest.MockedFunction<
	typeof getInvitationContextByInviteId
>;
const trackInvitationViewMock = trackInvitationView as jest.MockedFunction<
	typeof trackInvitationView
>;

describe('invitation route personalization', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('redirects a valid invite to its canonical route when the route slug does not match', () => {
		const decision = decideInvitationRouteAccess({
			currentPathWithQuery: '/xv/demo-xv?invite=invite-1',
			routeEventType: 'xv',
			routeSlug: 'demo-xv',
			routeIsDemo: false,
			inviteContext: {
				inviteId: 'invite-1',
				eventType: 'xv',
				eventSlug: 'ximena-meza-trasvina',
			},
		});

		expect(decision).toEqual({
			allowGuestContext: false,
			redirectPath: '/xv/ximena-meza-trasvina?invite=invite-1',
		});
	});

	it('redirects demo routes away from live invite personalization', async () => {
		getInvitationContextByInviteIdMock.mockResolvedValue({
			inviteId: 'invite-1',
			eventSlug: 'ximena-meza-trasvina',
			eventType: 'xv',
			eventTitle: 'XV Ximena',
			guest: {
				fullName: 'Invitada Demo',
				maxAllowedAttendees: 3,
				attendanceStatus: 'pending',
				attendeeCount: 0,
				guestComment: '',
			},
		});

		const result = await resolveRoutePersonalization({
			inviteId: 'invite-1',
			currentPathWithQuery: '/xv/demo-xv?invite=invite-1',
			routeEventType: 'xv',
			routeSlug: 'demo-xv',
			routeIsDemo: true,
		});

		expect(result).toEqual({
			guestContext: null,
			redirectPath: '/xv/ximena-meza-trasvina?invite=invite-1',
		});
		expect(trackInvitationViewMock).not.toHaveBeenCalled();
	});

	it('strips personalization on invalid invites and does not record telemetry', async () => {
		getInvitationContextByInviteIdMock.mockRejectedValue(new Error('Invitation not found.'));

		const result = await resolveRoutePersonalization({
			inviteId: 'missing',
			currentPathWithQuery: '/xv/ximena-meza-trasvina?invite=missing',
			routeEventType: 'xv',
			routeSlug: 'ximena-meza-trasvina',
			routeIsDemo: false,
		});

		expect(result).toEqual({
			guestContext: null,
			redirectPath: null,
		});
		expect(trackInvitationViewMock).not.toHaveBeenCalled();
	});

	it('allows matched live routes and records invitation views once context resolves', async () => {
		getInvitationContextByInviteIdMock.mockResolvedValue({
			inviteId: 'invite-1',
			eventSlug: 'ximena-meza-trasvina',
			eventType: 'xv',
			eventTitle: 'XV Ximena',
			guest: {
				fullName: 'Invitada Principal',
				maxAllowedAttendees: 4,
				attendanceStatus: 'pending',
				attendeeCount: 0,
				guestComment: '',
			},
		});

		const result = await resolveRoutePersonalization({
			inviteId: 'invite-1',
			currentPathWithQuery: '/xv/ximena-meza-trasvina?invite=invite-1',
			routeEventType: 'xv',
			routeSlug: 'ximena-meza-trasvina',
			routeIsDemo: false,
		});

		expect(result.redirectPath).toBeNull();
		expect(result.guestContext?.inviteId).toBe('invite-1');
		expect(trackInvitationViewMock).toHaveBeenCalledWith('invite-1');
	});
});
