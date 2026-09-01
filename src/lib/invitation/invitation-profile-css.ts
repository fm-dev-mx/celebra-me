export interface InvitationProfileIdentity {
	visualProfileId?: string;
}

/** Resolve only the explicitly declared visual profile; slug is never an implicit profile. */
export function resolveInvitationProfileId(input: InvitationProfileIdentity): string | undefined {
	return input.visualProfileId;
}

export function resolveInvitationProfileCssUrl(
	profileUrlMap: Readonly<Record<string, string>>,
	input: InvitationProfileIdentity,
): string | undefined {
	const profileId = resolveInvitationProfileId(input);
	return profileId ? profileUrlMap[profileId] : undefined;
}
