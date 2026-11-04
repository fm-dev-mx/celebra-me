import type { APIRoute } from 'astro';
import {
	clearIdleActivityCookie,
	clearMfaRefreshCookie,
	clearMfaSessionCookie,
	clearRefreshTokenCookie,
	clearSessionCookie,
	clearTrustedDeviceCookie,
} from '@/lib/rsvp/auth/cookies';
import { assertSameOrigin } from '@/lib/rsvp/security/auth-security';
import { errorResponse } from '@/lib/rsvp/core/http';
import { resolveAccessTokenFromRequest } from '@/lib/rsvp/auth/auth';
import { revokeAuthSessions } from '@/lib/rsvp/auth/auth-api';
import { safeErr } from '@/lib/server/safe-error';

export const POST: APIRoute = async ({ request, url }) => {
	try {
		if (request && url?.origin) {
			assertSameOrigin(request, url.origin);
		}
		const accessToken = resolveAccessTokenFromRequest(request);
		if (accessToken) {
			try {
				await revokeAuthSessions({ accessToken, scope: 'global' });
			} catch (error) {
				console.error('[logout] Session revocation failed:', safeErr(error));
			}
		}
		const headers = new Headers({ 'Content-Type': 'application/json' });
		headers.append('Set-Cookie', clearSessionCookie());
		headers.append('Set-Cookie', clearRefreshTokenCookie());
		headers.append('Set-Cookie', clearMfaSessionCookie());
		headers.append('Set-Cookie', clearMfaRefreshCookie());
		headers.append('Set-Cookie', clearIdleActivityCookie());
		headers.append('Set-Cookie', clearTrustedDeviceCookie());

		return new Response(JSON.stringify({ ok: true, message: 'Sesion cerrada.' }), {
			status: 200,
			headers,
		});
	} catch (error) {
		return errorResponse(error);
	}
};
