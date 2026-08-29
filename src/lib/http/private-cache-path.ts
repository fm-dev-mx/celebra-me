export const PRIVATE_CACHE_CONTROL = 'no-store, private';

/**
 * Applies the private cache contract without assuming that a response returned
 * by `fetch()` has mutable headers. Upstream Fetch responses use an immutable
 * header guard, so they must be rewrapped before middleware can add headers.
 */
export function withPrivateNoStore(response: Response): Response {
	try {
		response.headers.set('Cache-Control', PRIVATE_CACHE_CONTROL);
		return response;
	} catch {
		const headers = new Headers(response.headers);
		headers.set('Cache-Control', PRIVATE_CACHE_CONTROL);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
}

/**
 * Path prefixes whose responses are identity-dependent or otherwise unsafe
 * for Vercel's default `public, max-age=0, must-revalidate` function header.
 * `/login` is public HTML and is excluded on purpose.
 */
export function isPrivateNoStorePath(pathname: string): boolean {
	if (pathname === '/login' || pathname.startsWith('/login/')) {
		return false;
	}

	return (
		pathname.startsWith('/dashboard') ||
		pathname.startsWith('/api/dashboard') ||
		pathname.startsWith('/api/memories') ||
		pathname.startsWith('/api/auth') ||
		pathname === '/captura' ||
		pathname.startsWith('/captura/') ||
		pathname.startsWith('/api/captura')
	);
}
