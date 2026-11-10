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
import { requireSessionContext } from '@/lib/rsvp/auth/auth';
import { revokeAuthSessions } from '@/lib/rsvp/auth/auth-api';
import { revokeTrustedDevices } from '@/lib/rsvp/security/trusted-device';
import { ApiError } from '@/lib/rsvp/core/errors';
import { safeErr } from '@/lib/server/safe-error';

/**
 * Closes the session on every device: revokes all Supabase sessions of the account and marks
 * every trusted device revoked, so the next login anywhere asks for the second factor again.
 */
export const POST: APIRoute = async ({ request, url }) => {
	try {
		assertSameOrigin(request, url.origin);
		const session = await requireSessionContext(request);

		try {
			await revokeTrustedDevices(session.userId);
		} catch (error) {
			console.error('[logout-all] Trusted device revocation failed:', safeErr(error));
			throw new ApiError(
				503,
				'service_unavailable',
				'No se pudieron revocar los dispositivos de confianza. Inténtelo de nuevo.',
			);
		}
		try {
			await revokeAuthSessions({ accessToken: session.accessToken, scope: 'global' });
		} catch (error) {
			console.error('[logout-all] Session revocation failed:', safeErr(error));
			throw new ApiError(
				503,
				'service_unavailable',
				'No se pudo cerrar la sesión en todos los dispositivos. Inténtelo de nuevo.',
			);
		}

		const headers = new Headers({ 'Content-Type': 'application/json' });
		headers.append('Set-Cookie', clearSessionCookie());
		headers.append('Set-Cookie', clearRefreshTokenCookie());
		headers.append('Set-Cookie', clearMfaSessionCookie());
		headers.append('Set-Cookie', clearMfaRefreshCookie());
		headers.append('Set-Cookie', clearIdleActivityCookie());
		headers.append('Set-Cookie', clearTrustedDeviceCookie());

		return new Response(
			JSON.stringify({ ok: true, message: 'Sesión cerrada en todos los dispositivos.' }),
			{
				status: 200,
				headers,
			},
		);
	} catch (error) {
		return errorResponse(error);
	}
};
