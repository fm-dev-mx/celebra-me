function isProduction(): boolean {
	return process.env.NODE_ENV === 'production';
}

const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60; // 1 hour
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const IDLE_TIMEOUT_SECONDS = 60 * 30; // 30 minutes
const MFA_TEMP_MAX_AGE_SECONDS = 60 * 5; // 5 minutes

export function buildSessionCookie(accessToken: string): string {
	const parts = [
		`sb-access-token=${encodeURIComponent(accessToken)}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		`Max-Age=${ACCESS_TOKEN_MAX_AGE_SECONDS}`,
	];
	if (isProduction()) parts.push('Secure');
	return parts.join('; ');
}

export function buildRefreshTokenCookie(refreshToken: string): string {
	const parts = [
		`sb-refresh-token=${encodeURIComponent(refreshToken)}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		`Max-Age=${REFRESH_TOKEN_MAX_AGE_SECONDS}`,
	];
	if (isProduction()) parts.push('Secure');
	return parts.join('; ');
}

export function buildMfaSessionCookie(accessToken: string): string {
	const parts = [
		`sb-mfa-session=${encodeURIComponent(accessToken)}`,
		'Path=/dashboard/mfa-setup',
		'SameSite=Strict',
		`Max-Age=${MFA_TEMP_MAX_AGE_SECONDS}`,
	];
	if (isProduction()) parts.push('Secure');
	return parts.join('; ');
}

export function buildMfaRefreshCookie(refreshToken: string): string {
	const parts = [
		`sb-mfa-refresh=${encodeURIComponent(refreshToken)}`,
		'Path=/dashboard/mfa-setup',
		'SameSite=Strict',
		`Max-Age=${MFA_TEMP_MAX_AGE_SECONDS}`,
	];
	if (isProduction()) parts.push('Secure');
	return parts.join('; ');
}

export function buildIdleActivityCookie(unixSeconds: number): string {
	const parts = [
		`sb-idle-seen=${encodeURIComponent(String(unixSeconds))}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		`Max-Age=${IDLE_TIMEOUT_SECONDS}`,
	];
	if (isProduction()) parts.push('Secure');
	return parts.join('; ');
}

export function clearSessionCookie(): string {
	const parts = ['sb-access-token=', 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
	if (isProduction()) parts.push('Secure');
	return parts.join('; ');
}

export function clearRefreshTokenCookie(): string {
	const parts = ['sb-refresh-token=', 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
	if (isProduction()) parts.push('Secure');
	return parts.join('; ');
}

export function clearMfaSessionCookie(): string {
	const parts = ['sb-mfa-session=', 'Path=/dashboard/mfa-setup', 'Max-Age=0', 'SameSite=Strict'];
	if (isProduction()) parts.push('Secure');
	return parts.join('; ');
}

export function clearMfaRefreshCookie(): string {
	const parts = ['sb-mfa-refresh=', 'Path=/dashboard/mfa-setup', 'Max-Age=0', 'SameSite=Strict'];
	if (isProduction()) parts.push('Secure');
	return parts.join('; ');
}

export function clearIdleActivityCookie(): string {
	const parts = ['sb-idle-seen=', 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
	if (isProduction()) parts.push('Secure');
	return parts.join('; ');
}
