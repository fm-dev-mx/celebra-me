import { VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS } from '../../../src/data/valentina-memories-upload.contract';

const encoder = new TextEncoder();

export type PresignR2PutInput = {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	objectKey: string;
	contentType: string;
	checksumSha256Hex?: string;
	now: Date;
};

export function sha256HexToBase64(value: string): string {
	const bytes = new Uint8Array(value.length / 2);
	for (let index = 0; index < bytes.length; index += 1) {
		bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
	}
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function toHex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
	return toHex(digest);
}

async function hmac(key: BufferSource, value: string): Promise<ArrayBuffer> {
	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		key,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value));
}

function encodeRfc3986(value: string): string {
	return encodeURIComponent(value).replace(
		/[!'()*]/g,
		(char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

function encodePath(path: string): string {
	return path
		.split('/')
		.map((segment) => encodeRfc3986(segment))
		.join('/');
}

function formatAmzDate(now: Date): { amzDate: string; dateStamp: string } {
	const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
	return {
		amzDate: iso,
		dateStamp: iso.slice(0, 8),
	};
}

export async function createPresignedR2PutUrl(input: PresignR2PutInput): Promise<string> {
	const { amzDate, dateStamp } = formatAmzDate(input.now);
	const host = `${input.accountId}.r2.cloudflarestorage.com`;
	const canonicalUri = encodePath(`/${input.bucket}/${input.objectKey}`);
	const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
	const credential = `${input.accessKeyId}/${credentialScope}`;
	const checksumSha256 = input.checksumSha256Hex?.toLowerCase() ?? '';
	if (!/^[0-9a-f]{64}$/.test(checksumSha256)) throw new Error('Invalid SHA-256 checksum.');
	const checksumBase64 = sha256HexToBase64(checksumSha256);
	const signedHeaders = 'content-type;host;if-none-match;x-amz-checksum-sha256';
	const payloadHash = 'UNSIGNED-PAYLOAD';

	const query: Record<string, string> = {
		'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
		'X-Amz-Content-Sha256': payloadHash,
		'X-Amz-Credential': credential,
		'X-Amz-Date': amzDate,
		'X-Amz-Expires': String(VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS),
		'X-Amz-SignedHeaders': signedHeaders,
	};

	const canonicalQueryString = Object.keys(query)
		.sort()
		.map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(query[key])}`)
		.join('&');

	const canonicalHeaders = [
		`content-type:${input.contentType}`,
		`host:${host}`,
		'if-none-match:*',
		`x-amz-checksum-sha256:${checksumBase64}`,
		'',
	].join('\n');
	const canonicalRequest = [
		'PUT',
		canonicalUri,
		canonicalQueryString,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	].join('\n');

	const stringToSign = [
		'AWS4-HMAC-SHA256',
		amzDate,
		credentialScope,
		await sha256Hex(canonicalRequest),
	].join('\n');

	const dateKey = await hmac(encoder.encode(`AWS4${input.secretAccessKey}`), dateStamp);
	const regionKey = await hmac(dateKey, 'auto');
	const serviceKey = await hmac(regionKey, 's3');
	const signingKey = await hmac(serviceKey, 'aws4_request');
	const signature = toHex(await hmac(signingKey, stringToSign));

	return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}
