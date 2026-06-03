export function getCsrfToken(): string | undefined {
	if (typeof document === 'undefined') return undefined;
	const meta = document.querySelector('meta[name="csrf-token"]');
	return meta?.getAttribute('content') || undefined;
}
