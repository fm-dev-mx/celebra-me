export const BRANDING_REMOVAL_RULES: Record<string, { enabled: boolean; guestLimit: number }> = {
	'bautizo/cesar-ramses': {
		enabled: true,
		guestLimit: 10,
	},
};

export function isEventEligibleForBrandingRemoval(eventType: string, eventSlug: string): boolean {
	const key = `${eventType}/${eventSlug}`;
	const rule = BRANDING_REMOVAL_RULES[key];
	return rule?.enabled === true;
}

export function getBrandingRemovalGuestLimit(eventType: string, eventSlug: string): number {
	const key = `${eventType}/${eventSlug}`;
	return BRANDING_REMOVAL_RULES[key]?.guestLimit ?? 0;
}
