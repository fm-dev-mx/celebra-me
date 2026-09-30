/**
 * Single-use upload capability. Claims are sealed with AES-GCM under a key
 * derived from the Worker's capability secret, so the browser carries an opaque
 * token: it can neither read the object key nor the session id, nor forge one.
 */

import { MEMORIES_PRESIGN_TTL_SECONDS } from '../../../src/lib/memories/contract/limits';
import { MEMORIES_SHA256_HEX_PATTERN } from '../../../src/lib/memories/contract/catalog';
import { decodeBase64, encodeBase64Url, toArrayBuffer } from '../../shared/encoding';

export type UploadCapabilityClaims = {
	objectKey: string;
	sessionId: string;
	mimeType: string;
	sizeBytes: number;
	checksumSha256: string;
	expiresAt: number;
	nonce: string;
};

const KEY_INFO = 'memories-upload-capability-v2';
const IV_BYTES = 12;
const MAX_TOKEN_LENGTH = 4096;
const MIN_NONCE_LENGTH = 16;

async function deriveKey(secret: string): Promise<CryptoKey> {
	const baseKey = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		'HKDF',
		false,
		['deriveKey'],
	);
	return crypto.subtle.deriveKey(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: new Uint8Array(0),
			info: new TextEncoder().encode(KEY_INFO),
		},
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt'],
	);
}

function serializeClaims(claims: UploadCapabilityClaims): Uint8Array {
	return new TextEncoder().encode(
		JSON.stringify({
			k: claims.objectKey,
			s: claims.sessionId,
			m: claims.mimeType,
			z: claims.sizeBytes,
			c: claims.checksumSha256,
			e: claims.expiresAt,
			n: claims.nonce,
		}),
	);
}

function parseClaims(bytes: Uint8Array, now: Date): UploadCapabilityClaims | null {
	const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
	if (Object.keys(claims).sort().join(',') !== 'c,e,k,m,n,s,z') return null;
	if (
		typeof claims.k !== 'string' ||
		typeof claims.s !== 'string' ||
		typeof claims.m !== 'string' ||
		typeof claims.z !== 'number' ||
		!Number.isSafeInteger(claims.z) ||
		typeof claims.c !== 'string' ||
		!MEMORIES_SHA256_HEX_PATTERN.test(claims.c) ||
		typeof claims.e !== 'number' ||
		!Number.isSafeInteger(claims.e) ||
		typeof claims.n !== 'string' ||
		claims.n.length < MIN_NONCE_LENGTH ||
		claims.e * 1000 <= now.getTime()
	)
		return null;
	return {
		objectKey: claims.k,
		sessionId: claims.s,
		mimeType: claims.m,
		sizeBytes: claims.z,
		checksumSha256: claims.c.toLowerCase(),
		expiresAt: claims.e,
		nonce: claims.n,
	};
}

export async function createUploadCapability(
	claims: Omit<UploadCapabilityClaims, 'expiresAt' | 'nonce'> & {
		expiresAt?: number;
		nonce?: string;
	},
	secret: string,
	now = new Date(),
): Promise<{ token: string; expiresAt: string; claims: UploadCapabilityClaims }> {
	const fullClaims: UploadCapabilityClaims = {
		...claims,
		expiresAt:
			claims.expiresAt ?? Math.floor(now.getTime() / 1000) + MEMORIES_PRESIGN_TTL_SECONDS,
		nonce: claims.nonce ?? crypto.randomUUID(),
	};
	const key = await deriveKey(secret);
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const sealed = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv },
			key,
			toArrayBuffer(serializeClaims(fullClaims)),
		),
	);
	const token = new Uint8Array(iv.byteLength + sealed.byteLength);
	token.set(iv, 0);
	token.set(sealed, iv.byteLength);
	return {
		token: encodeBase64Url(token),
		expiresAt: new Date(fullClaims.expiresAt * 1000).toISOString(),
		claims: fullClaims,
	};
}

export async function verifyUploadCapability(
	token: string,
	secret: string,
	now = new Date(),
): Promise<UploadCapabilityClaims | null> {
	if (!token || token.length > MAX_TOKEN_LENGTH || !secret) return null;
	try {
		const bytes = decodeBase64(token);
		if (bytes.byteLength <= IV_BYTES) return null;
		const key = await deriveKey(secret);
		const opened = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) },
			key,
			toArrayBuffer(bytes.slice(IV_BYTES)),
		);
		return parseClaims(new Uint8Array(opened), now);
	} catch {
		return null;
	}
}
