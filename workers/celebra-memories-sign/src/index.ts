import {
	VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES,
	VALENTINA_MEMORIES_SIGN_PATH,
	VALENTINA_MEMORIES_UPLOAD_PATH,
	getValentinaMemoriesMimePolicy,
	getValentinaMemoriesStorageBucketName,
	isAllowedValentinaMemoriesOrigin,
	isWithinValentinaMemoriesUploadWindow,
} from '../../../src/data/valentina-memories-upload.contract';
import { isValentinaMemoriesObjectKeyForMime } from '../../../src/data/valentina-memories-media.contract';
import {
	MEMORIES_PRIVATE_REQUEST_HEADERS,
	MEMORIES_PRIVATE_REQUEST_TTL_SECONDS,
	MEMORIES_UPLOAD_REQUEST_AUDIENCE,
} from '../../../src/data/valentina-memories-private-request.contract';
import { verifyMemoriesPrivateRequest } from '../../shared/private-request';
import { consumeReplayKey } from '../../shared/replay-guard';
import {
	getMemoriesRateLimiter,
	hasRequiredR2Secrets,
	type MemoriesSignEnv,
	type MemoriesSignHandlerOptions,
} from './env';
import { MEMORY_UPLOAD_CORS_HEADERS, errorResponse, jsonResponse } from './http';
import { createUploadCapability, sha256HexToArrayBuffer, sha256HexToBase64, verifyUploadCapability } from './capability';

