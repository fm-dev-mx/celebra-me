import {
	VALENTINA_MEMORIES_RETRIEVAL_PATH,
	isValentinaMemoriesObjectKeyForMime,
	isValentinaMemoriesSignatureValid,
	parseBoundedVideoDurationSeconds,
} from '../../../src/data/valentina-memories-media.contract';
import {
	VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES,
	VALENTINA_MEMORIES_OBJECT_PREFIX,
	getValentinaMemoriesStorageBucketName,
} from '../../../src/data/valentina-memories-upload.contract';
import { MEMORIES_RETRIEVAL_REQUEST_AUDIENCE } from '../../../src/data/valentina-memories-private-request.contract';
import { verifyMemoriesPrivateRequest } from '../../shared/private-request';

type RetrieveEnv = Omit<MemoriesRetrieveBindings, 'MEMORIES_STORAGE_TARGET'> & {
	MEMORIES_STORAGE_TARGET: string;
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

function json(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}

function bytesToHex(bytes: ArrayBuffer): string {
	return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeDownloadName(value: unknown, extension: string): string {
	if (typeof value !== 'string') return `valentina.${extension}`;
	const normalized = value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120);
	return normalized.toLowerCase().endsWith(`.${extension}`)
		? normalized
		: `valentina.${extension}`;
}

async function readBoundedBytes(body: ReadableStream<Uint8Array> | null): Promise<Uint8Array> {
	if (!body) return new Uint8Array(0);
	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	while (length < 65_536) {
		const { done, value } = await reader.read();
		if (done || !value) break;
		chunks.push(value);
		length += value.byteLength;
	}
	await reader.cancel().catch(() => undefined);
	const bytes = new Uint8Array(Math.min(length, 65_536));
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
		range: { offset: 0, length: 65_536 },
	});
	if (!object) return json({ error: { code: 'not_found' } }, 404);
	const firstBytes = await readBoundedBytes(object.body);
	let durationSeconds = mimeType.startsWith('video/')
		? parseBoundedVideoDurationSeconds(firstBytes)
		: null;
	if (
		mimeType.startsWith('video/') &&
		durationSeconds === null &&
		object.size > firstBytes.length
	) {
		const tail = await env.MEMORIES_BUCKET.get(objectKey, {
			range: { offset: Math.max(0, object.size - 65_536), length: 65_536 },
		});
		durationSeconds = tail
			? parseBoundedVideoDurationSeconds(await readBoundedBytes(tail.body))
			: null;
	}
	return json({
		exists: true,
		sizeBytes: object.size,
		checksumSha256: extractChecksum(object),
		signatureValid: isValentinaMemoriesSignatureValid(firstBytes, mimeType),
		durationSeconds,
	});
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
	if (!object?.body) return json({ error: { code: 'not_found' } }, 404);
	const extension =
		input.objectKey.slice(VALENTINA_MEMORIES_OBJECT_PREFIX.length).split('.').pop() || 'bin';
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
		!isValentinaMemoriesObjectKeyForMime(body.objectKey, mimeType) ||
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
		return json({ deleted: true });
	}
	return handleStream({ env, ...body, mode: body.mode });
}

export default {
	async fetch(request: Request, env: RetrieveEnv): Promise<Response> {
		if (
			request.method !== 'POST' ||
			new URL(request.url).pathname !== VALENTINA_MEMORIES_RETRIEVAL_PATH
		)
			return json({ error: { code: 'not_found' } }, 404);
		if (
			!env.MEMORIES_BUCKET ||
			!env.MEMORIES_RETRIEVAL_REQUEST_VERIFY_PUBLIC_KEY ||
			!getValentinaMemoriesStorageBucketName(env.MEMORIES_STORAGE_TARGET)
		)
			return json({ error: { code: 'unavailable' } }, 503);
		const rawBody = await request.text();
		if (
			!rawBody ||
			new TextEncoder().encode(rawBody).byteLength > VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES
		)
			return json({ error: { code: 'bad_request' } }, 400);
		if (
			!(await verifyMemoriesPrivateRequest({
				request,
				rawBody,
				expectedAudience: MEMORIES_RETRIEVAL_REQUEST_AUDIENCE,
				expectedPath: VALENTINA_MEMORIES_RETRIEVAL_PATH,
				publicKeyPem: env.MEMORIES_RETRIEVAL_REQUEST_VERIFY_PUBLIC_KEY,
			}))
		) {
			return json({ error: { code: 'unauthorized' } }, 401);
		}
		const body = parseRetrievalRequest(rawBody);
		if (!body) return json({ error: { code: 'bad_request' } }, 400);
		return handleRetrievalRequest(env, body);
	},
};
