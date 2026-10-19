import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import { usesShortInvitationPath } from '@/lib/invitation/slug-policy';

/** Public path of an invitation: `/{slug}` for short-URL invitations, else `/{eventType}/{slug}`. */
export function buildPublicInvitationPath(eventType: string, slug: string): string {
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
 * Generates a secure, environment-aware URL for guest invitations.
 *
 * Preferred pattern: {origin}/i/{shortId}  (when shortId is available)
 * Fallback:           {origin}/{eventType}/{eventSlug}?invite={inviteId}
 * Fallback (no slug): {origin}/invitacion/{inviteId}
 */
export function generateInvitationLink(params: {
	origin: string;
	eventType?: EventRecord['eventType'];
	eventSlug?: string;
	inviteId: string;
	shortId?: string;
}): string {
	const { origin, shortId, eventType, eventSlug, inviteId } = params;
	const baseUrl = origin.replace(/\/+$/, '');

	if (shortId) {
		return `${baseUrl}${buildMinimalInvitationPath(shortId)}`;
	}

	if (eventType && eventSlug) {
		return `${baseUrl}${buildInvitationPath({ eventType, eventSlug, inviteId })}`;
	}

	return `${baseUrl}/invitacion/${encodeURIComponent(inviteId)}`;
}
