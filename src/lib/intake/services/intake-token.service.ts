import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTE_LENGTH = 32;

/**
 * Generates a cryptographically secure random token.
 * Returns a URL-safe base64-encoded string (~43 characters).
 */
export function generateIntakeToken(): string {
	return randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');
}

/**
 * Hashes a token using SHA-256 for secure storage.
 * The raw token should never be stored; only the hash is persisted.
 */
export function hashIntakeToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/**
 * Validates that a token string has the expected format.
 * Base64url tokens are 43 characters for 32 bytes.
 */
export function isValidTokenFormat(token: string): boolean {
	if (typeof token !== 'string') return false;
	if (token.length < 40 || token.length > 50) return false;
	return /^[A-Za-z0-9_-]+$/.test(token);
}
