import {
	getInvitationContextBySlugAndCode,
	getInvitationContextByShortId,
} from '@/lib/rsvp/services/invitation-context.service';
import { buildGuestCodePath, buildInvitationPath } from '@/utils/invitation-link';
import { resolvePublicInvitation } from '@/lib/invitation/content-resolver';
import { buildLayoutData } from '@/lib/invitation/page-data';
import { isSocialCrawler } from '@/lib/social/social-crawler';
import {
	buildSocialImageMetadata,
	type SocialImageMetadata,
} from '@/lib/invitation/social-metadata';
import { resolveShareDescription } from '@/lib/rsvp/services/shared/share-message-defaults';
import { recordLinkPreview } from '@/lib/rsvp/engagement/engagement.service';
import { UNAVAILABLE_INVITATION_ROBOTS } from '@/lib/invitation/access/invitation-access';
import { ApiError } from '@/lib/rsvp/core/errors';
import { isGuestLinkBlocked, recordGuestLinkFailure } from '@/lib/invitation/guest-link-rate-limit';
import { safeErr } from '@/lib/server/safe-error';

/** Seconds a blocked connection waits: the failed-code window. */
const GUEST_LINK_RETRY_AFTER = '3600';

const SHORT_ID_PRIVATE_HEADERS = {
	'Cache-Control': 'no-store, private',
	Vary: 'User-Agent',
} as const;

interface ShortIdOGData {
	ogTitle: string;
	ogDescription: string;
	ogImage: SocialImageMetadata;
}

export type ShortIdResolution =
	| { kind: 'redirect'; redirectTarget: string; canonicalUrl: string }
	| {
			kind: 'crawler';
			ogData: ShortIdOGData;
			canonicalUrl: string;
			redirectTarget: string;
			inviteId: string;
	  }
	/** Crawler asking for a disabled invitation: no metadata at all. */
	| { kind: 'unavailable' }
	/** `notFound`: the code matched no guest (counts toward the failed-code limit). */
	| { kind: 'error'; notFound: boolean };

/**
 * Convenience wrapper around resolveShortIdRequest that returns a page-friendly
 * result suitable for Astro page frontmatter (no Response/Astro.redirect objects
 * that depend on the Astro global). Used by the two short-ID OG pages to avoid
 * code duplication.
 */
export type ShortIdPageResult =
	| { kind: 'error' }
	/** Too many unknown codes from this connection. */
	| { kind: 'blocked' }
	| { kind: 'unavailable' }
	| { kind: 'redirect'; target: string }
	| { kind: 'render'; ogData: ShortIdOGData; canonicalUrl: string; redirectTarget: string };

/**
 * Private 403 for a crawler asking for a disabled invitation. The page renders no
 * metadata at all (no names, date or image).
 */
export function applyUnavailableShortIdResponse(
	response: ResponseInit & { readonly headers: Headers },
): void {
	response.status = 403;
	response.headers.set('Cache-Control', 'no-store, private');
	response.headers.set('Vary', 'User-Agent');
	response.headers.set('X-Robots-Tag', UNAVAILABLE_INVITATION_ROBOTS);
}

/**
 * Response handling shared by the two short-link pages: a Response the page returns as is
 * (unknown link or human redirect), or `null` when the page renders `InvitationOGShell`.
 * Personalized metadata never enters a shared cache.
 */
export function buildShortIdEarlyResponse(
	result: ShortIdPageResult,
	response: ResponseInit & { readonly headers: Headers },
): Response | null {
	if (result.kind === 'error') {
		return new Response(null, { status: 404, headers: SHORT_ID_PRIVATE_HEADERS });
	}
	if (result.kind === 'blocked') {
		return new Response(null, {
			status: 429,
			headers: { ...SHORT_ID_PRIVATE_HEADERS, 'Retry-After': GUEST_LINK_RETRY_AFTER },
		});
	}
	if (result.kind === 'redirect') {
		return new Response(null, {
			status: 302,
			headers: { ...SHORT_ID_PRIVATE_HEADERS, Location: result.target },
		});
	}
	for (const [name, value] of Object.entries(SHORT_ID_PRIVATE_HEADERS)) {
		response.headers.set(name, value);
	}
	if (result.kind === 'unavailable') {
		// Disabled invitation: crawlers get an empty 403, no metadata.
		applyUnavailableShortIdResponse(response);
	}
	return null;
}

