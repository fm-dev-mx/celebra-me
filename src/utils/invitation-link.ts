import type { EventRecord } from '@/interfaces/rsvp/domain.interface';

type InvitationPathParams = {
	eventType: EventRecord['eventType'];
	eventSlug: string;
};

type DirectInvitationPathParams = InvitationPathParams & {
	inviteId: string;
};

type ShortInvitationPathParams = InvitationPathParams & {
	shortId: string;
};

export function buildInvitationPath(params: DirectInvitationPathParams): string {
	const type = encodeURIComponent(params.eventType);
	const slug = encodeURIComponent(params.eventSlug);
	const invite = encodeURIComponent(params.inviteId);

	return `/${type}/${slug}?invite=${invite}`;
}

export function buildShortInvitationPath(params: ShortInvitationPathParams): string {
	const type = encodeURIComponent(params.eventType);
	const slug = encodeURIComponent(params.eventSlug);
	const shortId = encodeURIComponent(params.shortId);

	return `/${type}/${slug}/i/${shortId}`;
}

/**
 * Generates a secure, environment-aware URL for guest invitations.
 *
 * Pattern: {origin}/{eventType}/{eventSlug}?invite={inviteId}
 *
 * @param params invitation context
 * @returns absolute URL
 */
export function generateInvitationLink(params: {
	origin: string;
	eventType: EventRecord['eventType'];
	eventSlug: string;
	inviteId: string;
	shortId?: string;
}): string {
	const { origin, eventType, eventSlug, inviteId, shortId } = params;
	const baseUrl = origin.replace(/\/+$/, '');

	if (shortId) {
		return `${baseUrl}${buildShortInvitationPath({ eventType, eventSlug, shortId })}`;
	}

	return `${baseUrl}${buildInvitationPath({ eventType, eventSlug, inviteId })}`;
}
