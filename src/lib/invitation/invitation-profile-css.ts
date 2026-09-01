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
