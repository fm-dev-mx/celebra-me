import {
	isRsvpRevealLocation,
	isLocationLocked,
	applyLocationPolicy,
	shouldRedactEnvelopeTeaser,
	redactEnvelopeTeaserWhenLocationLocked,
} from '@/lib/invitation/location-policy';
import type { InvitationViewModel } from '@/lib/adapters/types';

const baseViewModel = {
	id: 'test-event',
	title: 'Test Event',
	theme: { preset: 'test' },
	hero: { venueName: 'Salón de Prueba' },
	envelope: { enabled: true },
	sections: {},
	navigation: [],
	sectionOrder: [],
} as any as InvitationViewModel;

describe('isRsvpRevealLocation', () => {
	it('returns true for after-rsvp locations with revealSurface rsvp', () => {
		expect(
			isRsvpRevealLocation({
				visibility: 'after-rsvp',
				presentationOptions: { revealSurface: 'rsvp' },
			} as any),
		).toBe(true);
	});

	it('returns false for after-rsvp without revealSurface rsvp', () => {
		expect(isRsvpRevealLocation({ visibility: 'after-rsvp' } as any)).toBe(false);
	});

	it('returns false when location is undefined', () => {
		expect(isRsvpRevealLocation(undefined)).toBe(false);
	});
});

describe('isLocationLocked', () => {
	it('returns true when location has after-rsvp visibility and guest is not confirmed', () => {
		const location = { visibility: 'after-rsvp' as const };
		expect(isLocationLocked(location, false)).toBe(true);
	});

	it('returns false when guest is confirmed regardless of visibility', () => {
		const location = { visibility: 'after-rsvp' as const };
		expect(isLocationLocked(location, true)).toBe(false);
	});

	it('returns false when location is undefined', () => {
		expect(isLocationLocked(undefined, false)).toBe(false);
	});

	it('returns false when location has public visibility', () => {
		const location = { visibility: 'public' as const };
		expect(isLocationLocked(location, false)).toBe(false);
	});
});

describe('shouldRedactEnvelopeTeaser', () => {
	it('returns true when location is locked and guest is not confirmed (normal event)', () => {
		const result = shouldRedactEnvelopeTeaser({
			originalLocation: { visibility: 'after-rsvp' } as any,
			postPolicyLocation: { visibility: 'after-rsvp' } as any,
			isConfirmed: false,
		});
		expect(result).toBe(true);
	});

	it('returns false for public visibility on normal event', () => {
		const result = shouldRedactEnvelopeTeaser({
			originalLocation: { visibility: 'public' } as any,
			postPolicyLocation: { visibility: 'public' } as any,
			isConfirmed: false,
		});
		expect(result).toBe(false);
	});

	it('returns false when guest is confirmed on normal event', () => {
		const result = shouldRedactEnvelopeTeaser({
			originalLocation: { visibility: 'after-rsvp' } as any,
			postPolicyLocation: { visibility: 'after-rsvp' } as any,
			isConfirmed: true,
		});
		expect(result).toBe(false);
	});

	it('returns true for rsvp-reveal locations regardless of confirmation', () => {
		const originalLocation = {
			visibility: 'after-rsvp',
			presentationOptions: { revealSurface: 'rsvp' },
		} as any;
		expect(
			shouldRedactEnvelopeTeaser({
				originalLocation,
				postPolicyLocation: undefined,
				isConfirmed: false,
			}),
		).toBe(true);
		expect(
			shouldRedactEnvelopeTeaser({
				originalLocation,
				postPolicyLocation: undefined,
				isConfirmed: true,
			}),
		).toBe(true);
	});

	it('returns false for rsvp-reveal locations with public visibility', () => {
		const result = shouldRedactEnvelopeTeaser({
			originalLocation: {
				visibility: 'public',
				presentationOptions: { revealSurface: 'rsvp' },
			} as any,
			postPolicyLocation: undefined,
			isConfirmed: false,
		});
		expect(result).toBe(false);
	});
});

