import {
	invitationProfileNeedsParisienne,
	PARISIENNE_GOOGLE_FONTS_HREF,
	type InvitationProfileIdentity,
} from '@/lib/invitation/invitation-profile-css';
import type { InvitationCssLoadItem } from '@/lib/invitation/section-css-resolver-map';

export const DEFERRED_INVITATION_CSS_MEDIA = 'not all';

export interface InvitationStylesheetHeadLink {
	rel: 'preconnect' | 'stylesheet';
	href: string;
	media?: string;
	deferredCss?: boolean;
}

export function buildInvitationStylesheetHeadLinks(input: {
	presetUrl?: string;
	plan: readonly InvitationCssLoadItem[];
	profileIdentity?: InvitationProfileIdentity;
	forceBlocking?: boolean;
}): InvitationStylesheetHeadLink[] {
	const forceBlocking = Boolean(input.forceBlocking);
	const links: InvitationStylesheetHeadLink[] = [];

	if (input.presetUrl) {
		links.push({ rel: 'stylesheet', href: input.presetUrl });
	}

	for (const item of input.plan) {
		const deferred = !forceBlocking && !item.blocking;
		links.push(
			deferred
				? {
						rel: 'stylesheet',
						href: item.href,
						media: DEFERRED_INVITATION_CSS_MEDIA,
						deferredCss: true,
					}
				: { rel: 'stylesheet', href: item.href },
		);
	}

	if (!invitationProfileNeedsParisienne(input.profileIdentity ?? {})) {
		return links;
	}

	links.push(
		{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
		{ rel: 'preconnect', href: 'https://fonts.gstatic.com' },
		forceBlocking
			? { rel: 'stylesheet', href: PARISIENNE_GOOGLE_FONTS_HREF }
			: {
					rel: 'stylesheet',
					href: PARISIENNE_GOOGLE_FONTS_HREF,
					media: DEFERRED_INVITATION_CSS_MEDIA,
					deferredCss: true,
				},
	);
	return links;
}
