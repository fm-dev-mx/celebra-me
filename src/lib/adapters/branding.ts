export interface BrandingVisibility {
	showFooterBranding: boolean;
	showContactCta: boolean;
	showThankYouBranding: boolean;
}

export const DEFAULT_BRANDING_VISIBILITY: BrandingVisibility = {
	showFooterBranding: true,
	showContactCta: true,
	showThankYouBranding: true,
};

export const BRANDING_HIDDEN_VISIBILITY: BrandingVisibility = {
	showFooterBranding: false,
	showContactCta: false,
	showThankYouBranding: false,
};

export function resolveBrandingVisibility(input: {
	isDemo?: boolean;
	guest?: { hideCelebraMeBranding?: boolean } | null;
	isEventEligibleForGuestBrandingRemoval?: boolean;
}): BrandingVisibility {
	const shouldHideGuestBranding =
		!input.isDemo &&
		!!input.guest &&
		input.isEventEligibleForGuestBrandingRemoval &&
		input.guest.hideCelebraMeBranding === true;

	return shouldHideGuestBranding ? BRANDING_HIDDEN_VISIBILITY : DEFAULT_BRANDING_VISIBILITY;
}
