import { randomBytes } from 'node:crypto';

/**
 * Generates a URL-safe short ID using a Base62-like character set.
 * Default length 8 provides ~218 trillion combinations.
 */
export function generateShortId(length = 8): string {
	const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
	const bytes = randomBytes(length);
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars[bytes[i] % chars.length];
	}
	return result;
}
