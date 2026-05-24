export interface BrandingConfig {
	hideCelebraMeBranding?: boolean;
}

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

export function resolveBrandingVisibility(input: {
	isDemo?: boolean;
	branding?: BrandingConfig;
}): BrandingVisibility {
	if (input.isDemo) return DEFAULT_BRANDING_VISIBILITY;

	if (input.branding?.hideCelebraMeBranding !== true) {
		return DEFAULT_BRANDING_VISIBILITY;
	}

	return {
		showFooterBranding: false,
		showContactCta: false,
		showThankYouBranding: false,
	};
}
