/**
 * Security headers for files the Cloudflare Workers build serves from static assets.
 * Prerendered pages (`/`, `/privacidad`, `/terminos`, `/404`) and public files never reach
 * the Astro middleware, so `withSecurityHeaders` cannot add the headers there. Cloudflare
 * applies `_headers` rules to static assets; this module appends one `/*` rule with the
 * same headers the middleware sends.
 */
import type { HeaderEntry } from '../../src/lib/server/security-headers.ts';

export const STATIC_SECURITY_HEADERS_MARKER = '# celebra-me: security headers for static assets';

/** Returns `_headers` content with the security rule appended once. */
export function appendStaticSecurityHeaders(
	existing: string,
	headers: readonly HeaderEntry[],
): string {
	if (existing.includes(STATIC_SECURITY_HEADERS_MARKER)) return existing;
	const rule = [
		STATIC_SECURITY_HEADERS_MARKER,
		'/*',
		...headers.map(([name, value]) => `  ${name}: ${value}`),
	].join('\n');
	const base = existing.trimEnd();
	return `${base ? `${base}\n\n` : ''}${rule}\n`;
}
