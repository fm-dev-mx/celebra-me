import type { APIRoute } from 'astro';
import { errorResponse } from '@/lib/rsvp-v2/http';
import { ApiError } from '@/lib/rsvp-v2/errors';
import {
	buildIdleActivityCookie,
	buildRefreshTokenCookie,
	buildSessionCookie,
	clearMfaRefreshCookie,
	clearMfaSessionCookie,
} from '@/lib/rsvp-v2/cookies';
import { assertSameOrigin, enforceAuthRateLimit, sanitizeToken } from '@/lib/rsvp-v2/authSecurity';
import { getHostSessionFromRequest, getSupabaseUserByAccessToken } from '@/lib/rsvp-v2/auth';

export const POST: APIRoute = async ({ request, url }) => {
	try {
		assertSameOrigin(request, url.origin);
		await enforceAuthRateLimit({
			request,
			entityId: 'sync-session',
			maxHits: 20,
			windowSec: 60,
		});

		const currentSession = await getHostSessionFromRequest(request);
		if (!currentSession) {
			throw new ApiError(401, 'unauthorized', 'No autorizado.');
		}

		const { accessToken, refreshToken } = (await request.json()) as {
			accessToken?: string;
			refreshToken?: string;
		};

		const elevatedAccessToken = sanitizeToken(accessToken);
		const elevatedRefreshToken = sanitizeToken(refreshToken);

		if (!elevatedAccessToken) {
			throw new ApiError(400, 'bad_request', 'Access token is required');
		}

		const elevatedUser = await getSupabaseUserByAccessToken(elevatedAccessToken);
		if (!elevatedUser || elevatedUser.id !== currentSession.userId) {
			throw new ApiError(403, 'forbidden', 'Token de elevación inválido.');
		}

		const hasMfa = (elevatedUser.amr || []).some((item) => item?.method === 'mfa');
		if (!hasMfa) {
			throw new ApiError(403, 'forbidden', 'La sesión no tiene verificación MFA.');
		}

		const headers = new Headers({ 'Content-Type': 'application/json' });
		headers.append('Set-Cookie', buildSessionCookie(elevatedAccessToken));
		headers.append('Set-Cookie', buildIdleActivityCookie(Math.floor(Date.now() / 1000)));
		if (elevatedRefreshToken) {
			headers.append('Set-Cookie', buildRefreshTokenCookie(elevatedRefreshToken));
		}
		headers.append('Set-Cookie', clearMfaSessionCookie());
		headers.append('Set-Cookie', clearMfaRefreshCookie());

		return new Response(JSON.stringify({ ok: true, message: 'Session synced successfully' }), {
			status: 200,
			headers,
		});
	} catch (error: unknown) {
		if (error instanceof SyntaxError) {
			return errorResponse(new ApiError(400, 'bad_request', 'JSON inválido.'));
		}
		return errorResponse(error);
	}
};