export async function resolveShortIdPage(
	shortId: string | undefined,
	request: Request,
	siteOrigin: string,
): Promise<ShortIdPageResult> {
	return resolveGuestLinkPage(request, (userAgent) =>
		resolveShortIdRequest(shortId, userAgent, siteOrigin),
	);
}

/** `/{slug}/{guestCode}`: same behaviour as `/i/{shortId}`, scoped to one invitation. */
export async function resolveGuestCodePage(
	eventSlug: string | undefined,
	guestCode: string | undefined,
	request: Request,
	siteOrigin: string,
): Promise<ShortIdPageResult> {
	return resolveGuestLinkPage(request, (userAgent) =>
		resolveGuestCodeRequest(eventSlug, guestCode, userAgent, siteOrigin),
	);
}

/**
 * Shared page flow of both guest link forms: a connection that already spent its failed-code
 * allowance is refused before any lookup, and every unknown code counts against it.
 */
async function resolveGuestLinkPage(
	request: Request,
	resolve: (userAgent: string) => Promise<ShortIdResolution>,
): Promise<ShortIdPageResult> {
	if (await isGuestLinkBlocked(request)) {
		return { kind: 'blocked' };
	}

	const userAgent = request.headers.get('user-agent') || '';
	const resolution = await resolve(userAgent);

	if (resolution.kind === 'error') {
		if (resolution.notFound) await recordGuestLinkFailure(request);
		return { kind: 'error' };
	}
	if (resolution.kind === 'unavailable') {
		return { kind: 'unavailable' };
	}
	if (resolution.kind === 'redirect') {
		return { kind: 'redirect', target: resolution.redirectTarget };
	}
	await recordLinkPreview(resolution.inviteId, request);
	return {
		kind: 'render',
		ogData: resolution.ogData,
		canonicalUrl: resolution.canonicalUrl,
		redirectTarget: resolution.redirectTarget,
	};
}

type GuestLinkContext = Awaited<ReturnType<typeof getInvitationContextByShortId>>;

/** A 400/404 from the lookup means the code is wrong; anything else is an outage. */
function isUnknownCodeError(error: unknown): boolean {
	return error instanceof ApiError && (error.status === 400 || error.status === 404);
}

export async function resolveShortIdRequest(
	shortId: string | undefined,
	userAgent: string,
	siteOrigin: string,
): Promise<ShortIdResolution> {
	if (!shortId) {
		return { kind: 'error', notFound: true };
	}
	return resolveGuestLinkRequest(
		() => getInvitationContextByShortId(shortId),
		`/i/${shortId}`,
		userAgent,
		siteOrigin,
	);
}

export async function resolveGuestCodeRequest(
	eventSlug: string | undefined,
	guestCode: string | undefined,
	userAgent: string,
	siteOrigin: string,
): Promise<ShortIdResolution> {
	if (!eventSlug || !guestCode) {
		return { kind: 'error', notFound: true };
	}
	return resolveGuestLinkRequest(
		() => getInvitationContextBySlugAndCode(eventSlug, guestCode),
		buildGuestCodePath(eventSlug, guestCode),
		userAgent,
		siteOrigin,
	);
}

async function resolveGuestLinkRequest(
	lookup: () => Promise<GuestLinkContext>,
	canonicalPath: string,
	userAgent: string,
	siteOrigin: string,
): Promise<ShortIdResolution> {
	let context;
	try {
		context = await lookup();
	} catch (error) {
		const notFound = isUnknownCodeError(error);
		if (!notFound) console.error('[invitation][shortId] Error:', safeErr(error));
		return { kind: 'error', notFound };
	}

	if (!context.inviteId) {
		return { kind: 'error', notFound: true };
	}

	const redirectTarget = buildInvitationPath({
		eventType: context.eventType,
		eventSlug: context.eventSlug,
		inviteId: context.inviteId,
	});
	const canonicalUrl = new URL(canonicalPath, siteOrigin).href;

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
		const resolution = await resolvePublicInvitation(context.eventSlug, context.eventType);
		if (resolution?.source === 'unavailable') {
			return { kind: 'unavailable' };
		}
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
		console.error('[invitation][shortId] Error resolving invitation content:', safeErr(error));
	}

	return {
		kind: 'crawler',
		ogData: { ogTitle, ogDescription, ogImage },
		redirectTarget,
		canonicalUrl,
		inviteId: context.inviteId,
	};
}
