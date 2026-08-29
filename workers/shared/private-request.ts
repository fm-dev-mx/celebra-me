import {
	MEMORIES_PRIVATE_REQUEST_HEADERS,
	MEMORIES_PRIVATE_REQUEST_TTL_SECONDS,
	buildMemoriesPrivateRequestPayload,
} from '../../src/data/valentina-memories-private-request.contract';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function decodeBase64(value: string): Uint8Array {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
	const binary = atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function publicKeyBytes(pem: string): Uint8Array {
	const normalized = pem.trim().replace(/\\n/g, '\n');
	const base64 = normalized
		.replace('-----BEGIN PUBLIC KEY-----', '')
		.replace('-----END PUBLIC KEY-----', '')
		.replace(/\s+/g, '');
	return decodeBase64(base64);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

function toHex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join(
		'',
	);
}

export async function verifyMemoriesPrivateRequest(input: {
	request: Request;
	rawBody: string;
	expectedAudience: string;
	expectedPath: string;
	publicKeyPem: string;
	now?: Date;
}): Promise<boolean> {
	const audience = input.request.headers.get(MEMORIES_PRIVATE_REQUEST_HEADERS.audience) ?? '';
	const timestamp = input.request.headers.get(MEMORIES_PRIVATE_REQUEST_HEADERS.timestamp) ?? '';
	const requestId = input.request.headers.get(MEMORIES_PRIVATE_REQUEST_HEADERS.requestId) ?? '';
	const signature = input.request.headers.get(MEMORIES_PRIVATE_REQUEST_HEADERS.signature) ?? '';
	if (
		audience !== input.expectedAudience ||
		!/^[0-9]{1,12}$/.test(timestamp) ||
		!UUID_PATTERN.test(requestId) ||
		!signature ||
		!input.publicKeyPem.trim()
	) {
		return false;
	}
	const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
	if (Math.abs(nowSeconds - Number(timestamp)) > MEMORIES_PRIVATE_REQUEST_TTL_SECONDS)
		return false;

	try {
		const key = await crypto.subtle.importKey(
			'spki',
			toArrayBuffer(publicKeyBytes(input.publicKeyPem)),
			{ name: 'ECDSA', namedCurve: 'P-256' },
			false,
			['verify'],
		);
		const bodyHash = toHex(
			await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.rawBody)),
		);
		const payload = buildMemoriesPrivateRequestPayload({
			audience,
			timestamp,
			requestId,
			method: input.request.method,
			path: input.expectedPath,
			bodyHash,
		});
		return crypto.subtle.verify(
			{ name: 'ECDSA', hash: 'SHA-256' },
			key,
			toArrayBuffer(decodeBase64(signature)),
			new TextEncoder().encode(payload),
		);
	} catch {
		return false;
	}
}
