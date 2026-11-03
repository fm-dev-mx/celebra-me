/**
 * Shared hashing helpers for repository scripts (Node only).
 */

import { createHash } from 'node:crypto';

/** SHA-256 of `input` as lowercase hex. Strings are hashed as UTF-8. */
export function sha256Hex(input: string | Uint8Array): string {
	return createHash('sha256').update(input).digest('hex');
}
