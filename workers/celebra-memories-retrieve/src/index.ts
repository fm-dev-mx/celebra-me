/**
 * Retrieval Worker: streams, inspects or deletes exactly one object that the
 * app resolved and signed for. It never lists the bucket and never accepts a
 * key the app did not sign.
 */

import {
	MEMORIES_INSPECTION_BYTES,
	MEMORIES_JSON_BODY_MAX_BYTES,
} from '../../../src/lib/memories/contract/limits';
import {
	getMemoriesMimePolicy,
	isMemoriesVideoMime,
} from '../../../src/lib/memories/contract/media-policy';
import { isMemoriesObjectKeyForMime } from '../../../src/lib/memories/contract/object-key';
import {
	MEMORIES_PRIVATE_REQUEST_TTL_SECONDS,
	MEMORIES_RETRIEVAL_PATH,
	MEMORIES_RETRIEVAL_REQUEST_AUDIENCE,
} from '../../../src/lib/memories/contract/private-request';
import { readBoundedText } from '../../shared/bounded-body';
import { bytesToHex } from '../../shared/encoding';
import { errorResponse, jsonResponse, parseStorageTarget } from '../../shared/http';
import { privateRequestId, verifyMemoriesPrivateRequest } from '../../shared/private-request';
import { consumeReplayKey } from '../../shared/replay-guard';
import { isMediaSignatureValid, parseBoundedVideoDurationSeconds } from './inspect';

type RetrieveEnv = Omit<MemoriesRetrieveBindings, 'MEMORIES_STORAGE_TARGET'> & {
	MEMORIES_STORAGE_TARGET: string;
	NONCE_GUARD?: DurableObjectNamespace;
	MEMORIES_RETRIEVAL_REQUEST_VERIFY_PUBLIC_KEY: string;
};
type RetrievalMode = 'inline' | 'attachment' | 'inspect' | 'delete';
type ParsedRetrievalRequest = {
	objectKey: string;
	mimeType: string;
	mode: RetrievalMode;
	downloadName: unknown;
	rangeStart: number | null;
	rangeEnd: number | null;
};

const BASE_REQUEST_KEYS = new Set(['objectKey', 'mimeType', 'mode']);
const STREAM_REQUEST_KEYS = new Set([
	...BASE_REQUEST_KEYS,
	'downloadName',
	'rangeStart',
	'rangeEnd',
]);
const DEFAULT_DOWNLOAD_BASENAME = 'recuerdo';

function isConfigured(env: RetrieveEnv): boolean {
	return Boolean(
		env.MEMORIES_BUCKET &&
		env.MEMORIES_RETRIEVAL_REQUEST_VERIFY_PUBLIC_KEY &&
		env.NONCE_GUARD &&
		parseStorageTarget(env.MEMORIES_STORAGE_TARGET),
	);
}

function safeDownloadName(value: unknown, extension: string): string {
	const fallback = `${DEFAULT_DOWNLOAD_BASENAME}.${extension}`;
	if (typeof value !== 'string') return fallback;
	const normalized = value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120);
	return normalized.toLowerCase().endsWith(`.${extension}`) ? normalized : fallback;
}

async function readBoundedBytes(body: ReadableStream<Uint8Array> | null): Promise<Uint8Array> {
	if (!body) return new Uint8Array(0);
	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	while (length < MEMORIES_INSPECTION_BYTES) {
		const { done, value } = await reader.read();
		if (done || !value) break;
		chunks.push(value);
		length += value.byteLength;
	}
	await reader.cancel().catch(() => undefined);
	const bytes = new Uint8Array(Math.min(length, MEMORIES_INSPECTION_BYTES));
	let offset = 0;
	for (const chunk of chunks) {
		const bounded = chunk.subarray(0, bytes.length - offset);
		bytes.set(bounded, offset);
		offset += bounded.byteLength;
		if (offset >= bytes.length) break;
	}
	return bytes;
}

function extractChecksum(object: R2Object): string | null {
	if (object.checksums.sha256) return bytesToHex(object.checksums.sha256);
	const serialized = object.checksums.toJSON();
	return typeof serialized.sha256 === 'string' ? serialized.sha256.toLowerCase() : null;
}

async function handleInspect(
	env: RetrieveEnv,
	objectKey: string,
	mimeType: string,
): Promise<Response> {
	const object = await env.MEMORIES_BUCKET.get(objectKey, {
		range: { offset: 0, length: MEMORIES_INSPECTION_BYTES },
	});
	// An answered "absent" is the only proof of a missing object; a 404 can also
	// mean a misrouted request, which must never reject or release an upload.
	if (!object)
		return jsonResponse(
			{
				exists: false,
				sizeBytes: 0,
				checksumSha256: null,
				signatureValid: false,
				durationSeconds: null,
			},
			200,
		);
	const firstBytes = await readBoundedBytes(object.body);
	const isVideo = isMemoriesVideoMime(mimeType);
	let durationSeconds = isVideo ? parseBoundedVideoDurationSeconds(firstBytes) : null;
	if (isVideo && durationSeconds === null && object.size > firstBytes.length) {
		const tail = await env.MEMORIES_BUCKET.get(objectKey, {
			range: {
				offset: Math.max(0, object.size - MEMORIES_INSPECTION_BYTES),
				length: MEMORIES_INSPECTION_BYTES,
			},
		});
		durationSeconds = tail
			? parseBoundedVideoDurationSeconds(await readBoundedBytes(tail.body))
			: null;
	}
	return jsonResponse(
		{
			exists: true,
			sizeBytes: object.size,
			checksumSha256: extractChecksum(object),
			signatureValid: isMediaSignatureValid(firstBytes, mimeType),
			durationSeconds,
		},
		200,
	);
}

