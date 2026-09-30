import {
	MEMORIES_PRIVATE_REQUEST_HEADERS,
	MEMORIES_PRIVATE_REQUEST_TTL_SECONDS,
	buildMemoriesPrivateRequestPayload,
} from '../../src/lib/memories/contract/private-request';
import { MEMORIES_UUID_PATTERN } from '../../src/lib/memories/contract/catalog';
import { bytesToHex, decodeBase64, toArrayBuffer } from './encoding';

function publicKeyBytes(pem: string): Uint8Array {
	const normalized = pem.trim().replace(/\\n/g, '\n');
	const base64 = normalized
		.replace('-----BEGIN PUBLIC KEY-----', '')
		.replace('-----END PUBLIC KEY-----', '')
		.replace(/\s+/g, '');
	return decodeBase64(base64);
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
		!MEMORIES_UUID_PATTERN.test(requestId) ||
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
		const bodyHash = bytesToHex(
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

export function privateRequestId(request: Request): string {
	return request.headers.get(MEMORIES_PRIVATE_REQUEST_HEADERS.requestId) ?? '';
}
