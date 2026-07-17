import { createHash } from 'node:crypto';
import { BUCKET } from './types';

export function redactUrl(input: string, replacement?: string): string {
	return input.replace(/https?:\/\/[^\s"')]+/g, replacement ?? '<redacted-url>');
}

export function redactSecrets(input: string): string {
	let result = redactUrl(input);
	result = result.replace(
		/SUPABASE_SERVICE_ROLE_KEY[=:]["']?(eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+|sbp[\w-]+)["']?/gi,
		'SUPABASE_SERVICE_ROLE_KEY=<redacted>',
	);
	return result;
}

export function deterministicStoragePath(invitationId: string, assetKey: string): string {
	return `invitations/${invitationId}/optimized/${assetKey}.webp`;
}

/** Compute SHA-256 digest of a Uint8Array. */
export function hashBytes(bytes: Uint8Array): string {
	return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

/**
 * Fetch a stored image from Supabase Storage and return its SHA-256 hash.
 * Used to verify definitive identity beyond fileSize/width/height metadata.
 */
export async function fetchStoredImageHash(
	supabaseUrl: string,
	serviceRoleKey: string,
	storagePath: string,
): Promise<string | null> {
	try {
		const url = `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`;
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: `${serviceRoleKey}` },
		});
		if (!res.ok) return null;
		return hashBytes(new Uint8Array(await res.arrayBuffer()));
	} catch {
		return null;
	}
}
