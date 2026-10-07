/**
 * Origin for every guest-facing memories link (QR, upload page, shared gallery).
 * Production always answers the canonical domain, so a printed QR resolves for
 * years whatever host served the dashboard. Preview and local runs answer the
 * origin that served the request: their data and secrets exist only there, so a
 * canonical link would point at a space or token Production does not know.
 */

import { getEnv } from '@/lib/server/env';
import { MEMORIES_PUBLIC_ORIGIN } from '@/lib/memories/contract/private-request';

export function resolveMemoriesPublicOrigin(requestOrigin?: string): string {
	if (getEnv('VERCEL_ENV').trim().toLowerCase() === 'production' || !requestOrigin) {
		return MEMORIES_PUBLIC_ORIGIN;
	}
	try {
		const url = new URL(requestOrigin);
		if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
	} catch {
		// Fall through to the canonical domain.
	}
	return MEMORIES_PUBLIC_ORIGIN;
}

/** The serving origin of an API request, as the dashboard routes receive it. */
export function memoriesRequestOrigin(request: Request): string {
	return new URL(request.url).origin;
}
