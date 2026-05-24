import { resolveBrandingVisibility } from '@/lib/adapters/branding';

describe('resolveBrandingVisibility (guest-level)', () => {
	it('shows branding for demo events regardless of guest flag', () => {
		const result = resolveBrandingVisibility({
			isDemo: true,
			guest: { hideCelebraMeBranding: true },
			isEventEligibleForGuestBrandingRemoval: true,
		});

		expect(result).toEqual({
			showFooterBranding: true,
			showContactCta: true,
			showThankYouBranding: true,
		});
	});

	it('shows branding when there is no guest context (public link)', () => {
		const result = resolveBrandingVisibility({
			isDemo: false,
			guest: null,
			isEventEligibleForGuestBrandingRemoval: true,
		});

		expect(result).toEqual({
			showFooterBranding: true,
			showContactCta: true,
			showThankYouBranding: true,
		});
	});

	it('shows branding when event is not eligible for guest branding removal', () => {
		const result = resolveBrandingVisibility({
			isDemo: false,
			guest: { hideCelebraMeBranding: true },
			isEventEligibleForGuestBrandingRemoval: false,
		});

		expect(result).toEqual({
			showFooterBranding: true,
			showContactCta: true,
			showThankYouBranding: true,
		});
	});

	it('shows branding when eligible guest does not have the flag enabled', () => {
		const result = resolveBrandingVisibility({
			isDemo: false,
			guest: { hideCelebraMeBranding: false },
			isEventEligibleForGuestBrandingRemoval: true,
		});

		expect(result).toEqual({
			showFooterBranding: true,
			showContactCta: true,
			showThankYouBranding: true,
		});
	});

	it('hides branding for eligible event with personalized guest that has flag enabled', () => {
		const result = resolveBrandingVisibility({
			isDemo: false,
			guest: { hideCelebraMeBranding: true },
			isEventEligibleForGuestBrandingRemoval: true,
		});

		expect(result).toEqual({
			showFooterBranding: false,
			showContactCta: false,
			showThankYouBranding: false,
		});
	});

	it('defaults isDemo to false and returns visible branding for null guest', () => {
		const result = resolveBrandingVisibility({
			guest: null,
		});

		expect(result).toEqual({
			showFooterBranding: true,
			showContactCta: true,
			showThankYouBranding: true,
		});
	});

	it('returns visible branding when guest is undefined', () => {
		const result = resolveBrandingVisibility({});

		expect(result).toEqual({
			showFooterBranding: true,
			showContactCta: true,
			showThankYouBranding: true,
		});
	});
});
