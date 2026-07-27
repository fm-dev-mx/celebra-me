export function buildPreviewUrl(
	invitationId: string,
	draftRevisionOrVersion: string | number | null | undefined,
	embedded: boolean,
	revealState?: 'closed' | 'opened' | 'internal',
	previewVersion?: number,
): string {
	const id = encodeURIComponent(invitationId);
	const params = new URLSearchParams();
	if (embedded) params.set('embed', '1');

	const draftRevision =
		typeof draftRevisionOrVersion === 'string' ? draftRevisionOrVersion : null;
	const versionFallback =
		typeof draftRevisionOrVersion === 'number' ? draftRevisionOrVersion : previewVersion;

	if (draftRevision) {
		params.set('revision', draftRevision);
	} else if (versionFallback !== undefined && versionFallback !== null) {
		params.set('v', String(versionFallback));
	}

	if (revealState) params.set('revealState', revealState);
	const query = params.toString();
	return `/dashboard/invitaciones/${id}/preview?${query}`;
}
