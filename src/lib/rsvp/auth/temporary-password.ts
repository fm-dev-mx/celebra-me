export const TEMP_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;
export const TEMP_PASSWORD_EXPIRES_KEY = 'temp_password_expires_at';

export function buildTemporaryPasswordExpiry(nowMs = Date.now()): string {
	return new Date(nowMs + TEMP_PASSWORD_TTL_MS).toISOString();
}

/**
 * A temporary password is expired when the account still has to change it and its recorded
 * expiry has passed. Accounts that must change the password but carry no expiry (issued before
 * the expiry existed) are not expired here.
 */
export function isTemporaryPasswordExpired(
	appMetadata: Record<string, unknown> | undefined | null,
	nowMs = Date.now(),
): boolean {
	if (!appMetadata || appMetadata.must_change_password !== true) return false;
	const raw = appMetadata[TEMP_PASSWORD_EXPIRES_KEY];
	if (typeof raw !== 'string') return false;
	const expiresAt = Date.parse(raw);
	return Number.isFinite(expiresAt) && expiresAt <= nowMs;
}
