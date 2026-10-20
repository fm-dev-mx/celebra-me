import {
	decideInvitationRouteAccess,
	resolveRoutePersonalization,
} from '@/lib/invitation/route-personalization';
import { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	PERSONALIZED_CONTEXT_SERVICE_CALLS_ON_LOOKUP,
	assertObservedOperationCount,
} from '@/lib/invitation/delivery-contract';

jest.mock('@/lib/rsvp/services/invitation-context.service', () => ({
	getInvitationContextByInviteId: jest.fn(),
}));

const getInvitationContextByInviteIdMock = getInvitationContextByInviteId as jest.MockedFunction<
	typeof getInvitationContextByInviteId
>;

describe('invitation route personalization', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('redirects a valid invite to its canonical route when the route slug does not match', () => {
		const decision = decideInvitationRouteAccess({
			currentPathWithQuery: '/xv/demo-xv-jewelry-box?invite=invite-1',
			routeEventType: 'xv',
			routeSlug: 'demo-xv-jewelry-box',
			routeIsDemo: false,
			inviteContext: {
				inviteId: 'invite-1',
				eventType: 'xv',
				eventSlug: 'elena-fixture',
			},
		});

		expect(decision).toEqual({
			allowGuestContext: false,
			redirectPath: '/elena-fixture?invite=invite-1',
		});
	});

	it('redirects demo routes away from live invite personalization', async () => {
		getInvitationContextByInviteIdMock.mockResolvedValue({
			inviteId: 'invite-1',
			eventSlug: 'elena-fixture',
			eventType: 'xv',
			eventTitle: 'XV Ximena',
			brandingRemovalEnabled: false,
			guest: {
				fullName: 'Invitada Demo',
				maxAllowedAttendees: 3,
				attendanceStatus: 'pending',
				attendeeCount: 0,
				guestComment: '',
				hideCelebraMeBranding: false,
			},
		});

		const result = await resolveRoutePersonalization({
			inviteId: 'invite-1',
			currentPathWithQuery: '/xv/demo-xv-jewelry-box?invite=invite-1',
			routeEventType: 'xv',
			routeSlug: 'demo-xv-jewelry-box',
			routeIsDemo: true,
		});

		expect(result).toEqual({
			guestContext: null,
			redirectPath: '/elena-fixture?invite=invite-1',
		});
	});

	it('redirects unknown or deleted invites to the public route without telemetry', async () => {
		getInvitationContextByInviteIdMock.mockRejectedValue(
			new ApiError(404, 'not_found', 'Invitation not found.'),
		);

		const result = await resolveRoutePersonalization({
			inviteId: 'missing',
			currentPathWithQuery: '/xv/elena-fixture?invite=missing',
			routeEventType: 'xv',
			routeSlug: 'elena-fixture',
			routeIsDemo: false,
		});

		expect(result).toEqual({
			guestContext: null,
			redirectPath: '/xv/elena-fixture',
		});
		assertObservedOperationCount(
			getInvitationContextByInviteIdMock.mock.calls.length,
			PERSONALIZED_CONTEXT_SERVICE_CALLS_ON_LOOKUP,
			'personalized-context-service',
		);
	});

	it('keeps other query params when dropping an unusable invite', async () => {
		getInvitationContextByInviteIdMock.mockRejectedValue(
			new ApiError(400, 'bad_request', 'inviteId is invalid.'),
		);

		const result = await resolveRoutePersonalization({
			inviteId: 'bad',
			currentPathWithQuery: '/xv/elena-fixture?invite=bad&skipEnvelope=true',
			routeEventType: 'xv',
			routeSlug: 'elena-fixture',
			routeIsDemo: false,
		});

		expect(result).toEqual({
			guestContext: null,
			redirectPath: '/xv/elena-fixture?skipEnvelope=true',
		});
	});

	it('keeps the guest on the short path and strips a missing invite from it', async () => {
		getInvitationContextByInviteIdMock.mockRejectedValue(
			new ApiError(404, 'not_found', 'Invitation not found.'),
		);

		const result = await resolveRoutePersonalization({
			inviteId: 'missing',
			currentPathWithQuery: '/america?invite=missing',
			routeEventType: 'xv',
			routeSlug: 'america',
			routeIsDemo: false,
		});

		expect(result).toEqual({ guestContext: null, redirectPath: '/america' });
	});

	it('accepts a matching invite on the short path without redirecting', () => {
		const decision = decideInvitationRouteAccess({
			currentPathWithQuery: '/america?invite=invite-1',
			routeEventType: 'xv',
			routeSlug: 'america',
			routeIsDemo: false,
			inviteContext: { inviteId: 'invite-1', eventSlug: 'america', eventType: 'xv' },
		});

		expect(decision).toEqual({ allowGuestContext: true, redirectPath: null });
	});

	it('avoids self-redirect when the current path does not contain an invite query param', async () => {
		getInvitationContextByInviteIdMock.mockRejectedValue(
			new ApiError(404, 'not_found', 'Invitation not found.'),
		);

		const result = await resolveRoutePersonalization({
			inviteId: 'missing',
			currentPathWithQuery: '/xv/elena-fixture',
			routeEventType: 'xv',
			routeSlug: 'elena-fixture',
			routeIsDemo: false,
		});

		expect(result).toEqual({
			guestContext: null,
			redirectPath: null,
		});
	});

	it('keeps the public fallback without redirect on transient lookup failures', async () => {
		getInvitationContextByInviteIdMock.mockRejectedValue(new Error('timeout'));
		const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

		try {
			const result = await resolveRoutePersonalization({
				inviteId: 'invite-1',
				currentPathWithQuery: '/xv/elena-fixture?invite=invite-1',
				routeEventType: 'xv',
				routeSlug: 'elena-fixture',
				routeIsDemo: false,
			});

			expect(result).toEqual({ guestContext: null, redirectPath: null });
			expect(warnSpy).toHaveBeenCalledWith(
				'[invitation][route-personalization] Unable to resolve invite context.',
				expect.any(Error),
			);
		} finally {
			warnSpy.mockRestore();
		}
	});

	it('does not look up a guest when the invite id is empty', async () => {
		const result = await resolveRoutePersonalization({
			inviteId: '',
			currentPathWithQuery: '/xv/renata?invite=',
			routeEventType: 'xv',
			routeSlug: 'renata',
			routeIsDemo: false,
		});

		expect(result).toEqual({ guestContext: null, redirectPath: null });
		expect(getInvitationContextByInviteIdMock).not.toHaveBeenCalled();
	});

	it('looks up guest context once for a live invite and does not retry on success', async () => {
		getInvitationContextByInviteIdMock.mockResolvedValue({
			inviteId: 'invite-1',
			eventSlug: 'elena-fixture',
			eventType: 'xv',
			eventTitle: 'XV Ximena',
			brandingRemovalEnabled: false,
			guest: {
				fullName: 'Invitada Principal',
				maxAllowedAttendees: 4,
				attendanceStatus: 'pending',
				attendeeCount: 0,
				guestComment: '',
				hideCelebraMeBranding: false,
			},
		});

		const result = await resolveRoutePersonalization({
			inviteId: 'invite-1',
			currentPathWithQuery: '/xv/elena-fixture?invite=invite-1',
			routeEventType: 'xv',
			routeSlug: 'elena-fixture',
			routeIsDemo: false,
		});

		expect(result.redirectPath).toBeNull();
		expect(result.guestContext?.inviteId).toBe('invite-1');
		assertObservedOperationCount(
			getInvitationContextByInviteIdMock.mock.calls.length,
			PERSONALIZED_CONTEXT_SERVICE_CALLS_ON_LOOKUP,
			'personalized-context-service',
		);
	});
});
