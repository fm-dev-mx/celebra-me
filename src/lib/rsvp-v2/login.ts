function sanitizePath(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) return '';
	if (!trimmed.startsWith('/')) return '';
	if (trimmed.startsWith('//')) return '';
	return trimmed;
}

export function resolveNextPath(rawNext: string | null | undefined, fallbackPath: string): string {
	const next = sanitizePath(rawNext ?? '');
	return next || fallbackPath;
}

export function buildHostLoginRedirect(nextPath = '/dashboard/invitados'): string {
	return `/login?next=${encodeURIComponent(nextPath)}`;
}
