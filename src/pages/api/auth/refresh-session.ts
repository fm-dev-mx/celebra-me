import type { APIRoute } from 'astro';
import { refreshAccessToken } from '@/lib/rsvp/auth/auth-api';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	buildIdleActivityCookie,
	buildRefreshTokenCookie,
	buildSessionCookie,
	clearRefreshTokenCookie,
	clearSessionCookie,
} from '@/lib/rsvp/auth/cookies';
import { assertSameOrigin, enforceAuthRateLimit } from '@/lib/rsvp/security/auth-security';
import { errorResponse } from '@/lib/rsvp/core/http';

function sanitize(value: unknown, maxLen = 4096): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function getCookieValue(request: Request, key: string): string {
	const header = request.headers.get('cookie');
	if (!header) return '';
	const parts = header.split(';');
	for (const part of parts) {
		const [k, ...rest] = part.trim().split('=');
		if (k === key) return decodeURIComponent(rest.join('='));
	}
	return '';
}

export const POST: APIRoute = async ({ request, url }) => {
	try {
		assertSameOrigin(request, url.origin);
		await enforceAuthRateLimit({
			request,
			entityId: 'refresh-session',
			maxHits: 20,
			windowSec: 60,
		});

		const refreshToken = sanitize(getCookieValue(request, 'sb-refresh-token'));
		if (!refreshToken) throw new ApiError(401, 'unauthorized', 'Session cannot be refreshed.');

		const refreshed = await refreshAccessToken({ refreshToken });
		const headers = new Headers({ 'Content-Type': 'application/json' });
		headers.append('Set-Cookie', buildSessionCookie(refreshed.access_token));
		headers.append('Set-Cookie', buildRefreshTokenCookie(refreshed.refresh_token));
		headers.append('Set-Cookie', buildIdleActivityCookie(Math.floor(Date.now() / 1000)));
		return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
	} catch (error) {
		const headers = new Headers({ 'Content-Type': 'application/json' });
		headers.append('Set-Cookie', clearSessionCookie());
		headers.append('Set-Cookie', clearRefreshTokenCookie());
		const failed = errorResponse(error);
		for (const [key, value] of failed.headers.entries()) {
			headers.set(key, value);
		}
		return new Response(await failed.text(), { status: failed.status, headers });
	}
};
