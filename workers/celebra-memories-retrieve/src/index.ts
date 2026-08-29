import {
	VALENTINA_MEMORIES_RETRIEVAL_PATH,
	VALENTINA_MEMORIES_RETRIEVAL_REQUEST_TTL_SECONDS,
	buildValentinaMemoriesRetrievalSigningPayload,
	isValentinaMemoriesObjectKeyForMime,
	isValentinaMemoriesSignatureValid,
	parseBoundedVideoDurationSeconds,
} from '../../../src/data/valentina-memories-media.contract';
import {
	VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES,
	VALENTINA_MEMORIES_OBJECT_PREFIX,
} from '../../../src/data/valentina-memories-upload.contract';

type R2ObjectLike = {
	body?: ReadableStream<Uint8Array> | null;
	size?: number;
	checksums?: { sha256?: ArrayBuffer; toJSON?: () => { sha256?: string } };
	customMetadata?: Record<string, string>;
	httpMetadata?: { contentType?: string; contentLength?: number };
};

type R2BucketLike = {
	get(
		key: string,
		options?: { range?: { offset?: number; length?: number } },
	): Promise<R2ObjectLike | null>;
	head?(key: string): Promise<R2ObjectLike | null>;
};

type RetrieveEnv = {
	MEMORIES_BUCKET: R2BucketLike;
	RETRIEVAL_SHARED_SECRET: string;
};

const HEX = /^[0-9a-f]{64}$/i;

function json(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}

function isTimestampFresh(raw: string | null): boolean {
	if (!raw || !/^\d{1,12}$/.test(raw)) return false;
	const timestamp = Number(raw);
	return (
		Number.isSafeInteger(timestamp) &&
		Math.abs(Math.floor(Date.now() / 1000) - timestamp) <=
			VALENTINA_MEMORIES_RETRIEVAL_REQUEST_TTL_SECONDS
	);
}

function bytesToHex(bytes: ArrayBuffer): string {
	return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string): ArrayBuffer {
	const bytes = new Uint8Array(value.length / 2);
	for (let index = 0; index < bytes.length; index += 1) {
		bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
	}
	return bytes.buffer;
}

async function verifyPayload(secret: string, payload: string, signature: string): Promise<boolean> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['verify'],
	);
	return crypto.subtle.verify(
		'HMAC',
		key,
		hexToBytes(signature),
		new TextEncoder().encode(payload),
	);
}

async function sha256(value: string): Promise<string> {
	return bytesToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function safeDownloadName(value: unknown, extension: string): string {
	if (typeof value !== 'string') return `valentina.${extension}`;
	const normalized = value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120);
	return normalized.toLowerCase().endsWith(`.${extension}`)
		? normalized
		: `valentina.${extension}`;
}

async function readFirstBytes(body: unknown): Promise<Uint8Array> {
	if (!body) return new Uint8Array(0);
	if (body instanceof Uint8Array) return body.slice(0, 65536);

	const chunks: Uint8Array[] = [];
	let totalLen = 0;

	if (typeof (body as ReadableStream<Uint8Array>).getReader === 'function') {
		const reader = (body as ReadableStream<Uint8Array>).getReader();
		while (totalLen < 65536) {
			const { done, value } = await reader.read();
			if (done || !value) break;
			chunks.push(value);
			totalLen += value.byteLength;
		}
	} else if (Symbol.asyncIterator in Object(body)) {
		for await (const chunk of body as AsyncIterable<Uint8Array>) {
			chunks.push(chunk);
			totalLen += chunk.byteLength;
			if (totalLen >= 65536) break;
		}
	}

	const result = new Uint8Array(totalLen);
	let pos = 0;
	for (const chunk of chunks) {
		result.set(chunk, pos);
		pos += chunk.byteLength;
	}
	return result;
}

function extractChecksum(object: R2ObjectLike): string | null {
	if (object.checksums?.sha256) return bytesToHex(object.checksums.sha256);
	if (typeof object.checksums?.toJSON === 'function') {
		const jsonVal = object.checksums.toJSON();
		if (typeof jsonVal?.sha256 === 'string') return jsonVal.sha256.toLowerCase();
	}
	if (object.customMetadata?.sha256) return object.customMetadata.sha256.toLowerCase();
	return null;
}

