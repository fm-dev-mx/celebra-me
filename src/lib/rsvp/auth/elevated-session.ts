import {
	buildIdleActivityCookie,
	buildRefreshTokenCookie,
	buildSessionCookie,
	buildTrustedDeviceCookie,
	clearMfaRefreshCookie,
	clearMfaSessionCookie,
} from '@/lib/rsvp/auth/cookies';
import { normalizeAppRole } from '@/lib/rsvp/auth/roles';
import { createTrustedDevice } from '@/lib/rsvp/security/trusted-device';
import { safeErr } from '@/lib/server/safe-error';

/**
 * Builds the cookies of an MFA-verified session: new httpOnly access/refresh tokens, a fresh idle
 * marker and, for super admins, a stored trusted device. Legacy readable MFA cookies are cleared.
 */
export async function buildElevatedSessionHeaders(input: {
	accessToken: string;
	refreshToken?: string;
	userId: string;
	role: unknown;
	userAgent: string;
}): Promise<Headers> {
	const headers = new Headers({ 'Content-Type': 'application/json' });
	headers.append('Set-Cookie', buildSessionCookie(input.accessToken));
	headers.append('Set-Cookie', buildIdleActivityCookie(Math.floor(Date.now() / 1000)));
	if (input.refreshToken) {
		headers.append('Set-Cookie', buildRefreshTokenCookie(input.refreshToken));
	}

	const role = normalizeAppRole(input.role);
	if (role === 'super_admin') {
		try {
			const trusted = await createTrustedDevice({
				userId: input.userId,
				role,
				userAgent: input.userAgent,
			});
			headers.append(
				'Set-Cookie',
				buildTrustedDeviceCookie(trusted.token, trusted.maxAgeSeconds),
			);
		} catch (error) {
			// The session is already MFA-verified; without a stored device the next login
			// simply asks for the second factor again.
			console.error('[mfa] Trusted device not stored:', safeErr(error));
		}
	}

	headers.append('Set-Cookie', clearMfaSessionCookie());
	headers.append('Set-Cookie', clearMfaRefreshCookie());
	return headers;
}
