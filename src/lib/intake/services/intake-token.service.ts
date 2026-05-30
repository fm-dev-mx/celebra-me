import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTE_LENGTH = 32;
const TOKEN_CIPHER = 'aes-256-gcm';
const TOKEN_CIPHER_VERSION = 'v1';
const TOKEN_IV_BYTE_LENGTH = 12;
const TOKEN_AUTH_TAG_BYTE_LENGTH = 16;
const INVALID_ENCRYPTION_KEY_MESSAGE =
	'INTAKE_TOKEN_ENCRYPTION_KEY must be a 32-byte hex or base64url value.';

function parseEncryptionKey(rawKey: string): Buffer {
	const trimmed = rawKey.trim();
	const key = /^[a-fA-F0-9]{64}$/.test(trimmed)
		? Buffer.from(trimmed, 'hex')
		: Buffer.from(trimmed, 'base64url');

	if (key.length !== TOKEN_BYTE_LENGTH) {
		throw new Error(INVALID_ENCRYPTION_KEY_MESSAGE);
	}

	return key;
}

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

export function encryptIntakeToken(token: string, rawKey: string): string {
	const key = parseEncryptionKey(rawKey);
	const iv = randomBytes(TOKEN_IV_BYTE_LENGTH);
	const cipher = createCipheriv(TOKEN_CIPHER, key, iv, {
		authTagLength: TOKEN_AUTH_TAG_BYTE_LENGTH,
	});
	const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();

	return [
		TOKEN_CIPHER_VERSION,
		iv.toString('base64url'),
		authTag.toString('base64url'),
		ciphertext.toString('base64url'),
	].join('.');
}

export function decryptIntakeToken(payload: string, rawKey: string): string | null {
	try {
		const key = parseEncryptionKey(rawKey);
		const [version, ivRaw, authTagRaw, ciphertextRaw] = payload.split('.');
		if (version !== TOKEN_CIPHER_VERSION || !ivRaw || !authTagRaw || !ciphertextRaw)
			return null;

		const iv = Buffer.from(ivRaw, 'base64url');
		const authTag = Buffer.from(authTagRaw, 'base64url');
		const ciphertext = Buffer.from(ciphertextRaw, 'base64url');
		if (iv.length !== TOKEN_IV_BYTE_LENGTH || authTag.length !== TOKEN_AUTH_TAG_BYTE_LENGTH) {
			return null;
		}

		const decipher = createDecipheriv(TOKEN_CIPHER, key, iv, {
			authTagLength: TOKEN_AUTH_TAG_BYTE_LENGTH,
		});
		decipher.setAuthTag(authTag);
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
	} catch {
		return null;
	}
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