async function handleInspect(
	env: RetrieveEnv,
	objectKey: string,
	mimeType: string,
): Promise<Response> {
	const object = await env.MEMORIES_BUCKET.get(objectKey, {
		range: { offset: 0, length: 65536 },
	});
	if (!object) return json({ error: { code: 'not_found' } }, 404);

	const firstBytes = await readFirstBytes(object.body);
	const signatureValid = isValentinaMemoriesSignatureValid(firstBytes, mimeType);
	const sizeBytes = object.size ?? object.httpMetadata?.contentLength ?? firstBytes.byteLength;
	let durationSeconds = mimeType.startsWith('video/')
		? parseBoundedVideoDurationSeconds(firstBytes)
		: null;
	if (
		mimeType.startsWith('video/') &&
		durationSeconds === null &&
		sizeBytes > firstBytes.byteLength
	) {
		const tail = await env.MEMORIES_BUCKET.get(objectKey, {
			range: { offset: Math.max(0, sizeBytes - 65536), length: 65536 },
		});
		durationSeconds = tail
			? parseBoundedVideoDurationSeconds(await readFirstBytes(tail.body))
			: null;
	}
	const checksumSha256 = extractChecksum(object);

	return json({
		exists: true,
		sizeBytes,
		checksumSha256,
		signatureValid,
		durationSeconds,
	});
}

async function handleStream(
	env: RetrieveEnv,
	objectKey: string,
	mimeType: string,
	mode: 'inline' | 'attachment',
	downloadName: unknown,
): Promise<Response> {
	const extension =
		objectKey.slice(VALENTINA_MEMORIES_OBJECT_PREFIX.length).split('.').pop() || 'bin';
	const object = await env.MEMORIES_BUCKET.get(objectKey);
	if (!object || !object.body) return json({ error: { code: 'not_found' } }, 404);

	return new Response(object.body, {
		status: 200,
		headers: {
			'Content-Type': mimeType,
			'Content-Disposition': `${mode === 'attachment' ? 'attachment' : 'inline'}; filename="${safeDownloadName(downloadName, extension)}"`,
			'Cache-Control': 'private, no-store, max-age=0',
			'X-Content-Type-Options': 'nosniff',
		},
	});
}

export default {
	async fetch(request: Request, env: RetrieveEnv): Promise<Response> {
		if (
			request.method !== 'POST' ||
			new URL(request.url).pathname !== VALENTINA_MEMORIES_RETRIEVAL_PATH
		) {
			return json({ error: { code: 'not_found' } }, 404);
		}
		if (!env.RETRIEVAL_SHARED_SECRET || !env.MEMORIES_BUCKET) {
			return json({ error: { code: 'unavailable' } }, 503);
		}

		const timestamp = request.headers.get('X-Celebra-Retrieval-Timestamp');
		const providedSignature = request.headers.get('X-Celebra-Retrieval-Signature') || '';
		if (!isTimestampFresh(timestamp) || !HEX.test(providedSignature)) {
			return json({ error: { code: 'unauthorized' } }, 401);
		}

		const rawBody = await request.text();
		if (
			!rawBody ||
			new TextEncoder().encode(rawBody).byteLength > VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES
		) {
			return json({ error: { code: 'bad_request' } }, 400);
		}

		const validSignature = await verifyPayload(
			env.RETRIEVAL_SHARED_SECRET,
			buildValentinaMemoriesRetrievalSigningPayload({
				timestamp: timestamp as string,
				method: request.method,
				path: VALENTINA_MEMORIES_RETRIEVAL_PATH,
				bodyHash: await sha256(rawBody),
			}),
			providedSignature,
		);
		if (!validSignature) return json({ error: { code: 'unauthorized' } }, 401);

		let body: {
			objectKey?: unknown;
			mimeType?: unknown;
			downloadName?: unknown;
			mode?: unknown;
		};
		try {
			body = JSON.parse(rawBody) as typeof body;
		} catch {
			return json({ error: { code: 'bad_request' } }, 400);
		}

		const mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';
		if (
			!isValentinaMemoriesObjectKeyForMime(body.objectKey, mimeType) ||
			(body.mode !== 'inline' && body.mode !== 'attachment' && body.mode !== 'inspect')
		) {
			return json({ error: { code: 'bad_request' } }, 400);
		}

		if (body.mode === 'inspect') {
			return handleInspect(env, body.objectKey as string, mimeType);
		}

		return handleStream(
			env,
			body.objectKey as string,
			mimeType,
			body.mode as 'inline' | 'attachment',
			body.downloadName,
		);
	},
};
