/** Client-side `?debug=1` flag for console diagnostics; servers honor it only in a local process. */
export function isDebugMode(): boolean {
	if (typeof window === 'undefined') return false;
	return new URLSearchParams(window.location.search).get('debug') === '1';
}
