import { VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS } from '../../../src/data/valentina-memories-upload.contract';

export type UploadCapabilityClaims = {
	objectKey: string;
	sessionId: string;
	mimeType: string;
	sizeBytes: number;
	checksumSha256: string;
	expiresAt: number;
	nonce: string;
};

function encodeBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function hexToBytes(value: string): Uint8Array {
	const bytes = new Uint8Array(value.length / 2);
	for (let index = 0; index < bytes.length; index += 1) {
		bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
	}
	return bytes;
}

export function sha256HexToBase64(value: string): string {
	const bytes = hexToBytes(value);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function decodeBase64Url(value: string): Uint8Array {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
	const binary = atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

function serializeClaims(claims: UploadCapabilityClaims): string {
	return encodeBase64Url(
		new TextEncoder().encode(
			JSON.stringify({
				k: claims.objectKey,
				s: claims.sessionId,
				m: claims.mimeType,
				z: claims.sizeBytes,
				c: claims.checksumSha256,
				e: claims.expiresAt,
				n: claims.nonce,
			}),
		),
	);
}

async function sign(value: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	return encodeBase64Url(
		new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))),
	);
}

function decodeCapabilityClaims(
	encodedClaims: string,
	now: Date,
): UploadCapabilityClaims | null {
	const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedClaims))) as Record<
		string,
		unknown
	>;
	if (Object.keys(claims).sort().join(',') !== 'c,e,k,m,n,s,z') return null;
	if (
		typeof claims.k !== 'string' ||
		typeof claims.s !== 'string' ||
		typeof claims.m !== 'string' ||
		typeof claims.z !== 'number' ||
		!Number.isSafeInteger(claims.z) ||
		typeof claims.c !== 'string' ||
		!/^[0-9a-f]{64}$/i.test(claims.c) ||
		typeof claims.e !== 'number' ||
		!Number.isSafeInteger(claims.e) ||
		typeof claims.n !== 'string' ||
		claims.n.length < 16 ||
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
			claims.expiresAt ?? Math.floor(now.getTime() / 1000) + VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS,
		nonce: claims.nonce ?? crypto.randomUUID(),
	};
	const encodedClaims = serializeClaims(fullClaims);
	return {
		token: `${encodedClaims}.${await sign(encodedClaims, secret)}`,
		expiresAt: new Date(fullClaims.expiresAt * 1000).toISOString(),
		claims: fullClaims,
	};
}

export async function verifyUploadCapability(
	token: string,
	secret: string,
	now = new Date(),
): Promise<UploadCapabilityClaims | null> {
	if (!token || token.length > 4096 || !secret) return null;
	const parts = token.split('.');
	if (parts.length !== 2) return null;
	try {
		const encodedClaims = parts[0];
		const signature = parts[1];
		const claims = decodeCapabilityClaims(encodedClaims, now);
		if (!claims) return null;
		const key = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['verify'],
		);
		const valid = await crypto.subtle.verify(
			'HMAC',
			key,
			toArrayBuffer(decodeBase64Url(signature)),
			new TextEncoder().encode(encodedClaims),
		);
		if (!valid) return null;
		return claims;
	} catch {
		return null;
	}
}

export function sha256HexToArrayBuffer(value: string): ArrayBuffer {
	return toArrayBuffer(hexToBytes(value));
}