async function handleStream(input: {
	env: RetrieveEnv;
	objectKey: string;
	mimeType: string;
	mode: 'inline' | 'attachment';
	downloadName: unknown;
	rangeStart: number | null;
	rangeEnd: number | null;
}): Promise<Response> {
	const range =
		input.rangeStart === null
			? undefined
			: {
					offset: input.rangeStart,
					length:
						input.rangeEnd === null ? undefined : input.rangeEnd - input.rangeStart + 1,
				};
	const object = await input.env.MEMORIES_BUCKET.get(
		input.objectKey,
		range ? { range } : undefined,
	);
	if (!object?.body) return errorResponse('not_found', 404);
	const extension = getMemoriesMimePolicy(input.mimeType)?.extension ?? 'bin';
	const headers = new Headers({
		'Content-Type': input.mimeType,
		'Content-Disposition': `${input.mode}; filename="${safeDownloadName(input.downloadName, extension)}"`,
		'Cache-Control': 'private, no-store, max-age=0',
		'X-Content-Type-Options': 'nosniff',
		'Accept-Ranges': 'bytes',
	});
	if (range) {
		const rangeStart = input.rangeStart as number;
		const end = Math.min(input.rangeEnd ?? object.size - 1, object.size - 1);
		headers.set('Content-Range', `bytes ${rangeStart}-${end}/${object.size}`);
		headers.set('Content-Length', String(Math.max(0, end - rangeStart + 1)));
	}
	return new Response(object.body, { status: range ? 206 : 200, headers });
}

function parseRangeBoundary(value: unknown): number | null | 'invalid' {
	if (value === null || value === undefined) return null;
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
		? value
		: 'invalid';
}

function parseRetrievalRequest(rawBody: string): ParsedRetrievalRequest | null {
	let body: Record<string, unknown>;
	try {
		body = JSON.parse(rawBody) as Record<string, unknown>;
	} catch {
		return null;
	}
	const mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';
	const mode = body.mode as RetrievalMode;
	const rangeStart = parseRangeBoundary(body.rangeStart);
	const rangeEnd = parseRangeBoundary(body.rangeEnd);
	const allowedKeys =
		mode === 'inline' || mode === 'attachment' ? STREAM_REQUEST_KEYS : BASE_REQUEST_KEYS;
	if (
		Object.keys(body).some((key) => !allowedKeys.has(key)) ||
		!isMemoriesObjectKeyForMime(body.objectKey, mimeType) ||
		!['inline', 'attachment', 'inspect', 'delete'].includes(mode) ||
		rangeStart === 'invalid' ||
		rangeEnd === 'invalid' ||
		(rangeStart === null && rangeEnd !== null) ||
		(rangeStart !== null && rangeEnd !== null && rangeEnd < rangeStart)
	) {
		return null;
	}
	return {
		objectKey: body.objectKey as string,
		mimeType,
		mode,
		downloadName: body.downloadName,
		rangeStart,
		rangeEnd,
	};
}

async function handleRetrievalRequest(
	env: RetrieveEnv,
	body: ParsedRetrievalRequest,
): Promise<Response> {
	if (body.mode === 'inspect') return handleInspect(env, body.objectKey, body.mimeType);
	if (body.mode === 'delete') {
		await env.MEMORIES_BUCKET.delete(body.objectKey);
		return jsonResponse({ deleted: true }, 200);
	}
	return handleStream({ env, ...body, mode: body.mode });
}

export default {
	async fetch(request: Request, env: RetrieveEnv): Promise<Response> {
		if (request.method !== 'POST' || new URL(request.url).pathname !== MEMORIES_RETRIEVAL_PATH)
			return errorResponse('not_found', 404);
		if (!isConfigured(env)) return errorResponse('unavailable', 503);
		const rawBody = await readBoundedText(request, MEMORIES_JSON_BODY_MAX_BYTES);
		if (rawBody === null) return errorResponse('invalid_request', 400);
		if (
			!(await verifyMemoriesPrivateRequest({
				request,
				rawBody,
				expectedAudience: MEMORIES_RETRIEVAL_REQUEST_AUDIENCE,
				expectedPath: MEMORIES_RETRIEVAL_PATH,
				publicKeyPem: env.MEMORIES_RETRIEVAL_REQUEST_VERIFY_PUBLIC_KEY,
			}))
		) {
			return errorResponse('unauthorized', 401);
		}
		const claimed = await consumeReplayKey(
			env.NONCE_GUARD,
			`private:${privateRequestId(request)}`,
			Date.now() + MEMORIES_PRIVATE_REQUEST_TTL_SECONDS * 1000,
		);
		if (!claimed) return errorResponse('replay', 409);
		const body = parseRetrievalRequest(rawBody);
		if (!body) return errorResponse('invalid_request', 400);
		return handleRetrievalRequest(env, body);
	},
};

export { ReplayGuard } from '../../shared/replay-guard';