describe('redactEnvelopeTeaserWhenLocationLocked', () => {
	it('redacts teaser by truncating at bullet', () => {
		const result = redactEnvelopeTeaserWhenLocationLocked(
			{ teaserDetails: '1 ago 2026 • Salón García' },
			true,
		);
		expect(result?.teaserDetails).toBe('1 ago 2026');
	});

	it('returns envelope unchanged when shouldRedact is false', () => {
		const result = redactEnvelopeTeaserWhenLocationLocked(
			{ teaserDetails: '1 ago 2026 • Salón García' },
			false,
		);
		expect(result?.teaserDetails).toBe('1 ago 2026 • Salón García');
	});

	it('returns undefined when envelope is undefined', () => {
		expect(redactEnvelopeTeaserWhenLocationLocked(undefined, true)).toBeUndefined();
	});

	it('returns envelope unchanged when teaserDetails is missing', () => {
		const result = redactEnvelopeTeaserWhenLocationLocked<{ teaserDetails?: string }>(
			{ teaserDetails: undefined },
			true,
		);
		expect(result).toEqual({ teaserDetails: undefined });
	});
});

describe('applyLocationPolicy', () => {
	it('returns viewModel unchanged when location has public visibility', () => {
		const viewModel = {
			...baseViewModel,
			sections: {
				location: { visibility: 'public' as const, introHeading: 'Ubicación' },
			},
		} as any as InvitationViewModel;
		const result = applyLocationPolicy({
			viewModel,
			isConfirmedGuest: false,
		});
		expect(result.sections.location?.introHeading).toBe('Ubicación');
		expect(result.hero.venueName).toBe('Salón de Prueba');
	});

	it('returns viewModel unchanged when guest is confirmed', () => {
		const viewModel = {
			...baseViewModel,
			sections: {
				location: {
					visibility: 'after-rsvp' as const,
					introHeading: 'Ubicación',
					ceremony: { venueName: 'Salón García' },
				},
			},
		} as any as InvitationViewModel;
		const result = applyLocationPolicy({
			viewModel,
			isConfirmedGuest: true,
		});
		expect(result.sections.location?.introHeading).toBe('Ubicación');
		expect(result.sections.location?.ceremony?.venueName).toBe('Salón García');
	});

	it('redacts location when after-rsvp and guest is not confirmed', () => {
		const viewModel = {
			...baseViewModel,
			sections: {
				location: {
					visibility: 'after-rsvp' as const,
					introHeading: 'Ubicación',
					variant: 'ceremony',
					showFlourishes: true,
					ceremony: { venueName: 'Salón García' },
				},
			},
		} as any as InvitationViewModel;
		const result = applyLocationPolicy({
			viewModel,
			isConfirmedGuest: false,
		});
		expect(result.sections.location).toMatchObject({
			isLocked: true,
			lockedTitle: 'Ubicación reservada',
			introHeading: 'Ubicación',
		});
		expect((result.sections.location as any)?.ceremony).toBeUndefined();
		expect(result.hero.venueName).toBeUndefined();
	});

	it('strips location for rsvp-reveal capability when guest is not confirmed', () => {
		const viewModel = {
			...baseViewModel,
			sections: {
				location: {
					visibility: 'after-rsvp' as const,
					presentationOptions: { revealSurface: 'rsvp' as const },
					introHeading: 'Ubicación',
					ceremony: { venueName: 'Salón García' },
				},
			},
		} as any as InvitationViewModel;
		const result = applyLocationPolicy({
			viewModel,
			isConfirmedGuest: false,
		});
		expect(result.sections.location).toBeUndefined();
		expect(result.hero.venueName).toBeUndefined();
	});

	it('reveals location as rsvp.revealedLocation for confirmed rsvp-reveal guests', () => {
		const viewModel = {
			...baseViewModel,
			sections: {
				location: {
					visibility: 'after-rsvp' as const,
					presentationOptions: { revealSurface: 'rsvp' as const },
					introHeading: 'Ubicación',
					ceremony: { venueName: 'Salón García' },
				},
				rsvp: { title: 'Confirma' },
			},
		} as any as InvitationViewModel;
		const result = applyLocationPolicy({
			viewModel,
			isConfirmedGuest: true,
		});
		expect(result.sections.location).toBeUndefined();
		expect(result.sections.rsvp?.revealedLocation?.ceremony?.venueName).toBe('Salón García');
	});
});
