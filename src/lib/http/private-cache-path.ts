export const PRIVATE_CACHE_CONTROL = 'no-store, private';

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
		pathname.startsWith('/api/auth') ||
		pathname === '/captura' ||
		pathname.startsWith('/captura/') ||
		pathname.startsWith('/api/captura')
	);
}
