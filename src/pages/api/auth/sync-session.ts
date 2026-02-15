import type { APIRoute } from 'astro';
import { errorResponse } from '@/lib/rsvp-v2/http';
import { ApiError } from '@/lib/rsvp-v2/errors';
import {
	buildIdleActivityCookie,
	buildRefreshTokenCookie,
	buildSessionCookie,
	buildTrustedDeviceCookie,
	clearMfaRefreshCookie,
	clearMfaSessionCookie,
} from '@/lib/rsvp-v2/cookies';
import { hasMfaEvidence } from '@/lib/rsvp-v2/authMfaEvidence';
import { assertSameOrigin, enforceAuthRateLimit, sanitizeToken } from '@/lib/rsvp-v2/authSecurity';
import { getHostSessionFromRequest, getSupabaseUserByAccessToken } from '@/lib/rsvp-v2/auth';
import { createTrustedDeviceToken } from '@/lib/rsvp-v2/trustedDevice';
import { normalizeAppRole } from '@/lib/rsvp-v2/roles';

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

		const hasMfa = hasMfaEvidence({
			token: elevatedAccessToken,
			amr: elevatedUser.amr,
		});
		if (!hasMfa) {
			throw new ApiError(403, 'forbidden', 'La sesión no tiene verificación MFA.');
		}

		const headers = new Headers({ 'Content-Type': 'application/json' });
		headers.append('Set-Cookie', buildSessionCookie(elevatedAccessToken));
		headers.append('Set-Cookie', buildIdleActivityCookie(Math.floor(Date.now() / 1000)));
		if (elevatedRefreshToken) {
			headers.append('Set-Cookie', buildRefreshTokenCookie(elevatedRefreshToken));
		}
		const role = normalizeAppRole(elevatedUser.app_metadata?.role);
		if (role === 'super_admin') {
			const trusted = createTrustedDeviceToken({
				userId: elevatedUser.id,
				role,
				userAgent: request.headers.get('user-agent') || '',
			});
			headers.append(
				'Set-Cookie',
				buildTrustedDeviceCookie(trusted.token, trusted.maxAgeSeconds),
			);
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
