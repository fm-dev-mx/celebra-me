export function buildPreviewUrl(
	invitationId: string,
	previewVersion: number,
	embedded: boolean,
	revealState?: 'closed' | 'opened' | 'internal',
): string {
	const id = encodeURIComponent(invitationId);
	const params = new URLSearchParams();
	if (embedded) params.set('embed', '1');
	params.set('v', String(previewVersion));
	if (revealState) params.set('revealState', revealState);
	const query = params.toString();
	return `/dashboard/invitaciones/${id}/preview?${query}`;
}
