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
	eventType: string;
	eventSlug: string;
	inviteId: string;
}): string {
	const { origin, eventType, eventSlug, inviteId } = params;
	const baseUrl = origin.replace(/\/+$/, '');
	const type = encodeURIComponent(eventType || 'evento');
	const slug = encodeURIComponent(eventSlug || 'invitacion');
	const invite = encodeURIComponent(inviteId);

	return `${baseUrl}/${type}/${slug}/invitado?invite=${invite}`;
}
