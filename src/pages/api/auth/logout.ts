import type { APIRoute } from 'astro';
import {
	clearIdleActivityCookie,
	clearMfaRefreshCookie,
	clearMfaSessionCookie,
	clearRefreshTokenCookie,
	clearSessionCookie,
} from '@/lib/rsvp-v2/cookies';

export const POST: APIRoute = async () => {
	const headers = new Headers({ 'Content-Type': 'application/json' });
	headers.append('Set-Cookie', clearSessionCookie());
	headers.append('Set-Cookie', clearRefreshTokenCookie());
	headers.append('Set-Cookie', clearMfaSessionCookie());
	headers.append('Set-Cookie', clearMfaRefreshCookie());
	headers.append('Set-Cookie', clearIdleActivityCookie());

	return new Response(JSON.stringify({ ok: true, message: 'Sesion cerrada.' }), {
		status: 200,
		headers,
	});
};
