import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import { usesShortInvitationPath } from '@/lib/invitation/slug-policy';
import { getDemoRouteSlug } from '@/lib/invitation/demo-routes';

/** Public path of an invitation: `/{slug}` for short-URL invitations, else `/{eventType}/{slug}`. */
export function buildPublicInvitationPath(eventType: string, slug: string): string {
	const demoRouteSlug = getDemoRouteSlug(slug);
	if (demoRouteSlug) return `/${encodeURIComponent(demoRouteSlug)}`;
	const encodedSlug = encodeURIComponent(slug);
	return usesShortInvitationPath(slug)
		? `/${encodedSlug}`
		: `/${encodeURIComponent(eventType)}/${encodedSlug}`;
}

export function buildInvitationPath(params: {
	eventType: EventRecord['eventType'];
	eventSlug: string;
	inviteId: string;
}): string {
	const invite = encodeURIComponent(params.inviteId);

	return `${buildPublicInvitationPath(params.eventType, params.eventSlug)}?invite=${invite}`;
}

/**
 * Generates a minimal /i/{shortId} invitation path.
 * This is the preferred format for share links.
 */
export function buildMinimalInvitationPath(shortId: string): string {
	return `/i/${encodeURIComponent(shortId)}`;
}

/**
 * Personal guest path `/{slug}/{guestCode}`, e.g. `/america/k7q2`. Slugs can never be event
 * types, so it never collides with `/{eventType}/{slug}`.
 */
export function buildGuestCodePath(eventSlug: string, guestCode: string): string {
	return `/${encodeURIComponent(eventSlug)}/${encodeURIComponent(guestCode)}`;
}

/**
 * Generates a secure, environment-aware URL for guest invitations.
 *
 * Preferred pattern: {origin}/{eventSlug}/{guestCode}  (short-URL invitations with a code)
 * Legacy:             {origin}/i/{shortId}  (still resolves for links already sent)
 * Fallback:           {origin}/{eventType}/{eventSlug}?invite={inviteId}
 * Fallback (no slug): {origin}/invitacion/{inviteId}
 */
export function generateInvitationLink(params: {
	origin: string;
	eventType?: EventRecord['eventType'];
	eventSlug?: string;
	inviteId: string;
	shortId?: string;
	guestCode?: string;
}): string {
	const { origin, shortId, guestCode, eventType, eventSlug, inviteId } = params;
	const baseUrl = origin.replace(/\/+$/, '');

	if (guestCode && eventSlug && usesShortInvitationPath(eventSlug)) {
		return `${baseUrl}${buildGuestCodePath(eventSlug, guestCode)}`;
	}

	if (shortId) {
		return `${baseUrl}${buildMinimalInvitationPath(shortId)}`;
	}

	if (eventType && eventSlug) {
		return `${baseUrl}${buildInvitationPath({ eventType, eventSlug, inviteId })}`;
	}

	return `${baseUrl}/invitacion/${encodeURIComponent(inviteId)}`;
}
