/**
 * Sends the bare domain to the canonical `www` host, as Vercel did before the cutover. The
 * printed QR codes point at the apex, and the memories Sign Worker accepts uploads only from
 * `www`, so a page served on the apex could never upload. The Worker answers both zone
 * routes, so the redirect lives here as well as in the zone's redirect rule; the in-process
 * live checks then see the same answer a guest gets.
 */

const APEX_HOST = 'celebra-me.com';
const CANONICAL_ORIGIN = 'https://www.celebra-me.com';

/** A 307 to the same path and query on `www` for an apex request; null for any other host. */
export function redirectApexToCanonical(request: Request): Response | null {
	const url = new URL(request.url);
	if (url.hostname !== APEX_HOST) return null;
	return new Response(null, {
		status: 307,
		headers: { location: `${CANONICAL_ORIGIN}${url.pathname}${url.search}` },
	});
}
