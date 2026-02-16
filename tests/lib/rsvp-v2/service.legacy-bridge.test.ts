import { resolveLegacyTokenToCanonicalUrl } from '@/lib/rsvp-v2/service';
import { findGuestByLegacyIdentityPublic } from '@/lib/rsvp-v2/repository';
import { getRsvpContext } from '@/lib/rsvp/service';

jest.mock('@/lib/rsvp-v2/repository');

jest.mock('@/lib/rsvp/service', () => ({
	getRsvpContext: jest.fn(),
}));

const findGuestByLegacyIdentityPublicMock = findGuestByLegacyIdentityPublic as jest.MockedFunction<
	typeof findGuestByLegacyIdentityPublic
>;
const getRsvpContextMock = getRsvpContext as jest.MockedFunction<typeof getRsvpContext>;

describe('rsvp-v2 legacy bridge', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('resolves legacy token to canonical invite url', async () => {
		getRsvpContextMock.mockResolvedValue({
			eventSlug: 'demo-event',
			mode: 'personalized',
			tokenValid: true,
			guest: {
				guestId: 'legacy-guest-1',
				displayName: 'Invitado',
				maxAllowedAttendees: 2,
			},
		});
		findGuestByLegacyIdentityPublicMock.mockResolvedValue({
			id: 'guest-1',
			inviteId: 'invite-uuid',
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

		const url = await resolveLegacyTokenToCanonicalUrl({
			eventSlug: 'demo-event',
			token: 'legacy-token',
			origin: 'https://celebra-me.com',
		});

		expect(url).toBe('https://celebra-me.com/invitacion/invite-uuid');
	});
});
