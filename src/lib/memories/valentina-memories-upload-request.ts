import {
	VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS,
	VALENTINA_MEMORIES_SIGN_PATH,
	VALENTINA_MEMORIES_UPLOAD_PATH,
} from '@/data/valentina-memories-upload.contract';
import { VALENTINA_MEMORIES_UPLOAD_SIGNING_PRIVATE_KEY_ENV_NAME } from '@/data/valentina-memories-media.contract';
import { MEMORIES_UPLOAD_REQUEST_AUDIENCE } from '@/data/valentina-memories-private-request.contract';
import { createMemoriesPrivateRequestHeaders } from '@/lib/server/memories-private-request';
import { resolveMemoriesUploadSignerUrl } from '@/lib/server/memories-upload-target';

export interface ValentinaMemoriesUploadCapability {
	uploadUrl: string;
	requiredHeaders: Record<string, string>;
	expiresAt: string;
}

const REQUIRED_UPLOAD_HEADERS = new Set([
	'authorization',
	'content-type',
	'x-amz-checksum-sha256',
]);

function requireUploadUrl(value: unknown, signerUrl: URL): URL {
	if (typeof value !== 'string') throw new Error('Invalid upload signer response.');
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error('Invalid upload signer response.');
	}
	const allowsLocalHttp =
		signerUrl.protocol === 'http:' &&
		(signerUrl.hostname === 'localhost' || signerUrl.hostname === '127.0.0.1');
	if (
		(url.protocol !== 'https:' && !allowsLocalHttp) ||
		url.origin !== signerUrl.origin ||
		url.pathname !== VALENTINA_MEMORIES_UPLOAD_PATH ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		throw new Error('Invalid upload signer response.');
	}
	return url;
}

function requireUploadHeaders(value: unknown, mimeType: string): Record<string, string> {
	if (typeof value !== 'object' || value === null)
		throw new Error('Invalid upload signer response.');
	const headers = Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, string] => typeof entry[1] === 'string',
		),
	);
	const names = Object.keys(headers).map((name) => name.toLowerCase());
	if (
		names.length !== REQUIRED_UPLOAD_HEADERS.size ||
		names.some((name) => !REQUIRED_UPLOAD_HEADERS.has(name)) ||
		headers['Content-Type'] !== mimeType ||
		!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(headers.Authorization ?? '') ||
		!/^[A-Za-z0-9+/]{43}=$/.test(headers['x-amz-checksum-sha256'] ?? '')
	) {
		throw new Error('Invalid upload signer response.');
	}
	return headers;
}

function requireShortLivedExpiry(value: unknown): string {
	if (typeof value !== 'string') throw new Error('Invalid upload signer response.');
	const expiresAtMs = Date.parse(value);
	const now = Date.now();
	if (
		!Number.isFinite(expiresAtMs) ||
		expiresAtMs <= now ||
		expiresAtMs > now + (VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS + 30) * 1000
	) {
		throw new Error('Invalid upload signer response.');
	}
	return value;
}

export async function requestValentinaMemoryUploadCapability(input: {
	objectKey: string;
	sessionId: string;
	mimeType: string;
	sizeBytes: number;
	checksumSha256: string;
}): Promise<ValentinaMemoriesUploadCapability> {
	const signerUrl = resolveMemoriesUploadSignerUrl();
	if (!signerUrl) throw new Error('Memories upload signer is not configured.');
	const body = JSON.stringify(input);
	const response = await fetch(signerUrl, {
		method: 'POST',
		headers: createMemoriesPrivateRequestHeaders({
			audience: MEMORIES_UPLOAD_REQUEST_AUDIENCE,
			method: 'POST',
			path: VALENTINA_MEMORIES_SIGN_PATH,
			body,
			privateKeyEnvName: VALENTINA_MEMORIES_UPLOAD_SIGNING_PRIVATE_KEY_ENV_NAME,
		}),
		body,
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) throw new Error(`Memories upload signer failed (${response.status}).`);
	const payload: unknown = await response.json();
	if (typeof payload !== 'object' || payload === null)
		throw new Error('Invalid upload signer response.');
	const candidate = payload as Record<string, unknown>;
	const uploadUrl = requireUploadUrl(candidate.uploadUrl, signerUrl);
	const requiredHeaders = requireUploadHeaders(candidate.requiredHeaders, input.mimeType);
	const expiresAt = requireShortLivedExpiry(candidate.expiresAt);
	return { uploadUrl: uploadUrl.toString(), expiresAt, requiredHeaders };
}
