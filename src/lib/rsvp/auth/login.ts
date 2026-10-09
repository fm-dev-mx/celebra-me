function sanitizePath(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) return '';
	if (!trimmed.startsWith('/')) return '';
	if (trimmed.startsWith('//')) return '';
	if (trimmed.includes('\\')) return '';
	if (/%2f|%5c/i.test(trimmed)) return '';
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f]/.test(trimmed)) return '';
	if (!/^\/[a-zA-Z0-9/_-]*$/.test(trimmed)) return '';
	return trimmed;
}

export function resolveNextPath(rawNext: string | null | undefined, fallbackPath: string): string {
	const next = sanitizePath(rawNext ?? '');
	if (next && next.startsWith('/dashboard')) return next;
	if (next === '/') return next;
	return fallbackPath;
}

export function buildHostLoginRedirect(nextPath = '/dashboard/invitados'): string {
	return `/login?next=${encodeURIComponent(nextPath)}`;
}
