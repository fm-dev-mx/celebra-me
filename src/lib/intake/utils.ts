export function hasRsvpContent(content: Record<string, unknown> | undefined): boolean {
	if (!content) return false;
	const rsvp = content.rsvp as Record<string, unknown> | undefined;
	return Boolean(rsvp?.title || rsvp?.guestCap);
}

export function venueLabel(type: string, label?: string): string {
	return label || (type === 'ceremony' ? 'Ceremonia' : type === 'reception' ? 'Recepción' : '');
}

export function ensureFamilyGodparentExclusivity(
	family: Record<string, unknown>,
): Record<string, unknown> {
	const groups = family.godparentGroups;
	if (Array.isArray(groups)) {
		if (groups.length > 0) {
			const { godparents: _, ...rest } = family;
			return rest;
		}
		const { godparentGroups: _, ...rest } = family;
		return rest;
	}
	return family;
}
