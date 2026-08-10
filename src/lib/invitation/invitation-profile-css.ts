import { type EnvelopeSealColor, isEnvelopeSealColor } from './reveal-card';

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

/**
 * Legacy profile-token bridge for the canonical Envelope input.
 *
 * The adapter invokes this only on the historical Xareni asset path; the
 * shared Envelope renderer receives the resulting generic `sealAccent` value.
 */
const XARENI_SEAL_COLOR_CSS: Record<EnvelopeSealColor, string> = {
	roseGold: 'var(--xareni-rose-gold)',
	champagne: 'var(--xareni-champagne)',
	blush: 'var(--xareni-blush)',
	mauve: 'var(--xareni-mauve)',
	deepMauve: 'var(--xareni-deep-mauve)',
};

export function resolveXareniSealColor(value: unknown): string | undefined {
	return isEnvelopeSealColor(value) ? XARENI_SEAL_COLOR_CSS[value] : undefined;
}
