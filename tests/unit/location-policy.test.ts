import {
	isLunaEstrellaRoute,
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

describe('isLunaEstrellaRoute', () => {
	it('returns true for luna-y-estrella slug with primera-comunion event type', () => {
		expect(isLunaEstrellaRoute('luna-y-estrella', 'primera-comunion')).toBe(true);
	});

	it('returns false for non-matching slug', () => {
		expect(isLunaEstrellaRoute('otro-evento', 'primera-comunion')).toBe(false);
	});

	it('returns false for non-matching event type', () => {
		expect(isLunaEstrellaRoute('luna-y-estrella', 'xv')).toBe(false);
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
			slug: 'test-event',
			eventType: 'xv',
		});
		expect(result).toBe(true);
	});

	it('returns false for public visibility on normal event', () => {
		const result = shouldRedactEnvelopeTeaser({
			originalLocation: { visibility: 'public' } as any,
			postPolicyLocation: { visibility: 'public' } as any,
			isConfirmed: false,
			slug: 'test-event',
			eventType: 'xv',
		});
		expect(result).toBe(false);
	});

	it('returns false when guest is confirmed on normal event', () => {
		const result = shouldRedactEnvelopeTeaser({
			originalLocation: { visibility: 'after-rsvp' } as any,
			postPolicyLocation: { visibility: 'after-rsvp' } as any,
			isConfirmed: true,
			slug: 'test-event',
			eventType: 'xv',
		});
		expect(result).toBe(false);
	});

	it('returns true for Luna-Estrella with after-rsvp visibility regardless of confirmation', () => {
		const result = shouldRedactEnvelopeTeaser({
			originalLocation: { visibility: 'after-rsvp' } as any,
			postPolicyLocation: undefined,
			isConfirmed: false,
			slug: 'luna-y-estrella',
			eventType: 'primera-comunion',
		});
		expect(result).toBe(true);
	});

	it('returns true for Luna-Estrella even when confirmed', () => {
		const result = shouldRedactEnvelopeTeaser({
			originalLocation: { visibility: 'after-rsvp' } as any,
			postPolicyLocation: undefined,
			isConfirmed: true,
			slug: 'luna-y-estrella',
			eventType: 'primera-comunion',
		});
		expect(result).toBe(true);
	});

	it('returns false for Luna-Estrella with public visibility', () => {
		const result = shouldRedactEnvelopeTeaser({
			originalLocation: { visibility: 'public' } as any,
			postPolicyLocation: undefined,
			isConfirmed: false,
			slug: 'luna-y-estrella',
			eventType: 'primera-comunion',
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
			routeSlug: 'test-event',
			eventType: 'xv',
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
			routeSlug: 'test-event',
			eventType: 'xv',
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
			routeSlug: 'test-event',
			eventType: 'xv',
		});
		expect(result.sections.location).toMatchObject({
			isLocked: true,
			lockedTitle: 'Ubicación reservada',
			introHeading: 'Ubicación',
		});
		expect((result.sections.location as any)?.ceremony).toBeUndefined();
		expect(result.hero.venueName).toBeUndefined();
	});

	it('strips location for Luna-Estrella when guest is not confirmed', () => {
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
			isConfirmedGuest: false,
			routeSlug: 'luna-y-estrella',
			eventType: 'primera-comunion',
		});
		expect(result.sections.location).toBeUndefined();
		expect(result.hero.venueName).toBeUndefined();
	});

	it('reveals location as rsvp.revealedLocation for confirmed Luna-Estrella guests', () => {
		const viewModel = {
			...baseViewModel,
			sections: {
				location: {
					visibility: 'after-rsvp' as const,
					introHeading: 'Ubicación',
					ceremony: { venueName: 'Salón García' },
				},
				rsvp: { title: 'Confirma' },
			},
		} as any as InvitationViewModel;
		const result = applyLocationPolicy({
			viewModel,
			isConfirmedGuest: true,
			routeSlug: 'luna-y-estrella',
			eventType: 'primera-comunion',
		});
		expect(result.sections.location).toBeUndefined();
		expect(result.sections.rsvp?.revealedLocation?.ceremony?.venueName).toBe('Salón García');
	});
});
