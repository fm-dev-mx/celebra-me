import { randomInt } from 'node:crypto';

/**
 * Generates a URL-safe short ID using a Base62-like character set.
 * Default length 8 provides ~218 trillion combinations.
 */
export function generateShortId(length = 8): string {
	const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars[randomInt(0, chars.length)];
	}
	return result;
}
