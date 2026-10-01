/**
 * The only module that talks to the Cloudflare Workers. Every request is signed
 * with the app's private key; the browser never reaches the Workers except for
 * the single PUT capability returned by `requestMemoriesUploadCapability`.
 */

import { MEMORIES_PRESIGN_TTL_SECONDS } from '@/lib/memories/contract/limits';
import {
	MEMORIES_PRIVATE_REQUEST_TTL_SECONDS,
	MEMORIES_RETRIEVAL_PATH,
	MEMORIES_RETRIEVAL_REQUEST_AUDIENCE,
	MEMORIES_SIGN_PATH,
	MEMORIES_UPLOAD_PATH,
	MEMORIES_UPLOAD_REQUEST_AUDIENCE,
} from '@/lib/memories/contract/private-request';
import { MEMORIES_ENV } from './config';
import { createMemoriesPrivateRequestHeaders, resolveMemoriesWorkerUrl } from './private-request';

export interface MemoriesUploadCapability {
	uploadUrl: string;
	requiredHeaders: Record<string, string>;
	expiresAt: string;
}

export type MemoriesRetrievalMode = 'inline' | 'attachment' | 'inspect' | 'delete';

export interface MemoriesInspectionResult {
	exists: boolean;
	sizeBytes: number;
	checksumSha256: string | null;
	signatureValid: boolean;
	durationSeconds: number | null;
}

/**
 * `missing` is reported only when the Worker answered that the object is absent;
 * any transport, configuration or routing failure is `unavailable`.
 */
export type MemoriesInspectionOutcome =
	| { kind: 'found'; inspection: MemoriesInspectionResult }
	| { kind: 'missing' }
	| { kind: 'unavailable' };

const REQUIRED_UPLOAD_HEADERS = new Set(['authorization', 'content-type', 'x-amz-checksum-sha256']);
const CAPABILITY_TOKEN_PATTERN = /^Bearer [A-Za-z0-9_-]{16,4096}$/;
const BASE64_SHA256_PATTERN = /^[A-Za-z0-9+/]{43}=$/;

function invalidSignerResponse(): Error {
	return new Error('Invalid upload signer response.');
}

function requireUploadUrl(value: unknown, signerUrl: URL): URL {
	if (typeof value !== 'string') throw invalidSignerResponse();
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw invalidSignerResponse();
	}
	const allowsLocalHttp =
		signerUrl.protocol === 'http:' &&
		(signerUrl.hostname === 'localhost' || signerUrl.hostname === '127.0.0.1');
	if (
		(url.protocol !== 'https:' && !allowsLocalHttp) ||
		url.origin !== signerUrl.origin ||
		url.pathname !== MEMORIES_UPLOAD_PATH ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		throw invalidSignerResponse();
	}
	return url;
}

function requireUploadHeaders(value: unknown, mimeType: string): Record<string, string> {
	if (typeof value !== 'object' || value === null) throw invalidSignerResponse();
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
		!CAPABILITY_TOKEN_PATTERN.test(headers.Authorization ?? '') ||
		!BASE64_SHA256_PATTERN.test(headers['x-amz-checksum-sha256'] ?? '')
	) {
		throw invalidSignerResponse();
	}
	return headers;
}

function requireShortLivedExpiry(value: unknown): string {
	if (typeof value !== 'string') throw invalidSignerResponse();
	const expiresAtMs = Date.parse(value);
	const now = Date.now();
	if (
		!Number.isFinite(expiresAtMs) ||
		expiresAtMs <= now ||
		expiresAtMs > now + (MEMORIES_PRESIGN_TTL_SECONDS + 30) * 1000
	) {
		throw invalidSignerResponse();
	}
	return value;
}

