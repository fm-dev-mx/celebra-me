import { isLocalProcess } from '@/lib/server/deploy-identity';

const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60; // 1 hour
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const IDLE_TIMEOUT_SECONDS = 60 * 30; // 30 minutes
const TRUST_DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Cookies carry `Secure` everywhere except a positively local process served over plain
 * http. Hosted and ambiguous runtimes always get it: the hosting platform may inject any
 * NODE_ENV at runtime, so NODE_ENV never decides transport security.
 */
function serializeCookie(parts: string[]): string {
	if (!isLocalProcess()) parts.push('Secure');
	return parts.join('; ');
}

export function buildSessionCookie(accessToken: string): string {
	return serializeCookie([
		`sb-access-token=${encodeURIComponent(accessToken)}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		`Max-Age=${ACCESS_TOKEN_MAX_AGE_SECONDS}`,
	]);
}

export function buildRefreshTokenCookie(refreshToken: string): string {
	return serializeCookie([
		`sb-refresh-token=${encodeURIComponent(refreshToken)}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		`Max-Age=${REFRESH_TOKEN_MAX_AGE_SECONDS}`,
	]);
}

export function buildIdleActivityCookie(unixSeconds: number): string {
	return serializeCookie([
		`sb-idle-seen=${encodeURIComponent(String(unixSeconds))}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		`Max-Age=${IDLE_TIMEOUT_SECONDS}`,
	]);
}

export function buildTrustedDeviceCookie(
	token: string,
	maxAge = TRUST_DEVICE_MAX_AGE_SECONDS,
): string {
	return serializeCookie([
		`sb-trust-device=${encodeURIComponent(token)}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		`Max-Age=${Math.max(60, Math.trunc(maxAge))}`,
	]);
}

export function clearSessionCookie(): string {
	return serializeCookie(['sb-access-token=', 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax']);
}

export function clearRefreshTokenCookie(): string {
	return serializeCookie([
		'sb-refresh-token=',
		'Path=/',
		'Max-Age=0',
		'HttpOnly',
		'SameSite=Lax',
	]);
}

export function clearMfaSessionCookie(): string {
	return serializeCookie([
		'sb-mfa-session=',
		'Path=/dashboard/mfa-setup',
		'Max-Age=0',
		'SameSite=Strict',
	]);
}

export function clearMfaRefreshCookie(): string {
	return serializeCookie([
		'sb-mfa-refresh=',
		'Path=/dashboard/mfa-setup',
		'Max-Age=0',
		'SameSite=Strict',
	]);
}

export function clearIdleActivityCookie(): string {
	return serializeCookie(['sb-idle-seen=', 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax']);
}

export function clearTrustedDeviceCookie(): string {
	return serializeCookie(['sb-trust-device=', 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax']);
}
