export function getPublicSlug(invitation: {
	slug?: string | null;
	eventType: string;
	id: string;
}): string {
	return invitation.slug ?? `${invitation.eventType}-${invitation.id.slice(0, 8)}`;
}
