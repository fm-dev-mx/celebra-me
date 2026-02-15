import type { APIRoute } from 'astro';
import {
	clearIdleActivityCookie,
	clearMfaRefreshCookie,
	clearMfaSessionCookie,
	clearRefreshTokenCookie,
	clearSessionCookie,
	clearTrustedDeviceCookie,
} from '@/lib/rsvp-v2/cookies';
import { assertSameOrigin } from '@/lib/rsvp-v2/authSecurity';
import { errorResponse } from '@/lib/rsvp-v2/http';

export const POST: APIRoute = async ({ request, url }) => {
	try {
		if (request && url?.origin) {
			assertSameOrigin(request, url.origin);
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
