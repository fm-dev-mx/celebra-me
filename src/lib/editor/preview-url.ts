export function buildPreviewUrl(
	invitationId: string,
	previewVersion: number,
	embedded: boolean,
): string {
	const id = encodeURIComponent(invitationId);
	const query = embedded ? `embed=1&v=${previewVersion}` : `v=${previewVersion}`;
	return `/dashboard/invitaciones/${id}/preview?${query}`;
}