const ALLOWED_SIGN_KEYS = new Set([
	'objectKey',
	'sessionId',
	'mimeType',
	'sizeBytes',
	'checksumSha256',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSignRequest(payload: unknown): {
	objectKey: string;
	sessionId: string;
	mimeType: string;
	sizeBytes: number;
	checksumSha256: string;
} | null {
	if (!isRecord(payload)) return null;
	const keys = Object.keys(payload);
	if (keys.length !== ALLOWED_SIGN_KEYS.size || keys.some((key) => !ALLOWED_SIGN_KEYS.has(key)))
		return null;
	const { objectKey, sessionId, mimeType, sizeBytes, checksumSha256 } = payload;
	if (
		typeof objectKey !== 'string' ||
		typeof sessionId !== 'string' ||
		!UUID_PATTERN.test(sessionId) ||
		typeof mimeType !== 'string' ||
		typeof sizeBytes !== 'number' ||
		!Number.isSafeInteger(sizeBytes) ||
		sizeBytes <= 0 ||
		typeof checksumSha256 !== 'string' ||
		!/^[0-9a-f]{64}$/i.test(checksumSha256) ||
		!isValentinaMemoriesObjectKeyForMime(objectKey, mimeType)
	) {
		return null;
	}
	return {
		objectKey,
		sessionId,
		mimeType: mimeType.trim().toLowerCase(),
		sizeBytes,
		checksumSha256: checksumSha256.toLowerCase(),
	};
}

async function readBoundedBody(request: Request): Promise<string | null> {
	const rawLength = request.headers.get('Content-Length');
	if (rawLength !== null) {
		if (!/^\d+$/.test(rawLength.trim())) return null;
		if (Number(rawLength) > VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES) return null;
	}
	if (!request.body) return null;
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;
			total += value.byteLength;
			if (total > VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES) {
				await reader.cancel('request body exceeds configured limit');
				return null;
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const body = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(body);
}

function allowedOrigin(request: Request, target: string): string | null {
	const origin = request.headers.get('Origin');
	return origin && isAllowedValentinaMemoriesOrigin(origin, target as never) ? origin : null;
}

async function consumePrivateRequest(env: MemoriesSignEnv, request: Request, now: Date): Promise<boolean> {
	const requestId = request.headers.get(MEMORIES_PRIVATE_REQUEST_HEADERS.requestId);
	return consumeReplayKey(
		env.NONCE_GUARD,
		`private:${requestId ?? ''}`,
		now.getTime() + MEMORIES_PRIVATE_REQUEST_TTL_SECONDS * 1000,
	);
}

export async function handleMemoriesUploadRequest(
	request: Request,
	env: MemoriesSignEnv,
	now = new Date(),
): Promise<Response> {
	const origin = allowedOrigin(request, env.MEMORIES_STORAGE_TARGET);
	if (!origin) return errorResponse('forbidden_origin', 'El origen no está autorizado.', 403, null);
	if (request.method === 'OPTIONS')
		return new Response(null, {
			status: 204,
			headers: { ...MEMORY_UPLOAD_CORS_HEADERS, 'Access-Control-Allow-Origin': origin },
		});
	if (request.method !== 'PUT')
		return errorResponse('not_found', 'La ruta solicitada no existe.', 404, origin);
	if (!env.MEMORIES_BUCKET || !env.MEMORIES_UPLOAD_CAPABILITY_SECRET || !env.NONCE_GUARD) {
		return errorResponse('upload_failed', 'No se pudo recibir la carga.', 503, origin);
	}
	const authorization = request.headers.get('Authorization') ?? '';
	const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
	const claims = await verifyUploadCapability(token, env.MEMORIES_UPLOAD_CAPABILITY_SECRET, now);
	const checksum = request.headers.get('x-amz-checksum-sha256') ?? '';
	const contentLength = request.headers.get('Content-Length');
	if (
		!claims ||
		!isValentinaMemoriesObjectKeyForMime(claims.objectKey, claims.mimeType) ||
		!getValentinaMemoriesMimePolicy(claims.mimeType) ||
		request.headers.get('Content-Type') !== claims.mimeType ||
		checksum !== sha256HexToBase64(claims.checksumSha256) ||
		contentLength !== String(claims.sizeBytes) ||
		!request.body
	) {
		return errorResponse('capability_invalid', 'La capability de carga no es válida.', 400, origin);
	}
	const claimed = await consumeReplayKey(
		env.NONCE_GUARD,
		`upload:${claims.nonce}`,
		claims.expiresAt * 1000,
	);
	if (!claimed) return errorResponse('replay', 'La capability ya fue utilizada.', 409, origin);

	const fixedLength = new FixedLengthStream(claims.sizeBytes);
	const uploadPromise = env.MEMORIES_BUCKET.put(claims.objectKey, fixedLength.readable, {
		httpMetadata: { contentType: claims.mimeType },
		sha256: sha256HexToArrayBuffer(claims.checksumSha256),
		onlyIf: { etagDoesNotMatch: '*' },
	});
	const copyPromise = request.body.pipeTo(fixedLength.writable);
	const results = await Promise.allSettled([uploadPromise, copyPromise]);
	if (results.some((result) => result.status === 'rejected')) {
		return errorResponse('upload_failed', 'La carga no cumple el tamaño o checksum declarado.', 400, origin);
	}
	return jsonResponse({ uploaded: true }, 201, origin);
}

export async function handleMemoriesSignRequest(
	request: Request,
	env: MemoriesSignEnv,
	options: MemoriesSignHandlerOptions = {},
): Promise<Response> {
	const url = new URL(request.url);
	if (request.method !== 'POST' || url.pathname !== VALENTINA_MEMORIES_SIGN_PATH) {
		return errorResponse('not_found', 'La ruta solicitada no existe.', 404, null);
	}
	if (!hasRequiredR2Secrets(env)) {
		return errorResponse('sign_failed', 'No se pudo firmar la subida.', 503, null);
	}
	const bucketName = getValentinaMemoriesStorageBucketName(env.MEMORIES_STORAGE_TARGET);
	if (!bucketName) {
		return errorResponse('sign_failed', 'No se pudo firmar la subida.', 503, null);
	}
	const rawBody = await readBoundedBody(request);
	if (!rawBody) return errorResponse('invalid_request', 'La solicitud no es válida.', 400, null);
	if (
		!(await verifyMemoriesPrivateRequest({
			request,
			rawBody,
			expectedAudience: MEMORIES_UPLOAD_REQUEST_AUDIENCE,
			expectedPath: VALENTINA_MEMORIES_SIGN_PATH,
			publicKeyPem: env.MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY,
			now: options.now,
		}))
	) {
		return errorResponse('unauthorized', 'La solicitud no está autorizada.', 401, null);
	}
	const now = options.now ?? new Date();
	if (!(await consumePrivateRequest(env, request, now)))
		return errorResponse('replay', 'La solicitud ya fue utilizada.', 409, null);
	let payload: unknown;
	try {
		payload = JSON.parse(rawBody) as unknown;
	} catch {
		return errorResponse('invalid_request', 'La solicitud no es válida.', 400, null);
	}
	const input = parseSignRequest(payload);
	if (!input) return errorResponse('invalid_request', 'La solicitud no es válida.', 400, null);
	if (!isWithinValentinaMemoriesUploadWindow(now)) {
		return errorResponse(
			'upload_window_closed',
			'La ventana de carga no está abierta.',
			403,
			null,
		);
	}
	const policy = getValentinaMemoriesMimePolicy(input.mimeType);
	if (!policy)
		return errorResponse('unsupported_mime', 'Tipo de archivo no permitido.', 400, null);
	if (input.sizeBytes > policy.maxBytes)
		return errorResponse('file_too_large', 'El archivo supera el tamaño permitido.', 400, null);
	const limiter = getMemoriesRateLimiter(env);
	if (!limiter || !(await limiter.limit({ key: input.sessionId })).success) {
		return errorResponse('rate_limited', 'Intente de nuevo en un momento.', 429, null);
	}
	try {
		const capability = await createUploadCapability(input, env.MEMORIES_UPLOAD_CAPABILITY_SECRET, now);
		return jsonResponse(
			{
				uploadUrl: new URL(VALENTINA_MEMORIES_UPLOAD_PATH, request.url).toString(),
				requiredHeaders: {
					Authorization: `Bearer ${capability.token}`,
					'Content-Type': input.mimeType,
					'x-amz-checksum-sha256': sha256HexToBase64(input.checksumSha256),
				},
				expiresAt: capability.expiresAt,
			},
			200,
			null,
		);
	} catch {
		return errorResponse('sign_failed', 'No se pudo firmar la subida.', 500, null);
	}
}

export default {
	async fetch(request: Request, env: MemoriesSignEnv): Promise<Response> {
		if (new URL(request.url).pathname === VALENTINA_MEMORIES_UPLOAD_PATH)
			return handleMemoriesUploadRequest(request, env);
		return handleMemoriesSignRequest(request, env);
	},
};

export { ReplayGuard } from '../../shared/replay-guard';