export async function requestMemoriesUploadCapability(input: {
	objectKey: string;
	sessionId: string;
	mimeType: string;
	sizeBytes: number;
	checksumSha256: string;
}): Promise<MemoriesUploadCapability> {
	const signerUrl = resolveMemoriesWorkerUrl(MEMORIES_ENV.uploadOrigin, MEMORIES_SIGN_PATH);
	if (!signerUrl) throw new Error('Memories upload signer is not configured.');
	const body = JSON.stringify(input);
	const response = await fetch(signerUrl, {
		method: 'POST',
		headers: createMemoriesPrivateRequestHeaders({
			audience: MEMORIES_UPLOAD_REQUEST_AUDIENCE,
			method: 'POST',
			path: MEMORIES_SIGN_PATH,
			body,
			privateKeyEnvName: MEMORIES_ENV.uploadSigningPrivateKey,
		}),
		body,
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) throw new Error(`Memories upload signer failed (${response.status}).`);
	const payload: unknown = await response.json();
	if (typeof payload !== 'object' || payload === null) throw invalidSignerResponse();
	const candidate = payload as Record<string, unknown>;
	return {
		uploadUrl: requireUploadUrl(candidate.uploadUrl, signerUrl).toString(),
		requiredHeaders: requireUploadHeaders(candidate.requiredHeaders, input.mimeType),
		expiresAt: requireShortLivedExpiry(candidate.expiresAt),
	};
}

function parseRange(value: string | null | undefined): {
	rangeStart: number | null;
	rangeEnd: number | null;
} {
	if (!value) return { rangeStart: null, rangeEnd: null };
	const match = /^bytes=(\d+)-(\d*)$/.exec(value.trim());
	if (!match) return { rangeStart: null, rangeEnd: null };
	const rangeStart = Number(match[1]);
	const rangeEnd = match[2] ? Number(match[2]) : null;
	if (
		!Number.isSafeInteger(rangeStart) ||
		rangeStart < 0 ||
		(rangeEnd !== null && (!Number.isSafeInteger(rangeEnd) || rangeEnd < rangeStart))
	) {
		return { rangeStart: null, rangeEnd: null };
	}
	return { rangeStart, rangeEnd };
}

export async function retrieveMemoriesObject(input: {
	objectKey: string;
	mimeType: string;
	mode: MemoriesRetrievalMode;
	downloadName?: string;
	range?: string | null;
}): Promise<Response> {
	const retrievalUrl = resolveMemoriesWorkerUrl(
		MEMORIES_ENV.retrievalOrigin,
		MEMORIES_RETRIEVAL_PATH,
	);
	if (!retrievalUrl) return new Response(null, { status: 503 });
	const requestBody: Record<string, unknown> = {
		objectKey: input.objectKey,
		mimeType: input.mimeType,
		mode: input.mode,
	};
	if (input.mode === 'inline' || input.mode === 'attachment') {
		requestBody.downloadName = input.downloadName ?? '';
		Object.assign(requestBody, parseRange(input.range));
	}
	const body = JSON.stringify(requestBody);
	return fetch(retrievalUrl, {
		method: 'POST',
		headers: createMemoriesPrivateRequestHeaders({
			audience: MEMORIES_RETRIEVAL_REQUEST_AUDIENCE,
			method: 'POST',
			path: MEMORIES_RETRIEVAL_PATH,
			body,
			privateKeyEnvName: MEMORIES_ENV.retrievalSigningPrivateKey,
		}),
		body,
		signal: AbortSignal.timeout((MEMORIES_PRIVATE_REQUEST_TTL_SECONDS + 10) * 1000),
	});
}

export async function inspectMemoriesObject(input: {
	objectKey: string;
	mimeType: string;
}): Promise<MemoriesInspectionOutcome> {
	let payload: unknown;
	try {
		const response = await retrieveMemoriesObject({ ...input, mode: 'inspect' });
		if (response.status !== 200) return { kind: 'unavailable' };
		payload = await response.json();
	} catch {
		return { kind: 'unavailable' };
	}
	if (typeof payload !== 'object' || payload === null) return { kind: 'unavailable' };
	const inspection = payload as MemoriesInspectionResult;
	if (inspection.exists === false) return { kind: 'missing' };
	if (inspection.exists !== true) return { kind: 'unavailable' };
	return { kind: 'found', inspection };
}

export async function deleteMemoriesObject(input: {
	objectKey: string;
	mimeType: string;
}): Promise<boolean> {
	const response = await retrieveMemoriesObject({ ...input, mode: 'delete' });
	return response.ok;
}
