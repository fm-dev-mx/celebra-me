jest.mock('@/lib/invitation/content-resolver', () => ({
	resolveInvitationContent: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/invitation-context.service', () => ({
	getInvitationContextByInviteId: jest.fn(),
}));

import { resolveInvitationContent } from '@/lib/invitation/content-resolver';
import { resolveGatedLocationPayload } from '@/lib/invitation/gated-location';
import { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';

const mockResolveInvitationContent = resolveInvitationContent as jest.MockedFunction<
	typeof resolveInvitationContent
>;
const mockGetInvitationContextByInviteId = getInvitationContextByInviteId as jest.MockedFunction<
	typeof getInvitationContextByInviteId
>;

const confirmedContext = {
	inviteId: 'invite-confirmed',
	eventSlug: 'luna-y-estrella',
	eventType: 'primera-comunion' as const,
	eventTitle: 'Primera Comunión de Luna y Estrella',
	guest: {
		fullName: 'Familia invitada',
		maxAllowedAttendees: 4,
		attendanceStatus: 'confirmed' as const,
		attendeeCount: 2,
		guestComment: '',
		hideCelebraMeBranding: false,
	},
};

const protectedLocation = {
	visibility: 'after-rsvp' as const,
	introHeading: 'Ubicación',
	ceremony: {
		venueEvent: 'Celebración',
		venueName: 'Salón García',
		address: 'Victoriano Huerta 51, Col. San Francisco, Uruapan',
		date: '2026-08-01',
		time: '14:00',
		googleMapsUrl: 'https://maps.google.com/?q=Salon%20Garcia',
		coordinates: { lat: 19.42, lng: -102.06 },
	},
};

beforeEach(() => {
	jest.clearAllMocks();
	mockGetInvitationContextByInviteId.mockResolvedValue(confirmedContext);
	mockResolveInvitationContent.mockResolvedValue({
		source: 'published',
		rawContent: { location: protectedLocation },
		viewModel: {
			id: 'luna-y-estrella',
			isDemo: false,
			title: 'Primera Comunión de Luna y Estrella',
			theme: { preset: 'angelic-presence', themeClass: 'theme-preset--angelic-presence' },
			hero: {
				name: 'Luna y Estrella',
				label: 'Primera Comunión',
				date: '2026-08-01T20:00:00.000Z',
				backgroundImage: { src: '/hero.webp', alt: 'Portada de Luna y Estrella' },
				variant: 'angelic-presence',
			},
			envelope: { enabled: false },
			brandingVisibility: {
				showFooterBranding: true,
				showContactCta: true,
				showThankYouBranding: true,
			},
			sections: { location: protectedLocation },
			interludes: [],
		},
	} as Awaited<ReturnType<typeof resolveInvitationContent>>);
});

describe('resolveGatedLocationPayload', () => {
	it('returns protected location details for a confirmed matching invite context', async () => {
		const payload = await resolveGatedLocationPayload({
			inviteId: 'invite-confirmed',
			eventType: 'primera-comunion',
			slug: 'luna-y-estrella',
		});

		expect(payload.location.ceremony?.venueName).toBe('Salón García');
		expect(payload.location.ceremony?.address).toBe(
			'Victoriano Huerta 51, Col. San Francisco, Uruapan',
		);
		expect(payload.location.ceremony?.googleMapsUrl).toContain('maps.google.com');
		expect(payload.location.ceremony?.coordinates).toEqual({ lat: 19.42, lng: -102.06 });
	});

	it('rejects unconfirmed invite contexts', async () => {
		mockGetInvitationContextByInviteId.mockResolvedValue({
			...confirmedContext,
			guest: { ...confirmedContext.guest, attendanceStatus: 'pending' },
		});

		await expect(
			resolveGatedLocationPayload({
				inviteId: 'invite-pending',
				eventType: 'primera-comunion',
				slug: 'luna-y-estrella',
			}),
		).rejects.toMatchObject({
			status: 403,
			code: 'forbidden',
		});
	});

	it('rejects route identity mismatches before returning location details', async () => {
		await expect(
			resolveGatedLocationPayload({
				inviteId: 'invite-confirmed',
				eventType: 'bautizo',
				slug: 'luna-y-estrella',
			}),
		).rejects.toMatchObject({
			status: 403,
			code: 'forbidden',
		});

		expect(mockResolveInvitationContent).not.toHaveBeenCalled();
	});
});
