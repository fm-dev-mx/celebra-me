import type { EventRecord } from '@/interfaces/rsvp/domain.interface';

/**
 * Generates a secure, environment-aware URL for guest invitations.
 *
 * Pattern: {origin}/{eventType}/{eventSlug}/invitado?invite={inviteId}
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
		return `${baseUrl}/${eventType}/${eventSlug}/i/${shortId}`;
	}

	const type = encodeURIComponent(eventType);
	const slug = encodeURIComponent(eventSlug);
	const invite = encodeURIComponent(inviteId);

	return `${baseUrl}/${type}/${slug}/invitado?invite=${invite}`;
}
