import type { InvitationCssLoadItem } from '@/lib/invitation/section-css-resolver-map';

export const DEFERRED_INVITATION_CSS_MEDIA = 'not all';

export interface InvitationStylesheetHeadLink {
	rel: 'stylesheet';
	href: string;
	media?: string;
	deferredCss?: boolean;
	canonicalPath?: string;
}

export function buildInvitationStylesheetHeadLinks(input: {
	presetUrl?: string;
	plan: readonly InvitationCssLoadItem[];
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
						canonicalPath: item.canonicalPath,
					}
				: { rel: 'stylesheet', href: item.href, canonicalPath: item.canonicalPath },
		);
	}
	return links;
}
