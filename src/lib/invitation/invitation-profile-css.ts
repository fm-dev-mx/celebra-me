export interface InvitationProfileIdentity {
	visualProfileId?: string;
	slug?: string;
}

/** Resolve the profile identity with the existing visualProfileId → slug precedence. */
export function resolveInvitationProfileId(input: InvitationProfileIdentity): string | undefined {
	return input.visualProfileId || input.slug;
}

export function resolveInvitationProfileCssUrl(
	profileUrlMap: Readonly<Record<string, string>>,
	input: InvitationProfileIdentity,
): string | undefined {
	const profileId = resolveInvitationProfileId(input);
	return profileId ? profileUrlMap[profileId] : undefined;
}

/** Google Fonts Parisienne is required only by the Romina hero, not by the sealed envelope. */
const PARISIENNE_PROFILE_IDS = new Set(['romina-rios-chaparro']);

export const PARISIENNE_GOOGLE_FONTS_HREF =
	'https://fonts.googleapis.com/css2?family=Parisienne&display=swap';

export function invitationProfileNeedsParisienne(input: InvitationProfileIdentity): boolean {
	const profileId = resolveInvitationProfileId(input);
	return Boolean(profileId && PARISIENNE_PROFILE_IDS.has(profileId));
}
