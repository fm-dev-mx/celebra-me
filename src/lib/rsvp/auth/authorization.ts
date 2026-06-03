import { ApiError } from '@/lib/rsvp/core/errors';
import { sanitize, parseCookieHeader } from '@/lib/rsvp/core/utils';
import {
	requireSessionContext,
	type SessionContext,
	resolveAccessTokenFromRequest,
} from '@/lib/rsvp/auth/auth';
import { hasMfaEvidence } from '@/lib/rsvp/auth/auth-mfa-evidence';
import { verifyTrustedDeviceToken } from '@/lib/rsvp/security/trusted-device';
import { getEnv } from '@/lib/server/env';
import { isDevMfaBypassEnabled } from '@/lib/server/dev-mfa-bypass';

function hasEffectiveAdminStrongAuth(session: SessionContext): boolean {
	return session.isSuperAdmin && isDevMfaBypassEnabled();
}

function getTrustedDeviceCookie(request: Request): string {
	const cookieHeader = request.headers.get('cookie');
	const cookies = parseCookieHeader(cookieHeader);
	return sanitize(cookies['sb-trust-device'], 4096);
}

function isFreshMfaRequired(): boolean {
	const value = sanitize(getEnv('REQUIRE_FRESH_MFA_FOR_ADMIN'), 10).toLowerCase();
	return value === 'true' || value === '1';
}

export async function requireAdminSession(request: Request): Promise<SessionContext> {
	const session = await requireSessionContext(request);
	if (!session.isSuperAdmin) {
		throw new ApiError(403, 'forbidden', 'Not authorized for global administration.');
	}
	return session;
}

export async function requireAdminStrongSession(request: Request): Promise<SessionContext> {
	const session = await requireSessionContext(request);

	if (!session.isSuperAdmin) {
		throw new ApiError(403, 'forbidden', 'Not authorized for global administration.');
	}

	const accessToken = resolveAccessTokenFromRequest(request);
	const hasMfa = hasMfaEvidence({
		token: accessToken,
		amr: session.amr,
	});

	if (hasMfa) {
		return session;
	}

	if (hasEffectiveAdminStrongAuth(session)) {
		return session;
	}

	const requireFreshMfa = isFreshMfaRequired();
	if (requireFreshMfa) {
		throw new ApiError(
			403,
			'forbidden',
			'Second-factor authentication (MFA) is required to access this resource.',
		);
	}

	const trustCookie = getTrustedDeviceCookie(request);
	if (!trustCookie) {
		throw new ApiError(
			403,
			'forbidden',
			'Strong authentication is required (MFA or a trusted device).',
		);
	}

	const userAgent = request.headers.get('user-agent') || '';
	const trustedDevice = verifyTrustedDeviceToken({
		token: trustCookie,
		userId: session.userId,
		userAgent,
		role: session.role,
	});

	if (!trustedDevice) {
		throw new ApiError(
			403,
			'forbidden',
			'Trusted device token is invalid or expired. Please authenticate again.',
		);
	}

	return session;
}

// ---------------------------------------------------------------------------
// Locals-based auth helpers
// These consume the already-resolved session from Astro.locals.session (set by
// middleware) instead of re-deriving from request cookies. This avoids the
// cookie-staleness race condition between middleware and downstream consumers.
// ---------------------------------------------------------------------------

interface LocalsWithSession {
	session?: SessionContext;
}

interface LocalsWithAdminAuth extends LocalsWithSession {
	hasAdminStrongAuth?: boolean;
}

export function requireDashboardSessionFromLocals(locals: LocalsWithSession): SessionContext {
	if (!locals.session) {
		throw new ApiError(
			401,
			'unauthorized',
			'No tienes autorización para realizar esta acción.',
		);
	}
	return locals.session;
}

export function requireAdminDashboardSessionFromLocals(locals: LocalsWithSession): SessionContext {
	const session = requireDashboardSessionFromLocals(locals);
	if (!session.isSuperAdmin) {
		throw new ApiError(403, 'forbidden', 'Not authorized for global administration.');
	}
	return session;
}

export function requireAdminStrongDashboardSessionFromLocals(
	locals: LocalsWithAdminAuth,
): SessionContext {
	const session = requireAdminDashboardSessionFromLocals(locals);
	if (locals.hasAdminStrongAuth || hasEffectiveAdminStrongAuth(session)) {
		return session;
	}
	throw new ApiError(
		403,
		'forbidden',
		'Strong authentication (MFA or trusted device) is required to access this resource.',
	);
}
