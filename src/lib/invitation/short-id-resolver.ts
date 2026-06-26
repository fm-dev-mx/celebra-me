import { getInvitationContextByShortId } from '@/lib/rsvp/services/invitation-context.service';
import { buildInvitationPath } from '@/utils/invitation-link';
import { resolveInvitationContent } from '@/lib/invitation/content-resolver';
import { buildLayoutData } from '@/lib/invitation/page-data';
import { isSocialCrawler } from '@/lib/social/social-crawler';
import {
	buildSocialImageMetadata,
	type SocialImageMetadata,
} from '@/lib/invitation/social-metadata';
import { resolveShareDescription } from '@/lib/rsvp/services/shared/share-message-defaults';

export interface ShortIdOGData {
	ogTitle: string;
	ogDescription: string;
	ogImage: SocialImageMetadata;
}

export type ShortIdResolution =
	| { kind: 'redirect'; redirectTarget: string; canonicalUrl: string }
	| { kind: 'crawler'; ogData: ShortIdOGData; canonicalUrl: string; redirectTarget: string }
	| { kind: 'error' };

/**
 * Convenience wrapper around resolveShortIdRequest that returns a page-friendly
 * result suitable for Astro page frontmatter (no Response/Astro.redirect objects
 * that depend on the Astro global). Used by the two short-ID OG pages to avoid
 * code duplication.
 */
export type ShortIdPageResult =
	| { kind: 'error' }
	| { kind: 'redirect'; target: string }
	| { kind: 'render'; ogData: ShortIdOGData; canonicalUrl: string; redirectTarget: string };

export async function resolveShortIdPage(
	shortId: string | undefined,
	request: Request,
	siteOrigin: string,
): Promise<ShortIdPageResult> {
	const userAgent = request.headers.get('user-agent') || '';
	const resolution = await resolveShortIdRequest(shortId, userAgent, siteOrigin);

	if (resolution.kind === 'error') {
		return { kind: 'error' };
	}
	if (resolution.kind === 'redirect') {
		return { kind: 'redirect', target: resolution.redirectTarget };
	}
	return {
		kind: 'render',
		ogData: resolution.ogData,
		canonicalUrl: resolution.canonicalUrl,
		redirectTarget: resolution.redirectTarget,
	};
}

export async function resolveShortIdRequest(
	shortId: string | undefined,
	userAgent: string,
	siteOrigin: string,
): Promise<ShortIdResolution> {
	if (!shortId) {
		return { kind: 'error' };
	}

	let context;
	try {
		context = await getInvitationContextByShortId(shortId);
	} catch (error) {
		console.error('[invitation][shortId] Error:', error);
		return { kind: 'error' };
	}

	if (!context.inviteId) {
		return { kind: 'error' };
	}

	const redirectTarget = buildInvitationPath({
		eventType: context.eventType,
		eventSlug: context.eventSlug,
		inviteId: context.inviteId,
	});
	const canonicalUrl = new URL(`/i/${shortId}`, siteOrigin).href;

	if (!isSocialCrawler(userAgent)) {
		return {
			kind: 'redirect',
			redirectTarget,
			canonicalUrl,
		};
	}

	let ogTitle = context.eventTitle;
	let ogDescription = resolveShareDescription(null, context.eventTitle);
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
		redirectTarget,
		canonicalUrl,
	};
}
