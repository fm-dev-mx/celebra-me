jest.mock('@/lib/invitation/content-resolver', () => ({
	resolveInvitationContent: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/invitation-context.service', () => ({
	getInvitationContextByInviteId: jest.fn(),
}));

import { resolveInvitationContent } from '@/lib/invitation/content-resolver';
import { resolveGatedLocationPayload } from '@/lib/invitation/gated-location';
import { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import { ApiError } from '@/lib/rsvp/core/errors';

const mockResolveInvitationContent = resolveInvitationContent as jest.MockedFunction<
	typeof resolveInvitationContent
>;
const mockGetInvitationContextByInviteId = getInvitationContextByInviteId as jest.MockedFunction<
	typeof getInvitationContextByInviteId
>;

const confirmedContext = {
	inviteId: '11111111-1111-4111-1111-111111111111',
	eventSlug: 'gated-location-test-event',
	eventType: 'primera-comunion' as const,
	eventTitle: 'Gated Location Test Event',
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
			id: 'gated-location-test-event',
			isDemo: false,
			title: 'Gated Location Test Event',
			theme: { preset: 'angelic-presence', themeClass: 'theme-preset--angelic-presence' },
			hero: {
				name: 'Test Event',
				label: 'Test Event',
				date: '2026-08-01T20:00:00.000Z',
				backgroundImage: { src: '/hero.webp', alt: 'Test Event' },
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
	it('returns Luna y Estrella location by resolving event identity from inviteId only', async () => {
		mockGetInvitationContextByInviteId.mockResolvedValue({
			...confirmedContext,
			eventSlug: 'luna-y-estrella',
			eventType: 'primera-comunion',
		});
		mockResolveInvitationContent.mockResolvedValue({
			source: 'published',
			rawContent: {
				_assetSlug: 'luna-y-estrella-primera-comunion',
				location: protectedLocation,
			},
			viewModel: {
				id: 'luna-y-estrella',
				isDemo: false,
				title: 'Primera Comunión de Luna y Estrella',
				theme: { preset: 'angelic-presence', themeClass: 'theme-preset--angelic-presence' },
				hero: {
					name: 'Luna y Estrella',
					label: 'Primera Comunión',
					date: '2026-08-01T20:00:00.000Z',
					backgroundImage: { src: '/hero.webp', alt: 'Luna y Estrella' },
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

		const payload = await resolveGatedLocationPayload({
			inviteId: '11111111-1111-4111-1111-111111111111',
		});

		expect(mockResolveInvitationContent).toHaveBeenCalledWith(
			'luna-y-estrella',
			'primera-comunion',
		);
		expect(payload.location.ceremony?.venueName).toBe('Salón García');
	});

	it('returns protected location details for a confirmed matching invite context', async () => {
		const payload = await resolveGatedLocationPayload({
			inviteId: '11111111-1111-4111-1111-111111111111',
			eventType: 'primera-comunion',
			slug: 'gated-location-test-event',
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
			inviteId: '22222222-2222-4222-2222-222222222222',
			guest: { ...confirmedContext.guest, attendanceStatus: 'pending' },
		});

		await expect(
			resolveGatedLocationPayload({
				inviteId: '22222222-2222-4222-2222-222222222222',
				eventType: 'primera-comunion',
				slug: 'gated-location-test-event',
			}),
		).rejects.toMatchObject({
			status: 403,
			code: 'forbidden',
		});
	});

	it('rejects route identity mismatches before returning location details', async () => {
		await expect(
			resolveGatedLocationPayload({
				inviteId: '11111111-1111-4111-1111-111111111111',
				eventType: 'bautizo',
				slug: 'gated-location-test-event',
			}),
		).rejects.toMatchObject({
			status: 403,
			code: 'forbidden',
		});

		expect(mockResolveInvitationContent).not.toHaveBeenCalled();
	});

	it('rejects valid invites when requested route params do not match resolved context', async () => {
		await expect(
			resolveGatedLocationPayload({
				inviteId: '11111111-1111-4111-1111-111111111111',
				eventType: 'primera-comunion',
				slug: 'luna-y-estrella-primera-comunion',
			}),
		).rejects.toMatchObject({
			status: 403,
			code: 'forbidden',
		});

		expect(mockResolveInvitationContent).not.toHaveBeenCalled();
	});

	it('rejects invalid UUID format with 400 before any DB call', async () => {
		await expect(
			resolveGatedLocationPayload({
				inviteId: 'not-a-uuid',
				eventType: 'primera-comunion',
				slug: 'gated-location-test-event',
			}),
		).rejects.toMatchObject({
			status: 400,
			code: 'bad_request',
			message: 'Invalid invite ID format.',
		});

		expect(mockGetInvitationContextByInviteId).not.toHaveBeenCalled();
	});

	it('rejects valid-format but nonexistent UUID with 404 when the service throws', async () => {
		mockGetInvitationContextByInviteId.mockRejectedValue(
			new ApiError(404, 'not_found', 'Invitation not found.'),
		);

		await expect(
			resolveGatedLocationPayload({
				inviteId: '00000000-0000-0000-0000-000000000000',
				eventType: 'primera-comunion',
				slug: 'gated-location-test-event',
			}),
		).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});

		expect(mockGetInvitationContextByInviteId).toHaveBeenCalledTimes(1);
	});
});
