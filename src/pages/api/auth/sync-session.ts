import type { APIRoute } from 'astro';
import { errorResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	buildIdleActivityCookie,
	buildRefreshTokenCookie,
	buildSessionCookie,
	buildTrustedDeviceCookie,
	clearMfaRefreshCookie,
	clearMfaSessionCookie,
} from '@/lib/rsvp/auth/cookies';
import { hasMfaEvidence } from '@/lib/rsvp/auth/auth-mfa-evidence';
import {
	assertSameOrigin,
	enforceAuthRateLimit,
	sanitizeToken,
} from '@/lib/rsvp/security/auth-security';
import { getHostSessionFromRequest, getSupabaseUserByAccessToken } from '@/lib/rsvp/auth/auth';
import { createTrustedDeviceToken } from '@/lib/rsvp/security/trusted-device';
import { normalizeAppRole } from '@/lib/rsvp/auth/roles';

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
			throw new ApiError(401, 'unauthorized', 'Unauthorized.');
		}

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;

		const elevatedAccessToken = sanitizeToken(body.accessToken as string);
		const elevatedRefreshToken = sanitizeToken(body.refreshToken as string);

		if (!elevatedAccessToken) {
			throw new ApiError(400, 'bad_request', 'Access token is required');
		}

		const elevatedUser = await getSupabaseUserByAccessToken(elevatedAccessToken);
		if (!elevatedUser || elevatedUser.id !== currentSession.userId) {
			throw new ApiError(403, 'forbidden', 'Elevated token is invalid.');
		}

		const hasMfa = hasMfaEvidence({
			token: elevatedAccessToken,
			amr: elevatedUser.amr,
		});
		if (!hasMfa) {
			throw new ApiError(403, 'forbidden', 'The session does not contain MFA verification.');
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
			return errorResponse(new ApiError(400, 'bad_request', 'Invalid JSON.'));
		}
		return errorResponse(error);
	}
};
