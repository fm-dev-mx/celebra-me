import { ApiError } from '@/lib/rsvp/core/errors';
import {
	requireSessionContext,
	type SessionContext,
	resolveAccessTokenFromRequest,
} from '@/lib/rsvp/auth/auth';
import { hasMfaEvidence } from '@/lib/rsvp/auth/auth-mfa-evidence';
import { verifyTrustedDeviceToken } from '@/lib/rsvp/security/trusted-device';
import { getEnv } from '@/lib/server/env';

function sanitize(value: unknown, maxLen = 4096): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
	if (!cookieHeader) return {};
	return cookieHeader
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean)
		.reduce(
			(acc, part) => {
				const separator = part.indexOf('=');
				if (separator <= 0) return acc;
				const key = decodeURIComponent(part.slice(0, separator).trim());
				const value = decodeURIComponent(part.slice(separator + 1).trim());
				acc[key] = value;
				return acc;
			},
			{} as Record<string, string>,
		);
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

export async function requireAuthenticatedSession(request: Request): Promise<SessionContext> {
	return requireSessionContext(request);
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

export async function requireHostOrAdminSession(request: Request): Promise<SessionContext> {
	return requireSessionContext(request);
}
