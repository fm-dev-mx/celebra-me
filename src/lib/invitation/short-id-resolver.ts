import { getInvitationContextByShortId } from '@/lib/rsvp/services/invitation-context.service';
import { buildInvitationPath } from '@/utils/invitation-link';
import { resolveInvitationContent } from '@/lib/invitation/content-resolver';
import { buildLayoutData } from '@/lib/invitation/page-data';
import { isSocialCrawler } from '@/lib/social/social-crawler';
import { buildSocialImageMetadata } from '@/lib/invitation/social-metadata';

type SocialImageMetadata = ReturnType<typeof buildSocialImageMetadata>;

export interface ShortIdOGData {
	ogTitle: string;
	ogDescription: string;
	ogImage: SocialImageMetadata;
}

export type ShortIdResolution =
	| { kind: 'redirect'; redirectTarget: string; canonicalUrl: string }
	| { kind: 'crawler'; ogData: ShortIdOGData; canonicalUrl: string }
	| { kind: 'error' };

export async function resolveShortIdRequest(
	shortId: string | undefined,
	userAgent: string,
	siteOrigin: string,
): Promise<ShortIdResolution> {
	if (!shortId) {
		return { kind: 'error' };
	}

	let context: Awaited<ReturnType<typeof getInvitationContextByShortId>>;
	try {
		context = await getInvitationContextByShortId(shortId);
	} catch (error) {
		console.error('[invitation][shortId] Error:', error);
		return { kind: 'error' };
	}

	if (!context.inviteId) {
		return { kind: 'error' };
	}

	const canonicalUrl = new URL(`/i/${shortId}`, siteOrigin).href;

	if (!isSocialCrawler(userAgent)) {
		return {
			kind: 'redirect',
			redirectTarget: buildInvitationPath({
				eventType: context.eventType,
				eventSlug: context.eventSlug,
				inviteId: context.inviteId,
			}),
			canonicalUrl,
		};
	}

	let ogTitle = context.eventTitle;
	let ogDescription = '';
	let ogImage = buildSocialImageMetadata('/images/og-image.webp', { origin: siteOrigin });

	try {
		const resolution = await resolveInvitationContent(context.eventSlug, context.eventType);
		if (resolution) {
			const viewModel = resolution.viewModel;
			const layoutData = buildLayoutData(viewModel, context.guest?.fullName);
			ogTitle = layoutData.title;
			ogDescription = layoutData.description;
			if (layoutData.image) {
				ogImage = buildSocialImageMetadata(layoutData.image, { origin: siteOrigin });
			}
		}
	} catch (error) {
		console.error('[invitation][shortId] Error resolving invitation content:', error);
	}

	return {
		kind: 'crawler',
		ogData: { ogTitle, ogDescription, ogImage },
		canonicalUrl,
	};
}
